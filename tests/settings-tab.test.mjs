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
		hideLabels: false,
		barPosition: "right",
		tileScale: 115,
	};
	let messages = getMessages(settings.language, "ru-RU");
	const tab = new SwitcherSettingsTab(
		{},
		() => settings,
		async (change, revision) =>
			writes.push([JSON.stringify(change), revision]),
		(key) => messages[key],
	);
	const groups = tab.getSettingDefinitions();
	assert.deepEqual(
		Array.from(groups, ({ type, heading, items }) => [
			type,
			heading,
			Array.from(items ?? [], ({ control }) => control.key),
		]),
		[
			["group", "Общие", ["language", "shared", "mode"]],
			["group", "UI", ["hideLabels", "barPosition", "tileScale"]],
		],
	);
	const [general, ui] = groups;
	const [language, sharing, mode] = general.items;
	const [labels, barPosition, tileScale] = ui.items;
	assert.equal(tileScale.name, "Размер плиток");
	assert.equal(tileScale.control.type, "slider");
	assert.equal(tileScale.control.min, 75);
	assert.equal(tileScale.control.max, 150);
	assert.equal(tileScale.control.step, 5);
	assert.equal(tileScale.control.defaultValue, 100);
	assert.equal(tileScale.control.displayFormat(115), "115%");
	assert.deepEqual(Object.entries(mode.control.options), [
		["keep-open", "Скрывать текущее окно"],
		["replace", "Закрывать текущее окно"],
		["focus", "Оставлять оба окна открытыми"],
	]);
	assert.equal(mode.control.defaultValue, "keep-open");
	assert.equal(sharing.control.type, "toggle");
	assert.equal(labels.control.type, "toggle");
	assert.equal(labels.control.defaultValue, false);
	assert.equal(labels.name, "Скрывать подписи хранилищ");
	assert.equal(barPosition.name, "Положение панели");
	assert.equal(barPosition.control.type, "dropdown");
	assert.equal(barPosition.control.defaultValue, "top");
	assert.deepEqual(Object.entries(barPosition.control.options), [
		["top", "Сверху"],
		["bottom", "Снизу"],
		["left", "Слева"],
		["right", "Справа"],
	]);
	assert.equal(mode.name, "Режим переключения");
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
	assert.equal(tab.getControlValue("hideLabels"), false);
	assert.equal(tab.getControlValue("barPosition"), "right");
	assert.equal(tab.getControlValue("tileScale"), 115);
	await tab.setControlValue("mode", "keep-open");
	await tab.setControlValue("shared", false);
	await tab.setControlValue("language", "ru");
	await tab.setControlValue("language", "zh");
	await tab.setControlValue("language", "zh-TW");
	await tab.setControlValue("language", "ja");
	await tab.setControlValue("language", "unsupported");
	await tab.setControlValue("hideLabels", true);
	await tab.setControlValue("hideLabels", "false");
	await tab.setControlValue("barPosition", "top");
	await tab.setControlValue("barPosition", "bottom");
	await tab.setControlValue("barPosition", "left");
	await tab.setControlValue("barPosition", "right");
	await tab.setControlValue("barPosition", "unsupported");
	await tab.setControlValue("barPosition", true);
	for (const scale of [75, 150, 100]) {
		await tab.setControlValue("tileScale", scale);
	}
	for (const invalidScale of [74, 151, 101, 102.5, "100", NaN, Infinity]) {
		await tab.setControlValue("tileScale", invalidScale);
	}
	assert.deepEqual(writes, [
		['{"mode":"keep-open"}', 3],
		['{"shared":false}', 3],
		['{"profile":["language","ru"]}', 3],
		['{"profile":["language","zh"]}', 3],
		['{"profile":["language","zh-TW"]}', 3],
		['{"profile":["language","ja"]}', 3],
		['{"profile":["hideLabels",true]}', 3],
		['{"profile":["barPosition","top"]}', 3],
		['{"profile":["barPosition","bottom"]}', 3],
		['{"profile":["barPosition","left"]}', 3],
		['{"profile":["barPosition","right"]}', 3],
		['{"profile":["tileScale",75]}', 3],
		['{"profile":["tileScale",150]}', 3],
		['{"profile":["tileScale",100]}', 3],
	]);
	messages = getMessages("system", "fr");
	const [englishGeneral, englishUi] = tab.getSettingDefinitions();
	assert.equal(englishGeneral.heading, "General");
	assert.equal(englishUi.heading, "UI");
	const englishPosition = englishUi.items[1];
	assert.equal(englishPosition.name, "Bar position");
	assert.deepEqual(Object.entries(englishPosition.control.options), [
		["top", "Top"],
		["bottom", "Bottom"],
		["left", "Left"],
		["right", "Right"],
	]);
	const englishMode = englishGeneral.items[2];
	assert.equal(englishMode.name, "Switching mode");
	assert.deepEqual(Object.entries(englishMode.control.options), [
		["keep-open", "Hide current window"],
		["replace", "Close current window"],
		["focus", "Keep both windows open"],
	]);
	messages = getMessages("ru", "en");
	assert.equal(
		tab.getSettingDefinitions()[0].items[2].name,
		"Режим переключения",
	);

	assert.equal(getMessages("system", "zh").vaults, "仓库");
	assert.equal(getMessages("system", "zh-TW").vaults, "儲存庫");
	assert.equal(getMessages("system", "zh_Hant").vaults, "儲存庫");
	assert.equal(getMessages("system", "ja-JP").vaults, "保管庫");
	assert.equal(getMessages("zh-TW", "zh").vaults, "儲存庫");
});
