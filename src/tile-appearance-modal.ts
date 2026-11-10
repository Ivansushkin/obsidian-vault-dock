import { type App, Modal } from "obsidian";
import type { Translate } from "./i18n";
import {
	PALETTE,
	type PaletteName,
	type PlaceholderColors,
} from "./placeholder-colors";
import { SettingsScopeChangedError } from "./settings-store";
import {
	IMAGE_TYPES,
	TileAppearanceDraft,
	type TileAppearance,
	type TileAppearanceChange,
} from "./tile-appearance";
import { TILE_PRESETS, type PresetId } from "./tile-presets";

type TilePreview = {
	tile: HTMLButtonElement;
	name: string;
	initials: string;
	scale: string;
	hideLabel: boolean;
};

/** Edit all sources of a tile's appearance and save only the active preview. */
export class TileAppearanceModal extends Modal {
	private readonly draft: TileAppearanceDraft;
	private previewUrl?: string;
	private saving = false;
	private closed = false;
	private scopeChanged = false;

	constructor(
		app: App,
		private readonly tilePreview: TilePreview,
		colors: PlaceholderColors | undefined,
		image: Blob | undefined,
		private readonly t: Translate,
		private readonly apply: (change: TileAppearanceChange) => Promise<void>,
		private readonly dismiss: () => void,
	) {
		super(app);
		this.draft = new TileAppearanceDraft(image, colors);
	}

	onOpen(): void {
		const { contentEl, t, draft } = this;
		this.setTitle(t("tileAppearance"));
		this.modalEl.addClass("vault-dock-appearance-modal");
		const preview = this.createPreview();
		const options = contentEl.createDiv("vault-dock-appearance-options");
		const pictures = options.createEl("section", {
			cls: "vault-dock-appearance-section",
		});
		pictures.createEl("h3", { text: t("tileImage") });
		const presets = pictures.createEl("fieldset", {
			cls: "vault-switcher-color-palette",
		});
		presets.createEl("legend", { text: t("tilePresets") });
		const gallery = presets.createDiv(
			"vault-switcher-color-swatches vault-dock-presets",
		);
		const fileActions = pictures.createDiv("vault-dock-appearance-buttons");
		const fileInput = fileActions.createEl("input", {
			attr: { type: "file", accept: IMAGE_TYPES.join(",") },
		});
		fileInput.hidden = true;
		const choose = fileActions.createEl("button", {
			text: t("chooseImageFile"),
			attr: { type: "button" },
		});
		const remove = fileActions.createEl("button", {
			text: t("removeImage"),
			attr: { type: "button" },
		});
		const fileStatus = pictures.createDiv({
			cls: "vault-dock-appearance-message",
			attr: { role: "status" },
		});

		const initials = options.createEl("section", {
			cls: "vault-dock-appearance-section",
		});
		initials.createEl("h3", { text: t("tileInitials") });

		const footer = contentEl.createDiv("vault-dock-appearance-footer");
		const saveError = footer.createDiv({
			cls: "vault-dock-appearance-message is-error",
			attr: { role: "alert" },
		});
		const buttons = footer.createDiv("vault-dock-appearance-buttons");
		const cancel = buttons.createEl("button", {
			text: t("cancelAppearance"),
			attr: { type: "button" },
		});
		const apply = buttons.createEl("button", {
			text: t("applyAppearance"),
			cls: "mod-cta",
			attr: { type: "button" },
		});

		let shown: TileAppearance | undefined;
		const update = () => {
			const appearance = draft.appearance;
			choose.disabled = draft.checking;
			remove.disabled = appearance.kind === "initials";
			cancel.disabled = this.saving;
			apply.disabled =
				this.saving ||
				this.scopeChanged ||
				draft.checking ||
				!draft.changed;
			options.inert = this.saving;
			for (const sync of syncControls) {
				sync();
			}
			if (preview && appearance !== shown) {
				shown = appearance;
				this.renderPreview(preview, appearance);
			}
		};
		const resetFileStatus = () => {
			fileStatus.textContent = "";
			fileStatus.removeClass("is-error");
		};
		const onChoice = () => {
			resetFileStatus();
			if (!this.scopeChanged) {
				saveError.textContent = "";
			}
			update();
		};
		const syncControls = [
			this.addPresets(gallery, onChoice),
			this.addPalette(
				initials,
				"background",
				t("placeholderBackground"),
				onChoice,
			),
			this.addPalette(initials, "text", t("placeholderText"), onChoice),
		];
		initials.createEl("p", {
			text: t("initialsHint"),
			cls: "vault-dock-appearance-hint",
		});

		// Preserve the renderer user gesture that opens the system dialog.
		choose.addEventListener("click", () => fileInput.click());
		fileInput.addEventListener("change", () => {
			const file = fileInput.files?.[0];
			fileInput.value = "";
			if (file) {
				resetFileStatus();
				const check = draft.chooseFile(file);
				if (draft.checking) {
					fileStatus.textContent = t("checkingImage");
				}
				update();
				void check.then((result) => {
					if (this.closed || result === "superseded") {
						return;
					}
					onChoice();
					if (result === "invalid") {
						fileStatus.addClass("is-error");
						fileStatus.textContent = t("invalidImage");
					}
				});
			}
		});
		remove.addEventListener("click", () => {
			draft.removeImage();
			onChoice();
		});
		cancel.addEventListener("click", () => this.close());
		apply.addEventListener(
			"click",
			() => void this.save(update, saveError),
		);
		update();
		void draft
			.identifyPreset()
			.then(() => {
				if (!this.closed) {
					update();
				}
			})
			.catch(() => undefined);
	}

	/** Keep the preview available after a save failure and prevent duplicate writes. */
	private async save(
		update: () => void,
		errorEl: HTMLElement,
	): Promise<void> {
		if (
			this.saving ||
			this.closed ||
			this.scopeChanged ||
			this.draft.checking ||
			!this.draft.changed
		) {
			return;
		}
		this.saving = true;
		errorEl.textContent = "";
		update();
		try {
			await this.apply(this.draft.toChange());
			if (!this.closed) {
				this.dispose();
			}
		} catch (error) {
			if (!this.closed) {
				this.scopeChanged = error instanceof SettingsScopeChangedError;
				errorEl.textContent = this.t(
					this.scopeChanged
						? "appearanceScopeChanged"
						: "saveSettingsFailed",
				);
			}
		} finally {
			this.saving = false;
			if (!this.closed) {
				update();
			}
		}
	}

	/** Reuse the dock's tile sizing and label visibility in the preview. */
	private createPreview(): HTMLElement | null {
		const { tile, name, scale, hideLabel } = this.tilePreview;
		const header = this.contentEl.createDiv("vault-dock-appearance-header");
		const preview = header.createDiv(
			"vault-dock vault-dock-appearance-preview",
		);
		preview.inert = true;
		preview.style.setProperty("--vault-switcher-tile-scale", scale);
		const row = preview.createDiv();
		row.classList.toggle("vault-dock-hide-labels", hideLabel);
		const copy = row.appendChild(tile.cloneNode(true) as HTMLButtonElement);
		const caption = header.createDiv("vault-dock-appearance-caption");
		caption.createDiv({ text: name, cls: "vault-dock-appearance-name" });
		caption.createDiv({
			text: this.t("appearancePreview"),
			cls: "vault-dock-appearance-hint",
		});
		return copy.querySelector<HTMLElement>(".vault-dock-picture");
	}

	private renderPreview(
		picture: HTMLElement,
		appearance: TileAppearance,
	): void {
		this.releasePreview();
		picture.replaceChildren();
		picture.classList.toggle(
			"vault-dock-initials",
			appearance.kind === "initials",
		);
		picture.style.backgroundColor =
			appearance.kind === "initials"
				? (appearance.colors?.background ?? "")
				: "";
		picture.style.color =
			appearance.kind === "initials"
				? (appearance.colors?.text ?? "")
				: "";
		if (appearance.kind === "initials") {
			picture.textContent = this.tilePreview.initials;
			return;
		}
		if (appearance.kind === "image") {
			this.previewUrl = URL.createObjectURL(appearance.image);
		}
		const src =
			appearance.kind === "preset"
				? TILE_PRESETS[appearance.id]
				: this.previewUrl;
		if (src) {
			picture.createEl("img", { attr: { src, alt: "" } });
		}
	}

	private addPresets(gallery: HTMLElement, onChoice: () => void): () => void {
		const names = this.t("presetNames");
		const controls = (Object.keys(TILE_PRESETS) as PresetId[]).map((id) => {
			const { input, swatch } = this.addSwatch(
				gallery,
				"vault-dock-preset",
				names[id],
			);
			swatch.createEl("img", {
				attr: { src: TILE_PRESETS[id], alt: "" },
			});
			const select = () => {
				if (input.checked) {
					this.draft.choosePreset(id);
					onChoice();
				}
			};
			input.addEventListener("change", select);
			input.addEventListener("click", () => {
				const appearance = this.draft.appearance;
				if (
					this.draft.checking &&
					appearance.kind === "preset" &&
					appearance.id === id
				) {
					select();
				}
			});
			return { id, input };
		});
		return () => {
			const appearance = this.draft.appearance;
			for (const { id, input } of controls) {
				input.checked =
					appearance.kind === "preset" && appearance.id === id;
			}
		};
	}

	/** Handle a click on the already selected swatch as a choice of initials. */
	private addPalette(
		container: HTMLElement,
		key: keyof PlaceholderColors,
		title: string,
		onChoice: () => void,
	): () => void {
		const group = container.createEl("fieldset", {
			cls: "vault-switcher-color-palette",
		});
		group.createEl("legend", { text: title });
		const swatches = group.createDiv("vault-switcher-color-swatches");
		const names = this.t("colorNames");
		const controls: {
			input: HTMLInputElement;
			color: PlaceholderColors[keyof PlaceholderColors];
		}[] = [];
		for (const name of Object.keys(PALETTE) as PaletteName[]) {
			const color = PALETTE[name];
			const transparent = color === PALETTE.transparent;
			if (transparent && key === "text") {
				continue;
			}
			const { input, swatch } = this.addSwatch(
				swatches,
				`vault-switcher-color-${key}`,
				names[name],
			);
			swatch.classList.toggle(
				"vault-switcher-color-transparent",
				transparent,
			);
			swatch.style.backgroundColor = color;
			const select = () => {
				if (input.checked) {
					this.draft.setColor(key, color);
					onChoice();
				}
			};
			input.addEventListener("change", select);
			input.addEventListener("click", () => {
				if (this.draft.swatches?.[key] === color) {
					select();
				}
			});
			controls.push({ input, color });
		}
		return () => {
			for (const { input, color } of controls) {
				input.checked = this.draft.swatches?.[key] === color;
			}
		};
	}

	private addSwatch(container: HTMLElement, group: string, name: string) {
		const label = container.createEl("label", { attr: { title: name } });
		const input = label.createEl("input", {
			attr: { type: "radio", name: group, "aria-label": name },
		});
		return { input, swatch: label.createSpan() };
	}

	private releasePreview(): void {
		if (this.previewUrl) {
			URL.revokeObjectURL(this.previewUrl);
			this.previewUrl = undefined;
		}
	}

	close(): void {
		if (!this.saving) {
			super.close();
		}
	}

	/** Close after saving or when the plugin unloads, even during a write. */
	dispose(): void {
		super.close();
	}

	onClose(): void {
		this.closed = true;
		this.draft.cancelFileCheck();
		this.contentEl.empty();
		this.releasePreview();
		this.dismiss();
	}
}
