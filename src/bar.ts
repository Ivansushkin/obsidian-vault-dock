import {
	Modal,
	Notice,
	Setting,
	setIcon,
	type App,
	type ButtonComponent,
} from "obsidian";
import type { RegisteredVault } from "./desktop";
import type { Translate } from "./i18n";
import { IMAGE_TYPES, MAX_IMAGE_SIZE } from "./settings-store";

/** Mount the bar below the primary left sidebar tabs. */
export function mountBar(workspace: HTMLElement, bar: HTMLElement): void {
	const header = workspace.querySelector(
		".workspace-split.mod-left-split > .workspace-tabs > .workspace-tab-header-container",
	);
	if (header && header.nextElementSibling !== bar) {
		header.after(bar);
	}
}

export class Bar {
	readonly element: HTMLElement;
	private readonly tiles: HTMLElement;
	private readonly settingsButton: HTMLButtonElement;
	private urls = new Map<Blob, string>();

	constructor(
		document: Document,
		private readonly onSelect: (id: string) => void,
		onSettings: () => void,
		private readonly t: Translate,
	) {
		this.element = document.createElement("div");
		this.element.className = "vault-switcher-bar";
		this.tiles = this.element.createDiv("vault-switcher-bar-tiles");
		this.tiles.setAttribute("role", "group");
		this.settingsButton = this.element.createEl("button", {
			cls: "clickable-icon vault-switcher-bar-settings",
			attr: { type: "button" },
		});
		setIcon(this.settingsButton, "settings");
		this.settingsButton.addEventListener("click", onSettings);
		this.localize();
	}

	localize(): void {
		this.tiles.setAttribute("aria-label", this.t("vaults"));
		const label = this.t("barSettings");
		this.settingsButton.title = label;
		this.settingsButton.setAttribute("aria-label", label);
	}

	render(
		vaults: RegisteredVault[],
		activeId: string,
		images: Map<string, Blob>,
		pending: boolean,
	): void {
		const scroll = this.tiles.scrollLeft;
		const focused =
			this.tiles.querySelector<HTMLElement>(":focus")?.dataset.vaultId;
		const nextUrls = new Map<Blob, string>();
		this.tiles.replaceChildren();
		let focusTarget: HTMLButtonElement | undefined;

		for (const vault of vaults) {
			const tile = this.tiles.createEl("button", {
				cls: "vault-switcher-bar-tile",
				attr: { type: "button", title: vault.path },
			});
			tile.dataset.vaultId = vault.id;
			tile.disabled = pending;
			if (vault.id === activeId) {
				tile.setAttribute("aria-current", "true");
			}
			if (vault.id === focused) {
				focusTarget = tile;
			}
			const picture = tile.createSpan("vault-switcher-bar-picture");
			const image = images.get(vault.id);
			if (image) {
				const url = this.urls.get(image) ?? URL.createObjectURL(image);
				nextUrls.set(image, url);
				picture.createEl("img", { attr: { src: url, alt: "" } });
			} else {
				setIcon(picture, "folder");
			}
			tile.createSpan({
				cls: "vault-switcher-bar-label",
				text: vault.name,
			});
			tile.addEventListener("click", () => this.onSelect(vault.id));
		}

		for (const [image, url] of this.urls) {
			if (!nextUrls.has(image)) {
				URL.revokeObjectURL(url);
			}
		}
		this.urls = nextUrls;
		this.tiles.scrollLeft = scroll;
		focusTarget?.focus({ preventScroll: true });
	}

	dispose(): void {
		this.element.remove();
		for (const url of this.urls.values()) {
			URL.revokeObjectURL(url);
		}
		this.urls.clear();
	}
}

export class ImageSettings extends Modal {
	private readonly buttons: [
		ButtonComponent,
		"chooseImage" | "resetImage",
	][] = [];

	constructor(
		app: App,
		private readonly vaults: RegisteredVault[],
		private readonly scopeRevision: () => number | undefined,
		private readonly save: (
			id: string,
			image: Blob | undefined,
			scopeRevision: number,
		) => Promise<void>,
		private readonly t: Translate,
	) {
		super(app);
	}

	onOpen(): void {
		for (const vault of this.vaults) {
			const row = new Setting(this.contentEl)
				.setName(vault.name)
				.setDesc(vault.path);
			const picker = row.controlEl.createEl("input", {
				attr: { type: "file", accept: IMAGE_TYPES.join(",") },
			});
			picker.hidden = true;
			let pending = false;
			let pickerScope: number | undefined;
			const changeImage = async (
				scope: number | undefined,
				file?: File,
			) => {
				if (pending) {
					return;
				}
				if (scope === undefined) {
					new Notice(this.t("settingsLoading"));
					return;
				}
				pending = true;
				try {
					if (file) {
						if (
							!IMAGE_TYPES.includes(file.type) ||
							file.size > MAX_IMAGE_SIZE
						) {
							new Notice(this.t("invalidImage"));
							return;
						}
						const decoded = await createImageBitmap(file);
						decoded.close();
					}
					await this.save(vault.id, file, scope);
				} catch {
					new Notice(this.t("saveImageFailed"));
				} finally {
					pending = false;
				}
			};
			picker.addEventListener("change", () => {
				const file = picker.files?.[0];
				picker.value = "";
				if (file) {
					void changeImage(pickerScope, file);
				}
			});
			row.addButton((button) => {
				this.buttons.push([button, "chooseImage"]);
				button.onClick(() => {
					if (!pending) {
						pickerScope = this.scopeRevision();
						picker.click();
					}
				});
			});
			row.addButton((button) => {
				this.buttons.push([button, "resetImage"]);
				button.onClick(() => changeImage(this.scopeRevision()));
			});
		}
		this.localize();
	}

	/** Update labels in place so an open file picker can still complete. */
	localize(): void {
		this.setTitle(this.t("barImages"));
		for (const [button, key] of this.buttons) {
			button.setButtonText(this.t(key));
		}
	}

	onClose(): void {
		this.buttons.length = 0;
		this.contentEl.replaceChildren();
	}
}
