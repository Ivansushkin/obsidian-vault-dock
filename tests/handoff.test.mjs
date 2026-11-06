import assert from "node:assert/strict";
import { buildSync } from "esbuild";
import test from "node:test";

const bundle = buildSync({
	stdin: {
		contents:
			'export { Handoff } from "./src/handoff.ts"; export { connectDesktop } from "./src/desktop.ts";',
		resolveDir: process.cwd(),
	},
	bundle: true,
	write: false,
	format: "esm",
}).outputFiles[0].text;
const { Handoff, connectDesktop } = await import(
	`data:text/javascript,${encodeURIComponent(bundle)}`
);

const bounds = { x: 10, y: 20, width: 900, height: 650 };
const vaults = [
	{ id: "a", name: "Same", path: "/a/Same", open: true },
	{ id: "b", name: "Same", path: "/b/Same", open: true },
];
function fixture({ asyncStorage = false } = {}) {
	const storage = new Map();
	const events = new EventTarget();
	const nativeEvents = new EventTarget();
	let locked = false;
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
				async request(_name, _options, callback) {
					if (locked) {
						return callback(null);
					}
					locked = true;
					try {
						return await callback({});
					} finally {
						locked = false;
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
		getBounds: () => bounds,
		setBounds: () => actions.push("bounds"),
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

test("an open destination applies bounds and becomes ready before focus and source close", async () => {
	const { win, desktop, actions } = fixture();
	const source = new Handoff(win, desktop, "a");
	const target = new Handoff(win, { ...desktop, windowId: 2 }, "b");
	win.addEventListener("storage", () => target.receive(false));
	const result = source.switchTo("b");
	assert.deepEqual(actions, ["bounds"]);
	assert.equal(await source.switchTo("b"), "busy");
	assert.equal(await target.switchTo("a"), "busy");
	target.receive(true);
	assert.equal(await result, "ok");
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
	const result = source.switchTo("b");
	assert.deepEqual(actions, ["/b/Same"]);
	target.receive(false);
	assert.deepEqual(actions, ["/b/Same", "bounds"]);
	target.receive(true);
	assert.equal(await result, "ok");
	assert.deepEqual(actions, ["/b/Same", "bounds", "close 1"]);
});

test("keeping windows open prepares and focuses the target before hiding the source, including on return", async () => {
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
	const result = source.switchTo("b", "keep-open");
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

test("a target that cannot take focus leaves the source visible", async () => {
	const { win, desktop, actions } = fixture();
	const source = new Handoff(
		win,
		{ ...desktop, isWindowFocused: () => false },
		"a",
		25,
	);
	const target = new Handoff(win, { ...desktop, windowId: 2 }, "b");
	win.addEventListener("storage", () => target.receive(true));
	assert.equal(await source.switchTo("b", "keep-open"), "failed");
	assert.deepEqual(actions, ["bounds", "/b/Same"]);
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
		if (key === "vault-switcher-bar:request") {
			const { id } = JSON.parse(newValue);
			win.localStorage.setItem(
				"vault-switcher-bar:reply",
				JSON.stringify({ id, status: "ready", windowId: 2 }),
			);
		}
	});
	assert.equal(await source.switchTo("b", "keep-open"), "failed");
	assert.deepEqual(actions, []);
	assert.equal(await source.switchTo("b"), "ok");
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
