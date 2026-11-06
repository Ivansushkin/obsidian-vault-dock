import assert from "node:assert/strict";
import { buildSync } from "esbuild";
import test from "node:test";
import { runInNewContext } from "node:vm";

test("the settings tab localizes its controls and saves valid changes", async () => {
	const bundle = buildSync({
		stdin: {
			contents: `
				export { getMessages } from "./src/i18n";
				export { SwitcherSettingsTab } from "./src/settings-tab";
			`,
			resolveDir: process.cwd(),
		},
		bundle: true,
		write: false,
		format: "cjs",
		external: ["obsidian"],
	}).outputFiles[0].text;
	const module = { exports: {} };
	runInNewContext(bundle, {
		module,
		require: () => ({ PluginSettingTab: class {} }),
	});
	const { getMessages, SwitcherSettingsTab } = module.exports;
	const writes = [];
	const settings = {
		mode: "replace",
		shared: true,
		scopeRevision: 3,
		language: "system",
	};
	let messages = getMessages(settings.language, "ru-RU");
	const tab = new SwitcherSettingsTab(
		{},
		() => settings,
		async (change, revision) =>
			writes.push([JSON.stringify(change), revision]),
		(key) => messages[key],
	);
	const definitions = tab.getSettingDefinitions();
	assert.deepEqual(
		Array.from(definitions, ({ control }) => control.key),
		["language", "shared", "mode"],
	);
	const [language, sharing, mode] = definitions;
	assert.deepEqual(Object.keys(mode.control.options), [
		"replace",
		"keep-open",
		"focus",
	]);
	assert.equal(sharing.control.type, "toggle");
	assert.equal(mode.name, "Режим переключения");
	assert.equal(mode.control.options.replace, "Заменять окно");
	assert.equal(language.control.options.system, "Как в Obsidian");
	assert.deepEqual(Object.keys(language.control.options), [
		"system",
		"en",
		"ru",
		"kk",
		"be",
		"uz",
		"zh",
		"zh-TW",
		"ja",
	]);
	assert.equal(language.control.options.zh, "简体中文");
	assert.equal(language.control.options["zh-TW"], "繁體中文");
	assert.equal(language.control.options.ja, "日本語");
	assert.equal(tab.getControlValue("mode"), "replace");
	assert.equal(tab.getControlValue("shared"), true);
	assert.equal(tab.getControlValue("language"), "system");
	await tab.setControlValue("mode", "keep-open");
	await tab.setControlValue("shared", false);
	await tab.setControlValue("language", "ru");
	await tab.setControlValue("language", "zh");
	await tab.setControlValue("language", "zh-TW");
	await tab.setControlValue("language", "ja");
	await tab.setControlValue("language", "unsupported");
	assert.deepEqual(writes, [
		['{"mode":"keep-open"}', 3],
		['{"shared":false}', 3],
		['{"language":"ru"}', 3],
		['{"language":"zh"}', 3],
		['{"language":"zh-TW"}', 3],
		['{"language":"ja"}', 3],
	]);
	messages = getMessages("system", "fr");
	assert.equal(tab.getSettingDefinitions()[2].name, "Switching mode");
	messages = getMessages("ru", "en");
	assert.equal(tab.getSettingDefinitions()[2].name, "Режим переключения");

	assert.equal(getMessages("system", "zh").vaults, "仓库");
	assert.equal(getMessages("system", "zh-TW").vaults, "儲存庫");
	assert.equal(getMessages("system", "zh_Hant").vaults, "儲存庫");
	assert.equal(getMessages("system", "ja-JP").vaults, "保管庫");
	assert.equal(getMessages("zh-TW", "zh").vaults, "儲存庫");
});
