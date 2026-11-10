import { type App, Menu, Notice } from "obsidian";
import type { BarPosition } from "./bar-position";
import { BarResize } from "./bar-resize";
import type { RegisteredVault } from "./desktop";
import type { Translate } from "./i18n";
import type { PlaceholderColors } from "./placeholder-colors";
import { createTile, getInitials, showInitials } from "./tile";
import { TileAppearanceModal } from "./tile-appearance-modal";
import { TileReorder } from "./tile-reorder";
import { resolveVaultOrder, type VaultMove } from "./vault-order";

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
	if (focused?.instanceOf(HTMLElement) && bar.contains(focused)) {
		focused.focus({ preventScroll: true });
	}
}

type TileTarget = { id: string; scopeRevision: number };
type TilePicture = { image: HTMLImageElement; size?: ResizeObserverSize };

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
	private readonly reorder: TileReorder;
	private readonly pictures = new Map<Element, TilePicture>();
	private readonly pictureObserver?: ResizeObserver;
	private menu?: Menu;
	private appearanceModal?: TileAppearanceModal;
	private urls = new Map<Blob, string>();
	private pending = true;
	private savingOrder = false;
	private disposed = false;

	constructor(
		document: Document,
		private readonly app: App,
		private readonly onSelect: (id: string) => void,
		private readonly onMove: (move: VaultMove) => Promise<void>,
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
		private readonly onChangeHideLabels: (hideLabels: boolean) => void,
	) {
		this.element = document.createElement("div");
		this.element.className = "vault-dock";
		this.tiles = this.element.createDiv("vault-dock-tiles");
		this.tiles.setAttribute("role", "group");
		this.resize = new BarResize(this.element, saveScale);
		this.reorder = new TileReorder(
			this.tiles,
			() => this.canMove(),
			(move) => void this.moveTile(move),
		);
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
		this.reorder.cancel();
	}

	render(
		vaults: RegisteredVault[],
		activeId: string,
		images: Map<string, Blob>,
		placeholderColors?: ReadonlyMap<string, PlaceholderColors>,
		vaultOrder: readonly string[] = [],
	): void {
		this.menu?.hide();
		this.reorder.cancel();
		const { scrollLeft, scrollTop } = this.tiles;
		const active = this.tiles.ownerDocument.activeElement;
		const focused = this.tiles.contains(active)
			? active?.getAttribute("data-vault-id")
			: undefined;
		const nextUrls = new Map<Blob, string>();
		this.clearPictures();
		this.tiles.replaceChildren();
		let focusTarget: HTMLButtonElement | undefined;

		const byId = new Map(vaults.map((vault) => [vault.id, vault]));
		for (const id of resolveVaultOrder([...byId.keys()], vaultOrder)) {
			const vault = byId.get(id);
			if (!vault) {
				continue;
			}
			const { tile, picture } = createTile(
				this.tiles,
				vault,
				this.onSelect,
			);
			tile.disabled = this.pending;
			if (vault.id === activeId) {
				tile.setAttribute("aria-current", "true");
			}
			if (vault.id === focused) {
				focusTarget = tile;
			}
			const image = images.get(vault.id);
			const colors = placeholderColors?.get(vault.id);
			if (image) {
				const url = this.urls.get(image) ?? URL.createObjectURL(image);
				nextUrls.set(image, url);
				void this.renderPicture(picture, url, image);
			} else {
				showInitials(picture, vault.name);
				if (colors) {
					picture.style.backgroundColor = colors.background;
					picture.style.color = colors.text;
				}
			}
			const showMenu = (event: MouseEvent | KeyboardEvent) =>
				this.showTileMenu(event, vault, tile, image, colors);
			tile.addEventListener("contextmenu", showMenu);
			tile.addEventListener("keydown", (event) => {
				if (
					event.key === "ContextMenu" ||
					(event.shiftKey && event.key === "F10")
				) {
					showMenu(event);
				}
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

	/** Show the mounted position and current label visibility. */
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
		const hideLabels = this.labelsHidden;
		menu.addSeparator();
		menu.addItem((item) =>
			item
				.setTitle(this.t("hideLabels"))
				.setChecked(hideLabels)
				.onClick(() => this.onChangeHideLabels(!hideLabels)),
		);
		menu.showAtMouseEvent(event);
	}

	/** Bind the menu to the tile and the displayed settings scope. */
	private showTileMenu(
		event: MouseEvent | KeyboardEvent,
		vault: RegisteredVault,
		tile: HTMLButtonElement,
		image?: Blob,
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
		const menu = this.createMenu();
		menu.addItem((item) => {
			item.setTitle(this.t("tileAppearance"))
				.setDisabled(this.appearanceModal !== undefined)
				.onClick(() =>
					this.chooseAppearance(target, tile, name, image, colors),
				);
		});
		menu.addSeparator();
		const moves = [
			["moveVaultEarlier", "before", tile.previousElementSibling],
			["moveVaultLater", "after", tile.nextElementSibling],
		] as const;
		for (const [label, side, anchor] of moves) {
			const anchorId = anchor?.getAttribute("data-vault-id");
			menu.addItem((item) =>
				item
					.setTitle(this.t(label))
					.setDisabled(!anchorId || !this.canMove())
					.onClick(() => {
						if (anchorId) {
							tile.focus({ preventScroll: true });
							void this.moveTile({ id, anchorId, side }, true);
						}
					}),
			);
		}
		if ("clientX" in event) {
			menu.showAtMouseEvent(event);
		} else {
			const { left, bottom } = tile.getBoundingClientRect();
			menu.showAtPosition({ x: left, y: bottom }, tile.ownerDocument);
		}
	}

	/** Keep the draft tied to the tile and the scope shown when the menu opened. */
	private chooseAppearance(
		target: TileTarget,
		tile: HTMLButtonElement,
		name: string,
		image?: Blob,
		colors?: PlaceholderColors,
	): void {
		if (this.disposed || this.appearanceModal) {
			return;
		}
		this.appearanceModal = new TileAppearanceModal(
			this.app,
			{
				tile,
				name,
				initials: getInitials(name),
				scale: this.element.style.getPropertyValue(
					"--vault-switcher-tile-scale",
				),
				hideLabel: this.labelsHidden,
			},
			colors,
			image,
			this.t,
			(change) =>
				"colors" in change
					? this.saveColors(
							target.id,
							change.colors,
							target.scopeRevision,
						)
					: this.save(target.id, change.image, target.scopeRevision),
			() => {
				this.appearanceModal = undefined;
				// Applying can rebuild the tile while the modal owns focus.
				queueMicrotask(() => {
					const doc = this.tiles.ownerDocument;
					if (
						!this.disposed &&
						!this.appearanceModal &&
						doc.activeElement === doc.body
					) {
						Array.from(
							this.tiles.querySelectorAll<HTMLButtonElement>(
								"button[data-vault-id]",
							),
						)
							.find(
								(button) =>
									button.dataset.vaultId === target.id,
							)
							?.focus({ preventScroll: true });
					}
				});
			},
		);
		this.appearanceModal.open();
	}

	private canMove(): boolean {
		return (
			!this.disposed &&
			!this.pending &&
			!this.savingOrder &&
			this.scopeRevision() !== undefined &&
			this.tiles.childElementCount > 1
		);
	}

	/** Serialize moves from the drag gesture and the tile menu in this window. */
	private async moveTile(move: VaultMove, reveal = false): Promise<void> {
		if (!this.canMove()) {
			return;
		}
		this.savingOrder = true;
		try {
			await this.onMove(move);
			const focused = this.tiles.ownerDocument.activeElement;
			if (
				reveal &&
				this.tiles.contains(focused) &&
				focused?.getAttribute("data-vault-id") === move.id
			) {
				focused.scrollIntoView({ block: "nearest", inline: "nearest" });
			}
		} catch {
			if (!this.disposed) {
				new Notice(this.t("saveSettingsFailed"));
			}
		} finally {
			this.savingOrder = false;
		}
	}

	setPending(pending: boolean): void {
		if (pending === this.pending) {
			return;
		}
		this.pending = pending;
		if (pending) {
			this.reorder.cancel();
		}
		for (const tile of this.tiles.querySelectorAll("button")) {
			tile.disabled = pending;
		}
	}

	private get labelsHidden(): boolean {
		return this.tiles.classList.contains("vault-dock-hide-labels");
	}

	setHideLabels(hideLabels: boolean): void {
		this.menu?.hide();
		this.resize.cancel();
		this.reorder.cancel();
		this.tiles.classList.toggle("vault-dock-hide-labels", hideLabels);
	}

	setTileScale(scale: number): void {
		this.reorder.cancel();
		this.resize.setScale(scale);
	}

	dispose(): void {
		this.disposed = true;
		this.resize.cancel();
		this.reorder.cancel();
		this.menu?.hide();
		this.appearanceModal?.dispose();
		this.clearPictures();
		this.element.remove();
		for (const url of this.urls.values()) {
			URL.revokeObjectURL(url);
		}
		this.urls.clear();
	}
}
