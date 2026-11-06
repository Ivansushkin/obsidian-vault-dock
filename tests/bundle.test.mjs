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

test("the bundle ships the matching desktop manifest and stylesheet", () => {
	const pkg = JSON.parse(readFileSync("package.json", "utf8"));
	const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
	assert.equal(manifest.version, pkg.version);
	assert.equal(manifest.isDesktopOnly, true);
	for (const asset of ["manifest.json", "styles.css"]) {
		assert.deepEqual(readFileSync(`build/${asset}`), readFileSync(asset));
	}
});
