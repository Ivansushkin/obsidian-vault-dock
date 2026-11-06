import { isBarPosition } from "./bar-position";
import {
	DEFAULT_TILE_SCALE,
	MAX_TILE_SCALE,
	MIN_TILE_SCALE,
	TILE_SCALE_STEP,
} from "./tile-scale";

type Drag = {
	id: number;
	start: number;
	scalePerPixel: number;
	vertical: boolean;
	events: AbortController;
};

/** Preview the panel size while dragging and save it when the pointer is released. */
export class BarResize {
	private readonly handle: HTMLElement;
	private scale = DEFAULT_TILE_SCALE;
	private drag?: Drag;
	private saving = false;

	constructor(
		private readonly bar: HTMLElement,
		private readonly save: (scale: number) => Promise<void>,
	) {
		this.handle = bar.createDiv("vault-dock-resize");
		this.handle.hidden = true;
		this.handle.setAttribute("aria-hidden", "true");
		this.handle.addEventListener("pointerdown", (event) =>
			this.start(event),
		);
		this.handle.addEventListener("pointermove", (event) => {
			if (this.drag?.id === event.pointerId) {
				this.apply(this.preview(event, this.drag));
			}
		});
		this.handle.addEventListener("pointerup", (event) => {
			if (this.drag?.id === event.pointerId) {
				void this.commit(event, this.drag);
			}
		});
		for (const type of ["pointercancel", "lostpointercapture"] as const) {
			this.handle.addEventListener(type, (event) => {
				if (this.drag?.id === event.pointerId) {
					this.cancel();
				}
			});
		}
	}

	setScale(scale: number): void {
		this.scale = scale;
		this.handle.hidden = false;
		this.cancel();
	}

	cancel(): void {
		this.endDrag();
		this.apply(this.scale);
	}

	/** Measure the part of the strip that grows with the chosen tile scale. */
	private start(event: PointerEvent): void {
		const position = this.bar.dataset.position;
		if (
			event.button !== 0 ||
			this.drag ||
			this.saving ||
			!isBarPosition(position)
		) {
			return;
		}
		const vertical = position === "left" || position === "right";
		const size = this.bar
			.querySelector(
				vertical ? ".vault-dock-tile" : ".vault-dock-picture",
			)
			?.getBoundingClientRect();
		const extent = vertical ? size?.width : size?.height;
		if (!extent) {
			return;
		}
		const direction = position === "left" || position === "top" ? 1 : -1;
		const events = new AbortController();
		this.handle.setPointerCapture(event.pointerId);
		this.drag = {
			id: event.pointerId,
			start: vertical ? event.clientX : event.clientY,
			scalePerPixel: (direction * this.scale) / extent,
			vertical,
			events,
		};
		this.handle.classList.add("is-active");
		const view = this.bar.ownerDocument.defaultView;
		view?.addEventListener(
			"keydown",
			(key) => {
				if (key.key === "Escape") {
					key.preventDefault();
					key.stopPropagation();
					this.cancel();
				}
			},
			{ capture: true, signal: events.signal },
		);
		view?.addEventListener("blur", () => this.cancel(), {
			signal: events.signal,
		});
		event.preventDefault();
	}

	private preview(event: PointerEvent, drag: Drag): number {
		const coordinate = drag.vertical ? event.clientX : event.clientY;
		const scale =
			this.scale + (coordinate - drag.start) * drag.scalePerPixel;
		return Math.min(MAX_TILE_SCALE, Math.max(MIN_TILE_SCALE, scale));
	}

	/** Release the drag before saving so lost capture cannot cancel the commit. */
	private async commit(event: PointerEvent, drag: Drag): Promise<void> {
		const scale =
			Math.round(this.preview(event, drag) / TILE_SCALE_STEP) *
			TILE_SCALE_STEP;
		this.endDrag();
		this.apply(scale);
		if (scale === this.scale) {
			return;
		}
		this.saving = true;
		try {
			await this.save(scale);
		} finally {
			this.saving = false;
			this.apply(this.scale);
		}
	}

	private endDrag(): void {
		const drag = this.drag;
		if (!drag) {
			return;
		}
		this.drag = undefined;
		drag.events.abort();
		this.handle.classList.remove("is-active");
		if (this.handle.hasPointerCapture(drag.id)) {
			this.handle.releasePointerCapture(drag.id);
		}
	}

	private apply(scale: number): void {
		this.bar.setCssProps({
			"--vault-switcher-tile-scale": String(scale / DEFAULT_TILE_SCALE),
		});
	}
}
