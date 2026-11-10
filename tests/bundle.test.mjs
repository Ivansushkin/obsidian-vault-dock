import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";

test("the built entry point loads with the Obsidian API as an external dependency", () => {
	class Plugin {}
	class Modal {}
	class PluginSettingTab {}
	const module = { exports: {} };
	runInNewContext(readFileSync("build/main.js", "utf8"), {
		module,
		exports: module.exports,
		require(id) {
			assert.equal(id, "obsidian");
			return { Plugin, Modal, PluginSettingTab };
		},
	});
	assert.ok(module.exports.default.prototype instanceof Plugin);
});

test("the bundle ships the matching mobile-compatible manifest and stylesheet", () => {
	const pkg = JSON.parse(readFileSync("package.json", "utf8"));
	const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
	assert.equal(manifest.version, pkg.version);
	assert.equal(manifest.isDesktopOnly, false);
	for (const asset of ["manifest.json", "styles.css"]) {
		assert.deepEqual(readFileSync(`build/${asset}`), readFileSync(asset));
	}
});

test("the installed bundle contains eight distinct WebP presets", () => {
	const bundle = readFileSync("build/main.js", "utf8");
	const sources = new Set(
		Array.from(
			bundle.matchAll(/data:image\/webp;base64,([\w+/=]+)/gu),
			(match) => match[1],
		),
	);
	assert.equal(sources.size, 8);
	for (const source of sources) {
		const image = Buffer.from(source, "base64");
		assert.equal(image.toString("ascii", 0, 4), "RIFF");
		assert.equal(image.toString("ascii", 8, 16), "WEBPVP8L");
	}
});

test("the mobile bundle uses the native vault list and ignores old manual entries", async () => {
	const saved = [];
	const notices = [];
	const target = { vaultName: "Работа & заметки #2", name: "Test vault" };
	const win = {
		get electron() {
			throw new Error("The mobile branch accessed Electron");
		},
	};
	const buttons = [];
	const nativeSwitches = [];
	const native = {
		isConnected: true,
		options: [],
		value: "documents/Notes",
		contains: (node) => node === native,
		dispatchEvent(event) {
			assert.equal(event.type, "change");
			nativeSwitches.push(this.value);
		},
	};
	let currentSwitcher = null;
	const observed = new Map();
	class MutationObserver {
		constructor(callback) {
			this.callback = callback;
		}
		observe(target) {
			this.target = target;
			observed.set(target, this.callback);
		}
		disconnect() {
			observed.delete(this.target);
		}
	}
	const createHeader = () => ({
		isConnected: true,
		after(dock) {
			this.nextElementSibling = dock;
		},
		contains(node) {
			return node === this;
		},
		querySelector: () => currentSwitcher,
	});
	let header = createHeader();
	const document = {
		body: {},
		defaultView: win,
		querySelector: () => header,
		adoptNode(node) {
			node.ownerDocument = this;
			return node;
		},
	};
	const element = (parent) => ({
		classList: { toggle() {} },
		style: { setProperty() {} },
		addClass() {},
		setAttribute() {},
		createDiv: () => element(),
		createSpan: () => element(),
		createEl(tag, options) {
			const child = element(this);
			if (tag === "button") {
				child.label = options.attr["aria-label"];
				buttons.push(child);
			}
			return child;
		},
		addEventListener(type, listener) {
			if (type === "click") {
				this.click = listener;
			}
		},
		replaceChildren() {
			for (let index = buttons.length - 1; index >= 0; index--) {
				if (buttons[index].parent === this) {
					buttons.splice(index, 1);
				}
			}
		},
		remove() {},
		parent,
	});
	class Plugin {
		app = {
			workspace: {
				containerEl: {
					ownerDocument: document,
				},
				onLayoutReady: (mount) => mount(),
				on(type) {
					assert.equal(type, "layout-change");
				},
			},
		};
		loadData() {
			return Promise.resolve({
				targets: [target],
				language: "en",
				tileScale: 115,
			});
		}
		saveData(data) {
			saved.push(data);
			return Promise.resolve();
		}
		addSettingTab(tab) {
			this.tab = tab;
		}
		register(dispose) {
			this.dispose = dispose;
		}
		registerEvent() {}
	}
	class PluginSettingTab {
		update() {}
	}
	const module = { exports: {} };
	runInNewContext(readFileSync("build/main.js", "utf8"), {
		module,
		exports: module.exports,
		createDiv: (className) => ({ ...element(), className }),
		Event,
		MutationObserver,
		require(id) {
			assert.equal(id, "obsidian");
			return {
				Plugin,
				PluginSettingTab,
				Modal: class {},
				Notice: class {
					constructor(message) {
						notices.push(message);
					}
				},
				Platform: { isMobileApp: true },
				getLanguage: () => "en",
			};
		},
	});
	const plugin = new module.exports.default();
	await plugin.onload();
	assert.deepEqual(notices, []);
	assert.equal(header.nextElementSibling.ownerDocument, document);
	assert.equal(
		header.nextElementSibling.className,
		"vault-dock vault-dock-mobile",
	);
	assert.equal(header.nextElementSibling.hidden, true);
	assert.equal(buttons.length, 0);
	assert.deepEqual(
		Array.from(
			plugin.tab.getSettingDefinitions(),
			({ control }) => control?.key,
		),
		["language", "hideLabels", "tileScale"],
	);

	const observeStructure = observed.get(document.body);
	assert.equal(typeof observeStructure, "function");
	currentSwitcher = native;
	observeStructure([{ target: header }]);
	assert.equal(header.nextElementSibling.hidden, true);
	native.options.push(
		{ value: "documents/Notes", text: "Notes" },
		{ value: "icloud/Notes", text: "Notes" },
		{ value: "manage-vaults", text: "Manage vaults…" },
	);
	const onOptionsChanged = observed.get(native);
	assert.equal(typeof onOptionsChanged, "function");
	onOptionsChanged();
	assert.equal(header.nextElementSibling.hidden, false);
	assert.equal(buttons.length, 2);
	assert.deepEqual(
		buttons.map(({ label }) => label),
		["Notes (documents)", "Notes (icloud)"],
	);
	buttons[0].click();
	assert.deepEqual(nativeSwitches, []);
	buttons[1].click();
	assert.deepEqual(nativeSwitches, ["icloud/Notes"]);
	native.options = [];
	onOptionsChanged();
	assert.equal(header.nextElementSibling.hidden, true);
	assert.equal(buttons.length, 0);
	assert.equal(plugin.tab.getControlValue("mode"), undefined);
	await plugin.tab.setControlValue("hideLabels", true);
	assert.equal(saved.length, 1);
	assert.equal(saved[0].hideLabels, true);
	assert.equal(saved[0].language, "en");
	assert.equal(saved[0].tileScale, 115);
	assert.equal(Object.hasOwn(saved[0], "targets"), false);

	native.isConnected = false;
	currentSwitcher = {
		...native,
		isConnected: true,
		options: [
			{ value: "documents/Other", text: "Other" },
			{ value: "manage-vaults", text: "Manage vaults…" },
		],
	};
	observeStructure([{ target: header }]);
	assert.equal(observed.has(native), false);
	assert.equal(observed.has(currentSwitcher), true);
	assert.deepEqual(
		buttons.map(({ label }) => label),
		["Other"],
	);
	buttons[0].click();
	assert.deepEqual(nativeSwitches, ["icloud/Notes", "documents/Other"]);
	const removed = currentSwitcher;
	currentSwitcher = null;
	removed.isConnected = false;
	observeStructure([{ target: header }]);
	assert.equal(observed.has(removed), false);
	assert.equal(header.nextElementSibling.hidden, true);
	assert.equal(buttons.length, 0);
	header.isConnected = false;
	header = createHeader();
	currentSwitcher = native;
	native.isConnected = true;
	native.options = removed.options;
	observeStructure([{ target: document.body }]);
	assert.equal(header.nextElementSibling.hidden, false);
	assert.equal(buttons.length, 1);
	plugin.dispose();
	assert.equal(observed.size, 0);
});
