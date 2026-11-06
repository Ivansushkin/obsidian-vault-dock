import {
	PluginSettingTab,
	type Plugin,
	type SettingDefinitionItem,
} from "obsidian";
import {
	DEFAULT_BAR_POSITION,
	isBarPosition,
	type BarPosition,
} from "./bar-position";
import { isLanguagePreference, LANGUAGE_NAMES, type Translate } from "./i18n";
import type { ProfileSettingChange, SettingsSnapshot } from "./settings-store";
import {
	DEFAULT_SWITCHING_MODE,
	isSwitchingMode,
	switchingModeLabels,
	type SwitchingMode,
} from "./switching-mode";
import {
	DEFAULT_TILE_SCALE,
	isTileScale,
	MAX_TILE_SCALE,
	MIN_TILE_SCALE,
	TILE_SCALE_STEP,
} from "./tile-scale";

type SettingsChange =
	| { mode: SwitchingMode }
	| { shared: boolean }
	| { profile: ProfileSettingChange };

const CONTROL_KEYS = {
	mode: true,
	shared: true,
	language: true,
	hideLabels: true,
	barPosition: true,
	tileScale: true,
} satisfies Record<"mode" | "shared" | ProfileSettingChange[0], true>;

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

	/** Keep the size slider focused when Obsidian rebuilds the settings tab. */
	update(): void {
		const selector = 'input[type="range"]';
		const focused =
			this.containerEl.querySelector(selector) ===
			this.containerEl.ownerDocument.activeElement;
		super.update();
		if (focused) {
			this.containerEl
				.querySelector<HTMLInputElement>(selector)
				?.focus({ preventScroll: true });
		}
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		const disabled = () => !this.read();
		return [
			{
				type: "group",
				heading: this.t("generalSettings"),
				items: [
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
							options: switchingModeLabels(this.t),
							defaultValue: DEFAULT_SWITCHING_MODE,
							disabled,
						},
					},
				],
			},
			{
				type: "group",
				heading: "UI",
				items: [
					{
						name: this.t("hideLabels"),
						desc: this.t("hideLabelsDescription"),
						control: {
							type: "toggle",
							key: "hideLabels",
							defaultValue: false,
							disabled,
						},
					},
					{
						name: this.t("barPosition"),
						desc: this.t("barPositionDescription"),
						control: {
							type: "dropdown",
							key: "barPosition",
							options: {
								top: this.t("barTop"),
								bottom: this.t("barBottom"),
								left: this.t("barLeft"),
								right: this.t("barRight"),
							} satisfies Record<BarPosition, string>,
							defaultValue: DEFAULT_BAR_POSITION,
							disabled,
						},
					},
					{
						name: this.t("tileScale"),
						desc: this.t("tileScaleDescription"),
						control: {
							type: "slider",
							key: "tileScale",
							min: MIN_TILE_SCALE,
							max: MAX_TILE_SCALE,
							step: TILE_SCALE_STEP,
							defaultValue: DEFAULT_TILE_SCALE,
							displayFormat: (value) => `${value}%`,
							disabled,
						},
					},
				],
			},
		];
	}

	getControlValue(key: string): unknown {
		if (Object.hasOwn(CONTROL_KEYS, key)) {
			return this.read()?.[key as keyof typeof CONTROL_KEYS];
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
			await this.save({ profile: [key, value] }, settings.scopeRevision);
		}
		if (key === "hideLabels" && typeof value === "boolean") {
			await this.save({ profile: [key, value] }, settings.scopeRevision);
		}
		if (key === "barPosition" && isBarPosition(value)) {
			await this.save({ profile: [key, value] }, settings.scopeRevision);
		}
		if (key === "tileScale" && isTileScale(value)) {
			await this.save({ profile: [key, value] }, settings.scopeRevision);
		}
	}
}
