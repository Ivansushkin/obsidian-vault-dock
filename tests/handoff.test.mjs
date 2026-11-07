import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { buildSync } from "esbuild";
import test from "node:test";
import { runInNewContext } from "node:vm";

const bundle = buildSync({
	stdin: {
		contents:
			'export { Handoff } from "./src/handoff.ts"; export { connectDesktop } from "./src/desktop.ts"; export { watchNativeVaultMenu } from "./src/native-vault-menu.ts";',
		resolveDir: process.cwd(),
	},
	bundle: true,
	write: false,
	format: "esm",
}).outputFiles[0].text;
const { Handoff, connectDesktop, watchNativeVaultMenu } = await import(
	`data:text/javascript,${encodeURIComponent(bundle)}`
);

const bounds = { x: 10, y: 20, width: 900, height: 650 };
const vaultPage = "app://obsidian.md/index.html";
const vaults = [
	{ id: "a", name: "Same", path: "/a/Same", open: true },
	{ id: "b", name: "Same", path: "/b/Same", open: true },
];
function fixture({ asyncStorage = false } = {}) {
	const storage = new Map();
	const events = new EventTarget();
	const nativeEvents = new EventTarget();
	let locked = false;
	let released;
	const actions = [];
	const hidden = new Set();
	const win = Object.assign(events, {
		localStorage: {
			getItem: (key) => storage.get(key) ?? null,
			setItem(key, value) {
				storage.set(key, value);
				const event = Object.assign(new Event("storage"), {
					key,
					newValue: value,
				});
				if (asyncStorage) {
					queueMicrotask(() => events.dispatchEvent(event));
				} else {
					events.dispatchEvent(event);
				}
			},
			removeItem: (key) => storage.delete(key),
		},
		navigator: {
			locks: {
				async request(_name, options, callback) {
					while (locked) {
						if (options.ifAvailable) {
							return callback(null);
						}
						await released.promise;
					}
					options.signal?.throwIfAborted();
					locked = true;
					released = Promise.withResolvers();
					try {
						return await callback({});
					} finally {
						locked = false;
						released.resolve();
					}
				},
			},
		},
		crypto,
		setTimeout,
		clearTimeout,
	});
	const desktop = {
		windowId: 1,
		isReadyWindow: (id, _bounds, allowHidden) =>
			allowHidden || !hidden.has(id),
		isWindowFocused: () => true,
		isWindowVisible: (id) => !hidden.has(id),
		showWindow(id) {
			actions.push(`show ${id}`);
			hidden.delete(id);
		},
		showInactive() {
			actions.push(`restore ${this.windowId}`);
			hidden.delete(this.windowId);
		},
		hide() {
			actions.push(`hide ${this.windowId}`);
			hidden.add(this.windowId);
		},
		list: () => vaults,
		getWindowPlacement: () => ({ bounds, state: "normal" }),
		isNormalWindow: () => true,
		normalizeWindow: async () => {},
		setBounds: () => actions.push("bounds"),
		findWindowWithoutPlugin: async () => undefined,
		open: (target) => actions.push(target.path),
		openOrFocus: async (target) => actions.push(`focus ${target.id}`),
		watchWindowClose(id, onClose) {
			nativeEvents.addEventListener(`closed ${id}`, onClose, {
				once: true,
			});
			return () =>
				nativeEvents.removeEventListener(`closed ${id}`, onClose);
		},
		close() {
			actions.push(`close ${this.windowId}`);
			nativeEvents.dispatchEvent(new Event(`closed ${this.windowId}`));
		},
	};
	return { win, desktop, actions };
}

test("a click in the incoming fullscreen window waits for the previous handoff", async () => {
	const { win, desktop, actions } = fixture();
	const entering = Promise.withResolvers();
	const entered = Promise.withResolvers();
	let targetFullscreen = false;
	const window = {
		...desktop,
		getWindowPlacement: () => ({ bounds, state: "fullscreen" }),
		isReadyWindow(id, bounds, allowHidden, state) {
			if (id === 2 && state === "fullscreen" && !targetFullscreen) {
				return false;
			}
			return desktop.isReadyWindow(id, bounds, allowHidden);
		},
		async applyWindowState() {
			entering.resolve();
			await entered.promise;
			targetFullscreen = true;
		},
	};
	const first = new Handoff(win, window, "a");
	const second = new Handoff(win, { ...window, windowId: 2 }, "b");
	win.addEventListener("storage", () => {
		void first.receive(true);
		void second.receive(true);
	});
	const outward = first.switchTo("b");
	await entering.promise;
	const returning = second.switchTo("a");
	entered.resolve();
	assert.equal(await outward, "ok");
	assert.equal(await returning, "ok");
	assert.deepEqual(actions, [
		"bounds",
		"/b/Same",
		"hide 1",
		"show 1",
		"hide 2",
	]);
});

test("an open destination applies bounds and becomes ready before focus and source close", async () => {
	const { win, desktop, actions } = fixture();
	let searchSignal;
	const source = new Handoff(
		win,
		{
			...desktop,
			findWindowWithoutPlugin: async (_id, _expires, signal) => {
				searchSignal = signal;
				await new Promise((resolve) =>
					signal.addEventListener("abort", resolve, { once: true }),
				);
			},
		},
		"a",
	);
	const target = new Handoff(win, { ...desktop, windowId: 2 }, "b");
	win.addEventListener("storage", () => target.receive(false));
	const result = source.switchTo("b", "replace");
	assert.deepEqual(actions, ["bounds"]);
	assert.equal(await source.switchTo("b"), "busy");
	assert.equal(await target.switchTo("a"), "busy");
	target.receive(true);
	assert.equal(await result, "ok");
	assert.equal(searchSignal.aborted, true);
	assert.deepEqual(actions, ["bounds", "/b/Same", "close 1"]);
});

test("a rejected or unacknowledged destination leaves the source open", async () => {
	const { win, desktop, actions } = fixture();
	const source = new Handoff(win, desktop, "a", 15);
	assert.equal(await source.switchTo("b"), "timeout");
	const target = new Handoff(
		win,
		{
			...desktop,
			windowId: 2,
			setBounds() {
				throw new Error("unsupported bounds");
			},
		},
		"b",
	);
	target.receive(true);
	assert.deepEqual(actions, []);
	win.addEventListener("storage", () => target.receive(true));
	assert.equal(await source.switchTo("b"), "failed");
	assert.deepEqual(actions, []);
});

test("a cold destination opens and prepares its geometry before acknowledging readiness", async () => {
	const { win, desktop, actions } = fixture();
	const source = new Handoff(
		win,
		{
			...desktop,
			list: () =>
				vaults.map((vault) => ({ ...vault, open: vault.id === "a" })),
		},
		"a",
	);
	const target = new Handoff(win, { ...desktop, windowId: 2 }, "b");
	const result = source.switchTo("b", "replace");
	assert.deepEqual(actions, ["/b/Same"]);
	target.receive(false);
	assert.deepEqual(actions, ["/b/Same", "bounds"]);
	target.receive(true);
	assert.equal(await result, "ok");
	assert.deepEqual(actions, ["/b/Same", "bounds", "close 1"]);
});

for (const [mode, alreadyOpen] of [
	["replace", false],
	["keep-open", true],
]) {
	test(`${mode} replaces the source when the destination has no running plugin`, async () => {
		const { win, desktop, actions } = fixture();
		const normalizationStarted = Promise.withResolvers();
		const finishNormalization = Promise.withResolvers();
		const source = new Handoff(
			win,
			{
				...desktop,
				list: () => [vaults[0], { ...vaults[1], open: alreadyOpen }],
				async findWindowWithoutPlugin(id) {
					assert.equal(id, "b");
					assert.deepEqual(actions, alreadyOpen ? [] : ["/b/Same"]);
					return 2;
				},
				async normalizeWindow(windowId) {
					assert.equal(windowId, 2);
					normalizationStarted.resolve();
					await finishNormalization.promise;
				},
				setBounds(receivedBounds, windowId) {
					assert.deepEqual(receivedBounds, bounds);
					assert.equal(windowId, 2);
					actions.push("bounds");
				},
			},
			"a",
			250,
		);
		const result = source.switchTo("b", mode);
		await Promise.race([normalizationStarted.promise, result]);
		assert.deepEqual(actions, alreadyOpen ? [] : ["/b/Same"]);
		assert.equal(desktop.isWindowVisible(1), true);
		finishNormalization.resolve();
		assert.equal(await result, "ok");
		assert.deepEqual(
			actions,
			alreadyOpen
				? ["bounds", "/b/Same", "close 1"]
				: ["/b/Same", "bounds", "close 1"],
		);
	});
}

test("the default mode focuses the target before hiding the source, including on return", async () => {
	const { win, desktop, actions } = fixture();
	const focusChecked = Promise.withResolvers();
	let targetFocused = false;
	const source = new Handoff(
		win,
		{
			...desktop,
			isWindowFocused: () => {
				focusChecked.resolve("focus checked");
				return targetFocused;
			},
		},
		"a",
	);
	const target = new Handoff(win, { ...desktop, windowId: 2 }, "b");
	win.addEventListener("storage", () => target.receive(false));
	const result = source.switchTo("b");
	assert.deepEqual(actions, ["bounds"]);
	target.receive(true);
	assert.equal(
		await Promise.race([focusChecked.promise, result]),
		"focus checked",
	);
	assert.deepEqual(actions, ["bounds", "/b/Same"]);
	assert.equal(desktop.isWindowVisible(1), true);
	targetFocused = true;
	assert.equal(await result, "ok");
	assert.deepEqual(actions, ["bounds", "/b/Same", "hide 1"]);

	actions.length = 0;
	win.addEventListener("storage", () => source.receive(true));
	assert.equal(await target.switchTo("a", "keep-open"), "ok");
	assert.deepEqual(actions, ["bounds", "show 1", "hide 2"]);
	target.dispose();
	assert.deepEqual(actions, ["bounds", "show 1", "hide 2", "restore 2"]);
});

for (const mode of ["keep-open", "replace"]) {
	test(`${mode} leaves the source visible when the target cannot take focus`, async () => {
		const { win, desktop, actions } = fixture();
		const source = new Handoff(
			win,
			{ ...desktop, isWindowFocused: () => false },
			"a",
			25,
		);
		const target = new Handoff(win, { ...desktop, windowId: 2 }, "b");
		win.addEventListener("storage", () => target.receive(true));
		assert.equal(await source.switchTo("b", mode), "failed");
		assert.deepEqual(actions, ["bounds", "/b/Same"]);
	});
}

test("a hidden expanded destination is shown before restoring its normal bounds", async () => {
	const { win, desktop, actions } = fixture();
	let expanded = false;
	const first = new Handoff(
		win,
		{
			...desktop,
			isNormalWindow: () => !expanded,
			async normalizeWindow() {
				assert.equal(desktop.isWindowVisible(1), true);
				expanded = false;
				actions.push("normalize");
			},
		},
		"a",
	);
	const second = new Handoff(win, { ...desktop, windowId: 2 }, "b");
	win.addEventListener("storage", () => {
		void first.receive(true);
		void second.receive(true);
	});
	assert.equal(await first.switchTo("b"), "ok");
	expanded = true;
	actions.length = 0;
	assert.equal(await second.switchTo("a"), "ok");
	assert.deepEqual(actions, [
		"restore 1",
		"normalize",
		"bounds",
		"/a/Same",
		"hide 2",
	]);
});

test("replace requests focus again for a cold destination before closing the source", async () => {
	const { win, desktop, actions } = fixture();
	let openCount = 0;
	const source = new Handoff(
		win,
		{
			...desktop,
			list: () => [vaults[0], { ...vaults[1], open: false }],
			open() {
				actions.push(++openCount === 1 ? "open" : "focus");
			},
			isWindowFocused: () => openCount === 2,
		},
		"a",
	);
	const target = new Handoff(win, { ...desktop, windowId: 2 }, "b");
	const result = source.switchTo("b", "replace");
	await target.receive(true);
	assert.equal(await result, "ok");
	assert.deepEqual(actions, ["open", "bounds", "focus", "close 1"]);
});

function expandedTarget(
	actions,
	{
		fullscreen = false,
		minimized = false,
		visibleWhenMinimized = false,
	} = {},
) {
	const native = new EventEmitter();
	let maximized = true;
	let currentBounds = { ...bounds, width: 1200 };
	return Object.assign(native, {
		id: 2,
		getBounds: () => currentBounds,
		isDestroyed: () => false,
		isVisible: () => !minimized || visibleWhenMinimized,
		isFocused: () => true,
		isMaximized: () => maximized,
		isMinimized: () => minimized,
		isFullScreen: () => fullscreen,
		setBounds(next) {
			assert.equal(fullscreen || maximized || minimized, false);
			actions.push("bounds");
			currentBounds = next;
		},
		setFullScreen(value) {
			assert.equal(value, false);
			actions.push("exit fullscreen");
		},
		finishFullscreenExit() {
			fullscreen = false;
			native.emit("leave-full-screen");
		},
		restore() {
			actions.push("restore");
		},
		finishRestore() {
			minimized = false;
			native.emit("restore");
		},
		unmaximize() {
			actions.push("unmaximize");
			maximized = false;
			native.emit("unmaximize");
		},
	});
}

function connectTarget(native) {
	return connectDesktop({
		setTimeout,
		clearTimeout,
		electron: {
			ipcRenderer: { sendSync: () => ({ id: "b" }) },
			remote: { BrowserWindow: { fromId: () => null } },
		},
		electronWindow: native,
	});
}

function expandedSourceFixture(
	state,
	timeout = 500,
	targetAlreadyExpanded = false,
) {
	const { win, actions } = fixture();
	let targetState = targetAlreadyExpanded ? state : "normal";
	let targetBounds = targetAlreadyExpanded
		? { ...bounds, width: 1100 }
		: undefined;
	let focused = false;
	let started;
	const transition = new Promise((resolve) => (started = resolve));
	const target = Object.assign(new EventEmitter(), {
		id: 2,
		getBounds: () => targetBounds,
		getNormalBounds: () => targetBounds,
		isDestroyed: () => false,
		isVisible: () => true,
		isFocused: () => focused,
		isMaximized: () => targetState === "maximized",
		isFullScreen: () => targetState === "fullscreen",
		isMinimized: () => false,
		setBounds(value) {
			targetBounds = value;
			actions.push("bounds");
		},
		maximize() {
			assert.equal(focused, false);
			actions.push("maximize");
			started();
		},
		setFullScreen(value) {
			assert.equal(value, true);
			assert.equal(focused, true);
			actions.push("enter fullscreen");
			started();
		},
	});
	let sourceVisible = true;
	const desktop = connectDesktop(
		Object.assign(win, {
			electron: {
				ipcRenderer: {
					sendSync(channel) {
						if (channel === "vault") {
							return { id: "a" };
						}
						if (channel === "vault-list") {
							return { a: vaults[0], b: vaults[1] };
						}
						assert.equal(channel, "vault-open");
						focused = true;
						actions.push("focus");
						return true;
					},
				},
				remote: {
					BrowserWindow: {
						fromId: (id) => (id === 2 ? target : null),
					},
				},
			},
			electronWindow: {
				id: 1,
				getBounds: () => ({ ...bounds, width: 1400 }),
				getNormalBounds: () => bounds,
				isMaximized: () => true,
				isFullScreen: () => state === "fullscreen",
				isMinimized: () => false,
				isDestroyed: () => false,
				isVisible: () => sourceVisible,
				setBounds: () => assert.fail("source geometry must not change"),
				hide() {
					sourceVisible = false;
					actions.push("hide");
				},
			},
			close() {
				sourceVisible = false;
				actions.push("close");
			},
		}),
	);
	const receiver = new Handoff(win, connectTarget(target), "b");
	win.addEventListener("storage", () => void receiver.receive(true));
	return {
		source: new Handoff(win, desktop, "a", timeout),
		actions,
		transition,
		target,
		finish() {
			targetState = state;
			focused = false;
			target.emit(
				state === "fullscreen" ? "enter-full-screen" : "maximize",
			);
		},
		getTargetBounds: () => targetBounds,
		isSourceVisible: () => sourceVisible,
	};
}

for (const state of ["maximized", "fullscreen"]) {
	test(`switching to an already ${state} destination preserves its state and bounds`, async () => {
		const fixture = expandedSourceFixture(state, 500, true);
		assert.equal(await fixture.source.switchTo("b", "keep-open"), "ok");
		assert.deepEqual(fixture.actions, ["focus", "hide"]);
		assert.deepEqual(fixture.getTargetBounds(), { ...bounds, width: 1100 });
	});
	for (const [mode, retire] of [
		["keep-open", "hide"],
		["replace", "close"],
	]) {
		test(`a ${state} source transfers its window state before ${retire}`, async () => {
			const fixture = expandedSourceFixture(state);
			const result = fixture.source.switchTo("b", mode);
			await Promise.race([fixture.transition, result]);
			const start =
				state === "fullscreen" ? "enter fullscreen" : "maximize";
			const preparation =
				state === "fullscreen"
					? ["bounds", "focus", start]
					: ["bounds", start];
			assert.deepEqual(fixture.actions, preparation);
			assert.deepEqual(fixture.getTargetBounds(), bounds);
			assert.equal(fixture.isSourceVisible(), true);
			fixture.finish();
			assert.equal(await result, "ok");
			assert.deepEqual(fixture.actions, [
				...preparation,
				"focus",
				retire,
			]);
		});
	}
}

for (const [failure, resultName] of [
	["a timeout", "timeout"],
	["the target closing", "failed"],
]) {
	test(`${failure} during fullscreen entry leaves the source visible`, async () => {
		const fixture = expandedSourceFixture("fullscreen", 80);
		const result = fixture.source.switchTo("b", "keep-open");
		await Promise.race([fixture.transition, result]);
		assert.deepEqual(fixture.actions, [
			"bounds",
			"focus",
			"enter fullscreen",
		]);
		if (resultName === "failed") {
			fixture.target.emit("closed");
		}
		assert.equal(await result, resultName);
		assert.equal(fixture.isSourceVisible(), true);
		assert.equal(fixture.target.listenerCount("enter-full-screen"), 0);
		assert.equal(fixture.target.listenerCount("closed"), 0);
		fixture.finish();
		assert.deepEqual(fixture.actions, [
			"bounds",
			"focus",
			"enter fullscreen",
		]);
	});
}

test("an expanded cold target waits for its layout before transferring geometry", async () => {
	const { win, desktop, actions } = fixture();
	const native = expandedTarget(actions);
	const source = new Handoff(
		win,
		{ ...desktop, list: () => [vaults[0], { ...vaults[1], open: false }] },
		"a",
	);
	const target = new Handoff(win, connectTarget(native), "b");
	const result = source.switchTo("b", "keep-open");
	target.receive(false);
	assert.deepEqual(actions, ["/b/Same"]);
	target.receive(true);
	assert.equal(await result, "ok");
	assert.deepEqual(actions, ["/b/Same", "unmaximize", "bounds", "hide 1"]);
});

test("a fullscreen target transfers geometry only after leaving fullscreen", async () => {
	const { win, desktop, actions } = fixture();
	const native = expandedTarget(actions, { fullscreen: true });
	const source = new Handoff(win, desktop, "a");
	const target = new Handoff(win, connectTarget(native), "b");
	const result = source.switchTo("b", "keep-open");
	target.receive(true);
	target.receive(true);
	assert.deepEqual(actions, ["exit fullscreen"]);
	assert.equal(desktop.isWindowVisible(1), true);
	native.finishFullscreenExit();
	assert.equal(await result, "ok");
	assert.deepEqual(actions, [
		"exit fullscreen",
		"unmaximize",
		"bounds",
		"/b/Same",
		"hide 1",
	]);
});

test("a fullscreen transition that times out leaves the source visible", async () => {
	const { win, desktop, actions } = fixture();
	const native = expandedTarget(actions, { fullscreen: true });
	const source = new Handoff(win, desktop, "a", 35);
	const target = new Handoff(win, connectTarget(native), "b");
	win.addEventListener("storage", () => target.receive(true));
	assert.equal(await source.switchTo("b", "keep-open"), "timeout");
	await new Promise((resolve) => setTimeout(resolve, 10));
	assert.equal(native.listenerCount("leave-full-screen"), 0);
	assert.equal(native.listenerCount("closed"), 0);
	native.finishFullscreenExit();
	assert.deepEqual(actions, ["exit fullscreen"]);
	assert.equal(desktop.isWindowVisible(1), true);
});

test("a minimized target with the plugin restores before bounds and focus", async () => {
	const { win, desktop, actions } = fixture();
	const native = expandedTarget(actions, {
		minimized: true,
		fullscreen: true,
	});
	const source = new Handoff(win, desktop, "a", 500);
	const target = new Handoff(win, connectTarget(native), "b");
	const result = source.switchTo("b", "keep-open");
	const preparation = target.receive(true);
	assert.deepEqual(actions, ["restore"]);
	native.finishRestore();
	await Promise.resolve();
	assert.deepEqual(actions, ["restore", "exit fullscreen"]);
	native.finishFullscreenExit();
	await preparation;
	assert.equal(await result, "ok");
	assert.deepEqual(actions, [
		"restore",
		"exit fullscreen",
		"unmaximize",
		"bounds",
		"/b/Same",
		"hide 1",
	]);
});

test("a target restored before the listener is attached still accepts the handoff", async () => {
	const { win, desktop, actions } = fixture();
	const native = expandedTarget(actions, { minimized: true });
	const once = native.once;
	native.once = function (event, listener) {
		if (event === "restore") {
			native.finishRestore();
		}
		return once.call(this, event, listener);
	};
	const source = new Handoff(win, desktop, "a", 150);
	const target = new Handoff(win, connectTarget(native), "b");
	win.addEventListener("storage", () => void target.receive(true));
	assert.equal(await source.switchTo("b", "keep-open"), "ok");
	assert.deepEqual(actions, ["unmaximize", "bounds", "/b/Same", "hide 1"]);
});

test("switching to a vault without the plugin closes the source and its hidden predecessors", async () => {
	const { win, desktop, actions } = fixture();
	const thirdVault = { id: "c", name: "Third", path: "/c/Third", open: true };
	const first = new Handoff(win, desktop, "a");
	const second = new Handoff(
		win,
		{
			...desktop,
			windowId: 2,
			list: () => [...vaults, thirdVault],
			findWindowWithoutPlugin: async (id) => (id === "c" ? 3 : undefined),
		},
		"b",
	);
	win.addEventListener(
		"storage",
		(event) => void second.receive(true, event),
	);

	assert.equal(await first.switchTo("b", "keep-open"), "ok");
	assert.equal(desktop.isWindowVisible(1), false);
	actions.length = 0;
	assert.equal(await second.switchTo("c", "keep-open"), "ok");
	assert.deepEqual(actions, ["bounds", "/c/Third", "close 2", "close 1"]);
});

test("closing the active vault closes every vault hidden by preceding switches", async () => {
	const { win, desktop, actions } = fixture();
	const thirdVault = { id: "c", name: "Third", path: "/c/Third", open: true };
	const first = new Handoff(win, desktop, "a");
	const secondDesktop = {
		...desktop,
		windowId: 2,
		list: () => [...vaults, thirdVault],
	};
	const second = new Handoff(win, secondDesktop, "b");
	const thirdDesktop = { ...desktop, windowId: 3 };
	const third = new Handoff(win, thirdDesktop, "c");
	win.addEventListener("storage", (event) => {
		for (const handoff of [first, second, third]) {
			handoff.receive(true, event);
		}
	});

	assert.equal(await first.switchTo("b", "keep-open"), "ok");
	assert.equal(await second.switchTo("c", "keep-open"), "ok");
	assert.equal(desktop.isWindowVisible(1), false);
	assert.equal(desktop.isWindowVisible(2), false);

	actions.length = 0;
	thirdDesktop.close();
	assert.deepEqual(actions, ["close 3", "close 2", "close 1"]);
});

test("a new switch replaces the old close listener even before DOM focus is delivered", async () => {
	const { win, desktop, actions } = fixture();
	const thirdVault = { id: "c", name: "Third", path: "/c/Third", open: true };
	const first = new Handoff(
		win,
		{ ...desktop, list: () => [...vaults, thirdVault] },
		"a",
	);
	const secondDesktop = { ...desktop, windowId: 2 };
	const second = new Handoff(win, secondDesktop, "b");
	const thirdDesktop = { ...desktop, windowId: 3 };
	const third = new Handoff(win, thirdDesktop, "c");
	win.addEventListener("storage", (event) => {
		for (const handoff of [first, second, third]) {
			handoff.receive(true, event);
		}
	});

	assert.equal(await first.switchTo("b", "keep-open"), "ok");
	assert.equal(await second.switchTo("a", "keep-open"), "ok");
	assert.equal(await first.switchTo("c", "keep-open"), "ok");

	actions.length = 0;
	secondDesktop.close();
	assert.deepEqual(actions, ["close 2"]);
});

test("closing the old target leaves a restored vault open", async () => {
	const { win, desktop, actions } = fixture({ asyncStorage: true });
	const source = new Handoff(win, desktop, "a");
	const targetDesktop = { ...desktop, windowId: 2 };
	const target = new Handoff(win, targetDesktop, "b");
	win.addEventListener("storage", (event) => {
		source.receive(true, event);
		target.receive(true, event);
	});

	assert.equal(await source.switchTo("b", "keep-open"), "ok");
	assert.equal(await target.switchTo("a", "focus"), "ok");
	assert.equal(desktop.isWindowVisible(1), true);

	actions.length = 0;
	targetDesktop.close();
	assert.deepEqual(actions, ["close 2"]);
});

test("an older destination can replace the source but cannot leave it hidden", async () => {
	const { win, desktop, actions } = fixture();
	const source = new Handoff(win, desktop, "a");
	win.addEventListener("storage", ({ key, newValue }) => {
		if (key === "vault-dock:request") {
			const { id } = JSON.parse(newValue);
			win.localStorage.setItem(
				"vault-dock:reply",
				JSON.stringify({ id, status: "ready", windowId: 2 }),
			);
		}
	});
	assert.equal(await source.switchTo("b", "keep-open"), "failed");
	assert.deepEqual(actions, []);
	assert.equal(await source.switchTo("b", "replace"), "ok");
	assert.deepEqual(actions, ["/b/Same", "close 1"]);
});

test("focus mode opens by registered ID without moving either window or waiting for a target plugin", async () => {
	const { win, desktop, actions } = fixture();
	const source = new Handoff(win, desktop, "a");
	assert.equal(await source.switchTo("b", "focus"), "ok");
	assert.deepEqual(actions, ["focus b"]);
});

test("focus mode reveals a window previously hidden by the plugin without changing its geometry", async () => {
	const { win, desktop, actions } = fixture({ asyncStorage: true });
	const source = new Handoff(win, desktop, "a");
	const target = new Handoff(win, { ...desktop, windowId: 2 }, "b");
	win.addEventListener("storage", (event) => {
		source.receive(true, event);
		target.receive(true, event);
	});
	assert.equal(await source.switchTo("b", "keep-open"), "ok");
	actions.length = 0;
	assert.equal(await target.switchTo("a", "focus"), "ok");
	assert.deepEqual(actions, ["focus a", "show 1"]);
});

test("the stock sidebar menu shows the current mode and routes vault selections", async () => {
	const opened = [];
	const selected = [];
	const ipcRenderer = {
		sendSync(channel, path) {
			if (channel === "vault") {
				return { id: "a" };
			}
			opened.push(path);
			return true;
		},
	};
	const desktop = connectDesktop({
		electron: {
			ipcRenderer,
			remote: {
				BrowserWindow: { fromId: () => null, getAllWindows: () => [] },
			},
		},
		electronWindow: expandedTarget([]),
	});
	let mode = "keep-open";
	const menuType = {
		forEvent: () => ({
			items: [],
			addSeparator() {
				return this;
			},
			addItem(build) {
				const row = {};
				const item = {
					setTitle(title) {
						row.title = title;
						return this;
					},
					setChecked(checked) {
						row.checked = checked;
						return this;
					},
					setIsLabel() {
						return this;
					},
					onClick(callback) {
						row.click = callback;
						return this;
					},
				};
				build(item);
				this.items.push(row);
				return this;
			},
		}),
	};
	const document = {};
	const openMenu = async (type = "click", isVaultSwitcher = true) => {
		const menu = menuType.forEvent({
			type,
			currentTarget: {
				ownerDocument: document,
				matches: () => isVaultSwitcher,
			},
		});
		menu.addItem((item) =>
			item
				.setTitle("Vault B")
				.onClick(() =>
					ipcRenderer.sendSync("vault-open", "/b/Same", false),
				),
		);
		await Promise.resolve();
		return menu.items;
	};
	const stop = watchNativeVaultMenu(menuType, document, desktop, {
		readMode: () => mode,
		setMode: (next) => {
			mode = next;
		},
		selectVault: (path) => selected.push([path, mode]),
		t: (key) => key,
	});
	let rows = await openMenu();
	assert.deepEqual(
		rows.map(({ title, checked }) => [title, checked]),
		[
			["Vault B", undefined],
			["switchingMode", undefined],
			["hideCurrentWindow", true],
			["closeCurrentWindow", false],
			["keepBothWindowsOpen", false],
		],
	);
	rows.find(({ title }) => title === "closeCurrentWindow").click();
	rows = await openMenu();
	assert.equal(
		rows.find(({ title }) => title === "closeCurrentWindow").checked,
		true,
	);
	rows[0].click();
	assert.deepEqual(selected, [["/b/Same", "replace"]]);
	assert.deepEqual(opened, []);
	for (const [type, isVaultSwitcher] of [
		["contextmenu", true],
		["click", false],
	]) {
		const otherRows = await openMenu(type, isVaultSwitcher);
		assert.equal(otherRows.length, 1);
		otherRows[0].click();
	}
	mode = undefined;
	rows = await openMenu();
	assert.equal(rows.length, 1);
	rows[0].click();
	mode = "replace";
	stop();
	rows = await openMenu();
	assert.equal(rows.length, 1);
	rows[0].click();
	assert.deepEqual(selected, [["/b/Same", "replace"]]);
	assert.deepEqual(opened, Array(4).fill("/b/Same"));
});

test("open or focus uses the current instance before falling back to an encoded URI", async () => {
	const opened = [];
	let canOpenNatively = true;
	const desktop = connectDesktop({
		electron: {
			ipcRenderer: {
				sendSync(channel, ...args) {
					if (channel === "vault") {
						return { id: "current" };
					}
					opened.push([channel, ...args]);
					return canOpenNatively;
				},
			},
			remote: { BrowserWindow: { fromId: () => null } },
		},
		electronWindow: {
			id: 1,
			getBounds: () => bounds,
			setBounds() {},
			isMaximized: () => false,
			isMinimized: () => false,
			isFullScreen: () => false,
		},
		require(id) {
			assert.equal(id, "electron");
			return { shell: { openExternal: async (uri) => opened.push(uri) } };
		},
	});
	const target = { ...vaults[1], id: "b &next=other" };
	await desktop.openOrFocus(target);
	assert.deepEqual(opened, [["vault-open", target.path, false]]);
	canOpenNatively = false;
	opened.length = 0;
	await desktop.openOrFocus(target);
	assert.deepEqual(opened, [
		["vault-open", target.path, false],
		"obsidian://open?vault=b%20%26next%3Dother",
	]);
});

function vaultRenderer(
	appId,
	{
		layoutReady = true,
		plugin = null,
		enabled = false,
		restricted = false,
		href = vaultPage,
		onProbe,
	} = {},
) {
	const window = {};
	window.app = {
		appId,
		workspace: {
			layoutReady,
			containerEl: { ownerDocument: { defaultView: window } },
		},
		plugins: {
			getPlugin: (id) => (id === "vault-dock" ? plugin : null),
			enabledPlugins: new Set(enabled ? ["vault-dock"] : []),
			isEnabled: () => !restricted,
		},
	};
	return {
		getURL: () => href,
		async executeJavaScript(code) {
			onProbe?.();
			return runInNewContext(code, { window, location: { href } });
		},
	};
}

test("the native fallback finds the ready vault even if another candidate hangs", async () => {
	const targetId = 'b"\\';
	const probed = [];
	const candidate = (
		id,
		appId,
		layoutReady,
		plugin,
		href = vaultPage,
		enabled = false,
	) => ({
		id,
		isDestroyed: () => false,
		isVisible: () => true,
		isMinimized: () => false,
		webContents: vaultRenderer(appId, {
			layoutReady,
			plugin,
			enabled,
			href,
			onProbe: () => probed.push(id),
		}),
	});
	const candidates = [
		candidate(2, targetId, true, null, "https://example.com"),
		candidate(3, "same-name-other-vault", true, null),
		candidate(4, targetId, false, null),
		candidate(5, targetId, true, {}),
		candidate(9, targetId, true, null, vaultPage, true),
		candidate(6, targetId, true, null),
		candidate(8, "same-name-other-vault", true, null),
	];
	const stalled = Promise.withResolvers();
	let stalledChecks = 0;
	candidates[1].webContents.executeJavaScript = () => {
		stalledChecks++;
		return stalled.promise;
	};
	const desktop = connectDesktop({
		setTimeout,
		clearTimeout,
		setInterval,
		clearInterval,
		electron: {
			ipcRenderer: { sendSync: () => ({ id: "a" }) },
			remote: {
				BrowserWindow: {
					fromId: () => null,
					getAllWindows: () => candidates,
				},
			},
		},
		electronWindow: {
			id: 1,
			getBounds: () => bounds,
			setBounds() {},
			isMaximized: () => false,
			isMinimized: () => false,
			isFullScreen: () => false,
		},
	});
	const signal = new AbortController().signal;
	assert.equal(
		await Promise.race([
			desktop.findWindowWithoutPlugin(targetId, Date.now() + 500, signal),
			new Promise((resolve) => setTimeout(() => resolve("stalled"), 250)),
		]),
		6,
	);
	assert.deepEqual(probed, [4, 5, 9, 6, 8]);
	assert.equal(stalledChecks, 1);
	stalled.resolve(false);

	candidates.splice(
		0,
		candidates.length,
		candidate(9, targetId, true, null, vaultPage, true),
		{
			...candidate(10, targetId, true, null),
			webContents: vaultRenderer(targetId, {
				enabled: true,
				restricted: true,
			}),
		},
	);
	assert.equal(
		await desktop.findWindowWithoutPlugin(
			targetId,
			Date.now() + 200,
			signal,
		),
		10,
	);

	candidates.length = 0;
	const waiting = Promise.withResolvers();
	const pending = candidate(7, targetId, true, null);
	let checks = 0;
	pending.webContents.executeJavaScript = () => {
		checks++;
		return waiting.promise;
	};
	candidates.push(pending);
	const controller = new AbortController();
	const search = desktop.findWindowWithoutPlugin(
		targetId,
		Date.now() + 500,
		controller.signal,
	);
	await new Promise((resolve) => setTimeout(resolve, 130));
	controller.abort();
	assert.equal(
		await Promise.race([
			search,
			new Promise((resolve) =>
				setTimeout(() => resolve("still running"), 50),
			),
		]),
		undefined,
	);
	const nextSearch = desktop.findWindowWithoutPlugin(
		targetId,
		Date.now() + 500,
		signal,
	);
	assert.equal(checks, 1);
	waiting.resolve(true);
	assert.equal(await nextSearch, 7);
	assert.equal(checks, 2);
});

function fallbackSwitch({ visibleWhenMinimized, timeout }) {
	const { win, actions } = fixture();
	const native = expandedTarget(actions, {
		minimized: true,
		visibleWhenMinimized,
	});
	const started = Promise.withResolvers();
	const restore = native.restore;
	native.restore = () => {
		restore();
		started.resolve();
	};
	native.webContents = vaultRenderer("b");
	let focused = false;
	native.isFocused = () => focused;
	const desktop = connectDesktop({
		close: () => actions.push("close source"),
		setTimeout,
		clearTimeout,
		setInterval,
		clearInterval,
		electron: {
			ipcRenderer: {
				sendSync(channel) {
					if (channel === "vault") {
						return { id: "a" };
					}
					if (channel === "vault-list") {
						return { b: { path: "/b/Same", open: true } };
					}
					assert.equal(channel, "vault-open");
					actions.push("focus");
					focused = true;
					return true;
				},
			},
			remote: {
				BrowserWindow: {
					fromId: (id) => (id === native.id ? native : null),
					getAllWindows: () => [native],
				},
			},
		},
		electronWindow: {
			id: 1,
			getBounds: () => bounds,
			setBounds() {},
			isMaximized: () => false,
			isMinimized: () => false,
			isFullScreen: () => false,
		},
	});
	const source = new Handoff(win, desktop, "a", timeout);
	return {
		native,
		actions,
		started: started.promise,
		result: source.switchTo("b", "keep-open"),
	};
}

for (const visibleWhenMinimized of [false, true]) {
	test(`a minimized target without the plugin restores before bounds and focus (visible=${visibleWhenMinimized})`, async () => {
		const { native, actions, started, result } = fallbackSwitch({
			visibleWhenMinimized,
			timeout: 500,
		});
		assert.equal(await Promise.race([started, result]), undefined);
		assert.deepEqual(actions, ["restore"]);
		native.finishRestore();
		assert.equal(await result, "ok");
		assert.deepEqual(actions, [
			"restore",
			"unmaximize",
			"bounds",
			"focus",
			"close source",
		]);
	});
}

test("a restore timeout leaves the source open and ignores a late restore", async () => {
	const { native, actions, result } = fallbackSwitch({
		visibleWhenMinimized: false,
		timeout: 100,
	});
	assert.equal(await result, "timeout");
	assert.equal(native.listenerCount("restore"), 0);
	assert.equal(native.listenerCount("closed"), 0);
	native.finishRestore();
	assert.deepEqual(actions, ["restore"]);
});
