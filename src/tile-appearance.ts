import {
	DEFAULT_PLACEHOLDER_COLORS,
	type PlaceholderColors,
} from "./placeholder-colors";
import { findPreset, presetImage, type PresetId } from "./tile-presets";

type HeaderPart = readonly [offset: number, bytes: readonly number[]];

const IMAGE_HEADERS: ReadonlyMap<string, readonly HeaderPart[]> = new Map([
	["image/png", [[0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]]]],
	["image/jpeg", [[0, [0xff, 0xd8, 0xff]]]],
	[
		"image/webp",
		[
			[0, [0x52, 0x49, 0x46, 0x46]],
			[8, [0x57, 0x45, 0x42, 0x50]],
		],
	],
]);
export const IMAGE_TYPES = [...IMAGE_HEADERS.keys()];
const MAX_IMAGE_SIZE = 512 * 1024;

export type TileAppearance =
	| { kind: "initials"; colors?: PlaceholderColors }
	| { kind: "preset"; id: PresetId }
	| { kind: "image"; image: Blob };

export type TileAppearanceChange =
	{ colors: PlaceholderColors } | { image: Blob | undefined };

/** Keep the active preview and its remembered colors separate from saved settings. */
export class TileAppearanceDraft {
	private initial: TileAppearance;
	private current: TileAppearance;
	private fileCheck?: symbol;
	private colorsEdited = false;

	constructor(
		image?: Blob,
		private colors?: PlaceholderColors,
	) {
		this.initial = image
			? { kind: "image", image }
			: { kind: "initials", colors };
		this.current = this.initial;
	}

	get appearance(): TileAppearance {
		return this.current;
	}

	get swatches(): PlaceholderColors | undefined {
		return this.colors;
	}

	get checking(): boolean {
		return this.fileCheck !== undefined;
	}

	get changed(): boolean {
		const { current, initial } = this;
		switch (current.kind) {
			case "initials": {
				return (
					initial.kind !== "initials" ||
					current.colors?.background !== initial.colors?.background ||
					current.colors?.text !== initial.colors?.text
				);
			}
			case "preset": {
				return initial.kind !== "preset" || current.id !== initial.id;
			}
			case "image": {
				return (
					initial.kind !== "image" || current.image !== initial.image
				);
			}
		}
	}

	/** Highlight a previously saved preset without adding metadata to the stored image. */
	async identifyPreset(): Promise<void> {
		const initial = this.initial;
		if (initial.kind !== "image") {
			return;
		}
		const id = await findPreset(initial.image);
		if (id) {
			const preset = { kind: "preset", id } as const;
			if (this.current === initial) {
				this.current = preset;
			}
			this.initial = preset;
		}
	}

	choosePreset(id: PresetId): void {
		this.cancelFileCheck();
		this.current = { kind: "preset", id };
	}

	removeImage(): void {
		this.cancelFileCheck();
		this.current = { kind: "initials", colors: this.colors };
	}

	setColor(
		key: keyof PlaceholderColors,
		color: PlaceholderColors[keyof PlaceholderColors],
	): void {
		this.colors = {
			...(this.colors ?? DEFAULT_PLACEHOLDER_COLORS),
			[key]: color,
		};
		this.colorsEdited = true;
		this.removeImage();
	}

	/** Persist only the option shown in the preview when the user applies it. */
	toChange(): TileAppearanceChange {
		const current = this.current;
		switch (current.kind) {
			case "initials": {
				return this.colorsEdited && current.colors
					? { colors: current.colors }
					: { image: undefined };
			}
			case "preset": {
				return { image: presetImage(current.id) };
			}
			case "image": {
				return { image: current.image };
			}
		}
	}

	cancelFileCheck(): void {
		this.fileCheck = undefined;
	}

	/** Decode uploads before previewing them, ignoring checks superseded by a later choice. */
	async chooseFile(
		file: File,
	): Promise<"applied" | "invalid" | "superseded"> {
		this.cancelFileCheck();
		const signature = IMAGE_HEADERS.get(file.type);
		if (!signature || file.size > MAX_IMAGE_SIZE) {
			return "invalid";
		}
		const check = Symbol();
		this.fileCheck = check;
		let decoded = false;
		try {
			const header = new Uint8Array(
				await file.slice(0, 12).arrayBuffer(),
			);
			if (
				this.fileCheck === check &&
				signature.every(([offset, bytes]) =>
					bytes.every(
						(byte, index) => header[offset + index] === byte,
					),
				)
			) {
				const bitmap = await createImageBitmap(file);
				bitmap.close();
				decoded = true;
			}
		} catch {
			// A file with a supported MIME type can still be corrupt.
		}
		if (this.fileCheck !== check) {
			return "superseded";
		}
		this.cancelFileCheck();
		if (!decoded) {
			return "invalid";
		}
		this.current = { kind: "image", image: file };
		return "applied";
	}
}
