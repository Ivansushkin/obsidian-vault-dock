import { type App, Modal, Setting } from "obsidian";
import type { Translate } from "./i18n";
import {
	DEFAULT_PLACEHOLDER_COLORS,
	PALETTE,
	type PaletteName,
	type PlaceholderColors,
} from "./placeholder-colors";

/** Preview a draft color pair before applying it to a vault tile. */
export class PlaceholderColorModal extends Modal {
	private draft: PlaceholderColors;

	constructor(
		app: App,
		private readonly initials: string,
		colors: PlaceholderColors | undefined,
		private readonly t: Translate,
		private readonly apply: (colors: PlaceholderColors) => void,
		private readonly dismiss: () => void,
	) {
		super(app);
		this.draft = { ...(colors ?? DEFAULT_PLACEHOLDER_COLORS) };
	}

	onOpen(): void {
		const { contentEl, t } = this;
		this.setTitle(t("chooseColor"));
		contentEl.createEl("p", { text: t("placeholderColorDescription") });
		const preview = contentEl.createDiv({
			cls: "vault-switcher-color-preview",
			text: this.initials,
			attr: { "aria-hidden": "true" },
		});
		const updatePreview = () => {
			preview.style.backgroundColor = this.draft.background;
			preview.style.color = this.draft.text;
		};
		updatePreview();
		this.addPalette(
			"background",
			t("placeholderBackground"),
			updatePreview,
		);
		this.addPalette("text", t("placeholderText"), updatePreview);

		new Setting(contentEl)
			.addButton((button) =>
				button
					.setButtonText(t("cancelColor"))
					.onClick(() => this.close()),
			)
			.addButton((button) =>
				button
					.setButtonText(t("applyColor"))
					.setCta()
					.onClick(() => {
						this.close();
						this.apply(this.draft);
					}),
			);
	}

	/** Group each palette into native radio controls for keyboard navigation. */
	private addPalette(
		key: keyof PlaceholderColors,
		title: string,
		updatePreview: () => void,
	): void {
		const group = this.contentEl.createEl("fieldset", {
			cls: "vault-switcher-color-palette",
		});
		group.createEl("legend", { text: title });
		const swatches = group.createDiv("vault-switcher-color-swatches");
		for (const name of Object.keys(PALETTE) as PaletteName[]) {
			const color = PALETTE[name];
			const transparent = color === PALETTE.transparent;
			if (transparent && key === "text") {
				continue;
			}
			const colorName = this.t("colorNames")[name];
			const label = swatches.createEl("label", {
				attr: { title: colorName },
			});
			const input = label.createEl("input", {
				attr: {
					type: "radio",
					name: `vault-switcher-color-${key}`,
					"aria-label": colorName,
				},
			});
			input.checked = this.draft[key] === color;
			const swatch = label.createSpan();
			swatch.classList.toggle(
				"vault-switcher-color-transparent",
				transparent,
			);
			swatch.style.backgroundColor = color;
			input.addEventListener("change", () => {
				if (input.checked) {
					this.draft = { ...this.draft, [key]: color };
					updatePreview();
				}
			});
		}
	}

	onClose(): void {
		this.contentEl.empty();
		this.dismiss();
	}
}
