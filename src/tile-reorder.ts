import type { VaultMove } from "./vault-order";

const TILE_SELECTOR = "button.vault-dock-tile[data-vault-id]";
const DRAG_THRESHOLD = 6;
const SCROLL_EDGE = 24;
const SCROLL_STEP = 8;

type Point = { x: number; y: number };
type Drag = {
	pointerId: number;
	tile: HTMLButtonElement;
	id: string;
	start: Point;
	point: Point;
	vertical: boolean;
	direction: number;
	events: AbortController;
	started: boolean;
};
type Drop = { tile: HTMLButtonElement; side: VaultMove["side"] };

/** Track a pointer gesture without changing the tile DOM until the move saves. */
export class TileReorder {
	private drag?: Drag;
	private drop?: Drop;
	private frame?: number;
	private suppressClick = false;

	constructor(
		private readonly row: HTMLElement,
		private readonly canMove: () => boolean,
		private readonly move: (move: VaultMove) => void,
	) {
		row.addEventListener("pointerdown", (event) => this.start(event));
		row.addEventListener("dragstart", (event) => event.preventDefault());
		row.addEventListener(
			"click",
			(event) => {
				if (this.suppressClick && event.detail > 0) {
					this.suppressClick = false;
					event.preventDefault();
					event.stopImmediatePropagation();
				}
			},
			{ capture: true },
		);
	}

	/** Clear capture, autoscroll, and the insertion marker for any pending gesture. */
	cancel(): void {
		const drag = this.drag;
		if (!drag) {
			return;
		}
		this.drag = undefined;
		drag.events.abort();
		this.stopScroll();
		this.markDrop(undefined);
		this.row.classList.remove("is-reordering");
		if (this.row.hasPointerCapture(drag.pointerId)) {
			this.row.releasePointerCapture(drag.pointerId);
		}
	}

	/** Leave clicks and touchscreen panning alone until a desktop drag starts. */
	private start(event: PointerEvent): void {
		if (this.drag || !event.isPrimary || event.button !== 0) {
			return;
		}
		this.suppressClick = false;
		const view = this.row.ownerDocument.defaultView;
		const tile =
			view && event.target instanceof view.Element
				? event.target.closest<HTMLButtonElement>(TILE_SELECTOR)
				: null;
		const id = tile?.dataset.vaultId;
		if (
			!view ||
			!tile ||
			!id ||
			!this.canMove() ||
			event.pointerType === "touch"
		) {
			return;
		}

		const { flexDirection, direction } = view.getComputedStyle(this.row);
		const vertical = flexDirection === "column";
		const start = { x: event.clientX, y: event.clientY };
		const events = new AbortController();
		const drag: Drag = {
			pointerId: event.pointerId,
			tile,
			id,
			start,
			point: start,
			vertical,
			direction: !vertical && direction === "rtl" ? -1 : 1,
			events,
			started: false,
		};
		this.drag = drag;
		const options = { capture: true, signal: events.signal };
		view.addEventListener(
			"pointermove",
			(event) => this.track(event, drag),
			options,
		);
		view.addEventListener(
			"pointerup",
			(event) => this.finish(event, drag),
			options,
		);
		for (const type of ["pointercancel", "lostpointercapture"] as const) {
			view.addEventListener(
				type,
				(event) => {
					if (event.pointerId === drag.pointerId) {
						this.cancel();
					}
				},
				options,
			);
		}
		view.addEventListener("blur", () => this.cancel(), {
			signal: events.signal,
		});
		view.addEventListener(
			"keydown",
			(event) => {
				if (event.key === "Escape") {
					if (drag.started) {
						event.preventDefault();
						event.stopPropagation();
					}
					this.suppressClick = true;
					this.cancel();
				}
			},
			options,
		);
	}

	private track(event: PointerEvent, drag: Drag): void {
		if (event.pointerId !== drag.pointerId) {
			return;
		}
		drag.point = { x: event.clientX, y: event.clientY };
		if (!drag.started) {
			if (
				Math.hypot(
					drag.point.x - drag.start.x,
					drag.point.y - drag.start.y,
				) < DRAG_THRESHOLD
			) {
				return;
			}
			drag.started = true;
			this.suppressClick = true;
			this.row.setPointerCapture(drag.pointerId);
			this.row.classList.add("is-reordering");
		}
		event.preventDefault();
		this.stopScroll();
		this.preview(drag);
	}

	private finish(event: PointerEvent, drag: Drag): void {
		if (event.pointerId !== drag.pointerId) {
			return;
		}
		drag.point = { x: event.clientX, y: event.clientY };
		const bounds = this.row.getBoundingClientRect();
		const drop =
			drag.started && this.contains(bounds, drag.point)
				? this.findDrop(drag)
				: undefined;
		this.cancel();
		const anchorId = drop?.tile.dataset.vaultId;
		if (drop && anchorId && this.canMove()) {
			this.move({ id: drag.id, anchorId, side: drop.side });
		}
	}

	private contains(rect: DOMRect, { x, y }: Point): boolean {
		return (
			x >= rect.left && x < rect.right && y >= rect.top && y < rect.bottom
		);
	}

	/** Use tile midpoints in logical order, including when horizontal layout is RTL. */
	private findDrop({
		tile,
		point,
		vertical,
		direction,
	}: Drag): Drop | undefined {
		const coordinate = (vertical ? point.y : point.x) * direction;
		let last: HTMLButtonElement | undefined;
		for (const anchor of this.row.querySelectorAll<HTMLButtonElement>(
			TILE_SELECTOR,
		)) {
			if (anchor === tile) {
				continue;
			}
			const rect = anchor.getBoundingClientRect();
			const middle = vertical
				? rect.top + rect.height / 2
				: rect.left + rect.width / 2;
			if (coordinate < middle * direction) {
				return { tile: anchor, side: "before" };
			}
			last = anchor;
		}
		return last ? { tile: last, side: "after" } : undefined;
	}

	/** Re-evaluate the insertion marker as tiles scroll under a stationary pointer. */
	private preview(drag: Drag): void {
		const bounds = this.row.getBoundingClientRect();
		if (!this.contains(bounds, drag.point)) {
			this.markDrop(undefined);
			return;
		}
		this.markDrop(this.findDrop(drag));
		const start = drag.vertical ? bounds.top : bounds.left;
		const end = drag.vertical ? bounds.bottom : bounds.right;
		const axis = drag.vertical ? drag.point.y : drag.point.x;
		const edge = Math.min(SCROLL_EDGE, (end - start) / 3);
		const delta =
			axis - start < edge
				? -SCROLL_STEP
				: end - axis < edge
					? SCROLL_STEP
					: 0;
		const view = this.row.ownerDocument.defaultView;
		if (delta && view) {
			const property = drag.vertical ? "scrollTop" : "scrollLeft";
			this.frame = view.requestAnimationFrame(() => {
				this.frame = undefined;
				const before = this.row[property];
				this.row[property] = before + delta;
				if (this.row[property] !== before) {
					this.preview(drag);
				}
			});
		}
	}

	private stopScroll(): void {
		if (this.frame !== undefined) {
			this.row.ownerDocument.defaultView?.cancelAnimationFrame(
				this.frame,
			);
			this.frame = undefined;
		}
	}

	private markDrop(drop: Drop | undefined): void {
		if (this.drop?.tile === drop?.tile && this.drop?.side === drop?.side) {
			return;
		}
		this.drop?.tile.removeAttribute("data-vault-dock-drop");
		this.drop = drop;
		if (drop) {
			drop.tile.dataset.vaultDockDrop = drop.side;
		}
	}
}
