import { type App, Menu, Notice } from "obsidian";
import type { BarPosition } from "./bar-position";
import { BarResize } from "./bar-resize";
import type { RegisteredVault } from "./desktop";
import type { Translate } from "./i18n";
import { PlaceholderColorModal } from "./placeholder-color-modal";
import type { PlaceholderColors } from "./placeholder-colors";
import { IMAGE_TYPES, MAX_IMAGE_SIZE } from "./settings-store";

const nameSegments = new Intl.Segmenter(undefined, { granularity: "grapheme" });
const positionItems = [
	["top", "barTop"],
	["bottom", "barBottom"],
	["right", "barRight"],
	["left", "barLeft"],
] as const;

/** Move the existing bar to the requested workspace or sidebar position. */
export function mountBar(
	workspace: HTMLElement,
	bar: HTMLElement,
	position: BarPosition,
): void {
	let parent: Element | null = workspace;
	let next: Element | null = null;
	let placement = position;
	let atWorkspaceEnd = false;
	if (position === "left" || position === "right") {
		const rtl =
			workspace.ownerDocument.defaultView?.getComputedStyle(workspace)
				.direction === "rtl";
		atWorkspaceEnd = position === (rtl ? "left" : "right");
		if (!atWorkspaceEnd) {
			const ribbon = workspace.querySelector(
				":scope > .workspace-ribbon.mod-primary",
			);
			next = ribbon
				? ribbon.nextElementSibling
				: workspace.firstElementChild;
		}
	} else {
		const footer =
			position === "bottom"
				? workspace.querySelector(
						".workspace-split.mod-left-split > .workspace-sidedock-vault-profile",
					)
				: null;
		const anchor =
			footer ??
			workspace.querySelector(
				".workspace-split.mod-left-split > .workspace-tabs > .workspace-tab-header-container",
			);
		parent = anchor?.parentElement ?? null;
		next = footer ?? anchor?.nextElementSibling ?? null;
		placement = footer ? "bottom" : "top";
	}

	bar.dataset.position = placement;
	bar.classList.toggle("vault-dock-at-workspace-end", atWorkspaceEnd);
	if (!parent) {
		bar.remove();
		return;
	}
	if (
		next === bar ||
		(bar.parentElement === parent && bar.nextElementSibling === next)
	) {
		return;
	}

	const focused = bar.ownerDocument.activeElement;
	parent.insertBefore(bar, next);
	if (focused instanceof HTMLElement && bar.contains(focused)) {
		focused.focus({ preventScroll: true });
	}
}

type TileTarget = { id: string; scopeRevision: number };
type TilePicture = { image: HTMLImageElement; size?: ResizeObserverSize };

/** Use up to two letters, or the first two graphemes in names without letters. */
function getInitials(name: string): string {
	const characters = Array.from(
		nameSegments.segment(name.trim()),
		({ segment }) => segment,
	);
	const letters = characters.filter((character) => /\p{L}/u.test(character));
	return (letters.length ? letters : characters).slice(0, 2).join("");
}

/** Check whether a picture can be drawn as a single frame. */
async function isStillImage(
	source: Blob,
	Decoder: typeof ImageDecoder | undefined,
): Promise<boolean> {
	if (source.type === "image/jpeg") {
		return true;
	}
	if (!Decoder) {
		return false;
	}
	const decoder = new Decoder({
		type: source.type,
		data: await source.arrayBuffer(),
		preferAnimation: true,
	});
	try {
		await decoder.tracks.ready;
		return decoder.tracks.selectedTrack?.animated === false;
	} finally {
		decoder.close();
	}
}

/** Render vault tiles and manage their appearance actions. */
export class Bar {
	readonly element: HTMLElement;
	private readonly tiles: HTMLElement;
	private readonly resize: BarResize;
	private readonly picker: HTMLInputElement;
	private readonly saving = new Set<string>();
	private readonly pictures = new Map<Element, TilePicture>();
	private readonly pictureObserver?: ResizeObserver;
	private menu?: Menu;
	private colorModal?: PlaceholderColorModal;
	private pickerTarget?: TileTarget;
	private urls = new Map<Blob, string>();
	private pending = true;
	private disposed = false;

	constructor(
		document: Document,
		private readonly app: App,
		private readonly onSelect: (id: string) => void,
		private readonly scopeRevision: () => number | undefined,
		private readonly save: (
			id: string,
			image: Blob | undefined,
			scopeRevision: number,
		) => Promise<void>,
		private readonly saveColors: (
			id: string,
			colors: PlaceholderColors,
			scopeRevision: number,
		) => Promise<void>,
		saveScale: (scale: number) => Promise<void>,
		private readonly t: Translate,
		private readonly onChangePosition: (position: BarPosition) => void,
	) {
		this.element = document.createElement("div");
		this.element.className = "vault-dock";
		this.tiles = this.element.createDiv("vault-dock-tiles");
		this.tiles.setAttribute("role", "group");
		this.resize = new BarResize(this.element, saveScale);
		this.element.addEventListener("contextmenu", (event) =>
			this.showPositionMenu(event),
		);
		const win = document.defaultView;
		if (
			win?.ResizeObserver &&
			win.ResizeObserverEntry &&
			"devicePixelContentBoxSize" in win.ResizeObserverEntry.prototype
		) {
			this.pictureObserver = new win.ResizeObserver((entries) => {
				for (const entry of entries) {
					const picture = this.pictures.get(entry.target);
					if (picture) {
						picture.size = entry.devicePixelContentBoxSize[0];
						this.smoothPicture(entry.target, picture);
					}
				}
			});
		}
		this.picker = this.element.createEl("input", {
			attr: { type: "file", accept: IMAGE_TYPES.join(",") },
		});
		this.picker.hidden = true;
		this.picker.addEventListener("cancel", () => {
			this.pickerTarget = undefined;
		});
		this.picker.addEventListener("change", () => {
			const target = this.pickerTarget;
			const file = this.picker.files?.[0];
			this.pickerTarget = undefined;
			this.picker.value = "";
			if (target && file) {
				void this.changeImage(target, file);
			}
		});
		this.localize();
	}

	localize(): void {
		this.menu?.hide();
		this.tiles.setAttribute("aria-label", this.t("vaults"));
	}

	/** Clear interactions tied to the old placement before using the new one. */
	onPlacementChanged(): void {
		this.menu?.hide();
		this.resize.cancel();
	}

	render(
		vaults: RegisteredVault[],
		activeId: string,
		images: Map<string, Blob>,
		placeholderColors?: ReadonlyMap<string, PlaceholderColors>,
	): void {
		this.menu?.hide();
		const { scrollLeft, scrollTop } = this.tiles;
		const active = this.tiles.ownerDocument.activeElement;
		const focused = this.tiles.contains(active)
			? active?.getAttribute("data-vault-id")
			: undefined;
		const nextUrls = new Map<Blob, string>();
		this.clearPictures();
		this.tiles.replaceChildren();
		let focusTarget: HTMLButtonElement | undefined;

		for (const vault of vaults) {
			const tile = this.tiles.createEl("button", {
				cls: "vault-dock-tile",
				attr: {
					type: "button",
					title: vault.path,
					"aria-label": vault.name,
				},
			});
			tile.dataset.vaultId = vault.id;
			tile.disabled = this.pending;
			if (vault.id === activeId) {
				tile.setAttribute("aria-current", "true");
			}
			if (vault.id === focused) {
				focusTarget = tile;
			}
			const picture = tile.createSpan("vault-dock-picture");
			const image = images.get(vault.id);
			const colors = placeholderColors?.get(vault.id);
			if (image) {
				const url = this.urls.get(image) ?? URL.createObjectURL(image);
				nextUrls.set(image, url);
				void this.renderPicture(picture, url, image);
			} else {
				picture.addClass("vault-dock-initials");
				picture.textContent = getInitials(vault.name);
				if (colors) {
					picture.style.backgroundColor = colors.background;
					picture.style.color = colors.text;
				}
			}
			tile.createSpan({
				cls: "vault-dock-label",
				text: vault.name,
			});
			tile.addEventListener("click", () => this.onSelect(vault.id));
			tile.addEventListener("contextmenu", (event) => {
				this.showImageMenu(event, vault, image !== undefined, colors);
			});
		}

		for (const [image, url] of this.urls) {
			if (!nextUrls.has(image)) {
				URL.revokeObjectURL(url);
			}
		}
		this.urls = nextUrls;
		this.tiles.scrollLeft = scrollLeft;
		this.tiles.scrollTop = scrollTop;
		focusTarget?.focus({ preventScroll: true });
	}

	/** Keep the original image visible while the source loads and layout settles. */
	private async renderPicture(
		element: HTMLElement,
		url: string,
		source: Blob,
	): Promise<void> {
		const image = element.createEl("img", { attr: { src: url, alt: "" } });
		if (!this.pictureObserver) {
			return;
		}
		const picture: TilePicture = { image };
		this.pictures.set(element, picture);
		const still = await isStillImage(
			source,
			element.ownerDocument.defaultView?.ImageDecoder,
		).catch(() => false);
		if (!still || !this.pictures.has(element)) {
			this.pictures.delete(element);
			return;
		}
		image.addEventListener(
			"load",
			() => {
				if (this.pictures.has(element)) {
					this.smoothPicture(element, picture);
				}
			},
			{ once: true },
		);
		this.pictureObserver.observe(element, {
			box: "device-pixel-content-box",
		});
	}

	/** Downsample the centered square crop to the tile's physical pixel size. */
	private smoothPicture(
		element: Element,
		{ image, size }: TilePicture,
	): void {
		if (!element.isConnected || !size?.inlineSize || !size.blockSize) {
			return;
		}
		const { inlineSize: width, blockSize: height } = size;
		const crop = Math.min(image.naturalWidth, image.naturalHeight);
		if (crop > Math.max(width, height)) {
			const canvas = element.ownerDocument.createElement("canvas");
			canvas.width = width;
			canvas.height = height;
			canvas.setAttribute("aria-hidden", "true");
			const context = canvas.getContext("2d");
			if (context) {
				context.imageSmoothingQuality = "high";
				try {
					context.drawImage(
						image,
						(image.naturalWidth - crop) / 2,
						(image.naturalHeight - crop) / 2,
						crop,
						crop,
						0,
						0,
						width,
						height,
					);
					element.replaceChildren(canvas);
					return;
				} catch {
					// Fall back to the browser's image rendering.
				}
			}
		}
		if (element.firstElementChild !== image) {
			element.replaceChildren(image);
		}
	}

	private clearPictures(): void {
		this.pictureObserver?.disconnect();
		this.pictures.clear();
	}

	/** Track one menu so localization, rendering and disposal can close it. */
	private createMenu(): Menu {
		this.menu?.hide();
		const menu = new Menu().setUseNativeMenu(false).setNoIcon();
		this.menu = menu;
		menu.onHide(() => {
			if (this.menu === menu) {
				this.menu = undefined;
			}
		});
		return menu;
	}

	/** Mark the mounted position, including when a sidebar anchor falls back. */
	private showPositionMenu(event: MouseEvent): void {
		event.preventDefault();
		event.stopPropagation();
		const position = this.element.dataset.position;
		if (this.scopeRevision() === undefined) {
			new Notice(this.t("settingsLoading"));
			return;
		}
		const menu = this.createMenu();
		for (const [value, label] of positionItems) {
			menu.addItem((item) =>
				item
					.setTitle(this.t(label))
					.setChecked(value === position)
					.onClick(() => this.onChangePosition(value)),
			);
		}
		menu.showAtMouseEvent(event);
	}

	/** Bind the menu and file picker to the tile and the displayed settings scope. */
	private showImageMenu(
		event: MouseEvent,
		vault: RegisteredVault,
		hasImage: boolean,
		colors?: PlaceholderColors,
	): void {
		event.preventDefault();
		event.stopPropagation();
		if (this.pending) {
			return;
		}
		const scopeRevision = this.scopeRevision();
		if (scopeRevision === undefined) {
			new Notice(this.t("settingsLoading"));
			return;
		}
		const { id, name } = vault;
		const target = { id, scopeRevision };
		const saving = this.saving.has(id);
		// Open the picker synchronously from a renderer user gesture.
		const menu = this.createMenu();
		menu.addItem((item) => {
			item.setTitle(this.t(hasImage ? "changeImage" : "uploadImage"))
				.setDisabled(saving || this.pickerTarget !== undefined)
				.onClick(() => {
					this.pickerTarget = target;
					this.picker.click();
				});
		});
		menu.addItem((item) => {
			item.setTitle(this.t("removeImage"))
				.setDisabled(
					!hasImage || saving || this.pickerTarget?.id === id,
				)
				.onClick(() => void this.changeImage(target));
		});
		menu.addItem((item) => {
			item.setTitle(this.t("chooseColor"))
				.setDisabled(saving || this.pickerTarget?.id === id)
				.onClick(() => this.chooseColor(target, name, colors));
		});
		menu.showAtMouseEvent(event);
	}

	/** Keep the draft tied to the tile and the scope shown when the menu opened. */
	private chooseColor(
		target: TileTarget,
		name: string,
		colors?: PlaceholderColors,
	): void {
		if (this.disposed || this.colorModal) {
			return;
		}
		this.colorModal = new PlaceholderColorModal(
			this.app,
			getInitials(name),
			colors,
			this.t,
			(draft) => void this.changeColors(target, draft),
			() => {
				this.colorModal = undefined;
			},
		);
		this.colorModal.open();
	}

	/** Serialize appearance writes for this tile in the current window. */
	private async changeColors(
		target: TileTarget,
		colors: PlaceholderColors,
	): Promise<void> {
		if (this.disposed || this.saving.has(target.id)) {
			return;
		}
		this.saving.add(target.id);
		try {
			await this.saveColors(target.id, colors, target.scopeRevision);
		} catch {
			if (!this.disposed) {
				new Notice(this.t("saveSettingsFailed"));
			}
		} finally {
			this.saving.delete(target.id);
		}
	}

	/** Validate a selected file before replacing the stored image. */
	private async changeImage(target: TileTarget, file?: File): Promise<void> {
		if (this.disposed || this.saving.has(target.id)) {
			return;
		}
		this.saving.add(target.id);
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
			if (!this.disposed) {
				await this.save(target.id, file, target.scopeRevision);
			}
		} catch {
			if (!this.disposed) {
				new Notice(this.t("saveImageFailed"));
			}
		} finally {
			this.saving.delete(target.id);
		}
	}

	setPending(pending: boolean): void {
		if (pending === this.pending) {
			return;
		}
		this.pending = pending;
		for (const tile of this.tiles.querySelectorAll("button")) {
			tile.disabled = pending;
		}
	}

	setHideLabels(hideLabels: boolean): void {
		this.resize.cancel();
		this.tiles.classList.toggle("vault-dock-hide-labels", hideLabels);
	}

	setTileScale(scale: number): void {
		this.resize.setScale(scale);
	}

	dispose(): void {
		this.disposed = true;
		this.resize.cancel();
		this.menu?.hide();
		this.colorModal?.close();
		this.pickerTarget = undefined;
		this.clearPictures();
		this.element.remove();
		for (const url of this.urls.values()) {
			URL.revokeObjectURL(url);
		}
		this.urls.clear();
	}
}
