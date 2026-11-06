import {
	PluginSettingTab,
	type Plugin,
	type SettingDefinitionItem,
} from "obsidian";
import {
	isLanguagePreference,
	LANGUAGE_NAMES,
	type LanguagePreference,
	type Translate,
} from "./i18n";
import type { SettingsSnapshot } from "./settings-store";
import {
	DEFAULT_SWITCHING_MODE,
	isSwitchingMode,
	type SwitchingMode,
} from "./switching-mode";

type SettingsChange =
	| { mode: SwitchingMode }
	| { shared: boolean }
	| { language: LanguagePreference };

/** Bind Obsidian's settings controls to the currently selected settings scope. */
export class SwitcherSettingsTab extends PluginSettingTab {
	constructor(
		plugin: Plugin,
		private readonly read: () => SettingsSnapshot | undefined,
		private readonly save: (
			change: SettingsChange,
			scopeRevision: number,
		) => Promise<void>,
		private readonly t: Translate,
	) {
		super(plugin.app, plugin);
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		const disabled = () => !this.read();
		return [
			{
				name: this.t("language"),
				desc: this.t("languageDescription"),
				control: {
					type: "dropdown",
					key: "language",
					options: {
						system: this.t("systemLanguage"),
						...LANGUAGE_NAMES,
					},
					defaultValue: "system",
					disabled,
				},
			},
			{
				name: this.t("shareSettings"),
				desc: this.t("shareSettingsDescription"),
				control: {
					type: "toggle",
					key: "shared",
					defaultValue: true,
					disabled,
				},
			},
			{
				name: this.t("switchingMode"),
				desc: this.t("switchingModeDescription"),
				control: {
					type: "dropdown",
					key: "mode",
					options: {
						replace: this.t("replaceWindow"),
						"keep-open": this.t("keepWindowsOpen"),
						focus: this.t("openOrFocus"),
					} satisfies Record<SwitchingMode, string>,
					defaultValue: DEFAULT_SWITCHING_MODE,
					disabled,
				},
			},
		];
	}

	getControlValue(key: string): unknown {
		const settings = this.read();
		if (key === "mode") {
			return settings?.mode;
		}
		if (key === "shared") {
			return settings?.shared;
		}
		if (key === "language") {
			return settings?.language;
		}
		return undefined;
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		const settings = this.read();
		if (!settings) {
			return;
		}
		if (key === "mode" && isSwitchingMode(value)) {
			await this.save({ mode: value }, settings.scopeRevision);
		}
		if (key === "shared" && typeof value === "boolean") {
			await this.save({ shared: value }, settings.scopeRevision);
		}
		if (key === "language" && isLanguagePreference(value)) {
			await this.save({ language: value }, settings.scopeRevision);
		}
	}
}
