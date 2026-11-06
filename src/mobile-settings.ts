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
import {
	DEFAULT_TILE_SCALE,
	isTileScale,
	MAX_TILE_SCALE,
	MIN_TILE_SCALE,
	TILE_SCALE_STEP,
} from "./tile-scale";

export type MobileSettings = {
	language: LanguagePreference;
	hideLabels: boolean;
	tileScale: number;
};

/** Load supported appearance settings and supply defaults for missing values. */
export function readMobileSettings(data: unknown): MobileSettings {
	const saved =
		data && typeof data === "object"
			? (data as Partial<MobileSettings>)
			: {};
	return {
		language: isLanguagePreference(saved.language)
			? saved.language
			: "system",
		hideLabels: saved.hideLabels === true,
		tileScale: isTileScale(saved.tileScale)
			? saved.tileScale
			: DEFAULT_TILE_SCALE,
	};
}

type SaveSettings = (
	change: (current: MobileSettings) => MobileSettings,
) => Promise<void>;

/** Edit mobile appearance using Obsidian's native controls. */
export class MobileSettingsTab extends PluginSettingTab {
	constructor(
		plugin: Plugin,
		private readonly read: () => MobileSettings,
		private readonly save: SaveSettings,
		private readonly t: Translate,
	) {
		super(plugin.app, plugin);
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		const t = this.t;
		return [
			{
				name: t("language"),
				control: {
					type: "dropdown",
					key: "language",
					options: { system: t("systemLanguage"), ...LANGUAGE_NAMES },
					defaultValue: "system",
				},
			},
			{
				name: t("hideLabels"),
				control: {
					type: "toggle",
					key: "hideLabels",
					defaultValue: false,
				},
			},
			{
				name: t("tileScale"),
				control: {
					type: "slider",
					key: "tileScale",
					min: MIN_TILE_SCALE,
					max: MAX_TILE_SCALE,
					step: TILE_SCALE_STEP,
					defaultValue: DEFAULT_TILE_SCALE,
					displayFormat: (value) => `${value}%`,
				},
			},
		];
	}

	getControlValue(key: string): unknown {
		if (key === "language" || key === "hideLabels" || key === "tileScale") {
			return this.read()[key];
		}
		return undefined;
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		if (
			(key === "language" && isLanguagePreference(value)) ||
			(key === "hideLabels" && typeof value === "boolean") ||
			(key === "tileScale" && isTileScale(value))
		) {
			await this.save((current) => ({ ...current, [key]: value }));
		}
	}
}
