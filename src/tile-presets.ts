import book from "./presets/book.webp";
import briefcase from "./presets/briefcase.webp";
import code from "./presets/code.webp";
import compass from "./presets/compass.webp";
import flask from "./presets/flask.webp";
import home from "./presets/home.webp";
import music from "./presets/music.webp";
import spark from "./presets/spark.webp";

export const TILE_PRESETS = {
	book,
	briefcase,
	code,
	compass,
	flask,
	home,
	music,
	spark,
};

export type PresetId = keyof typeof TILE_PRESETS;

/** Decode only the selected bundled image before saving it as a tile picture. */
export function presetImage(id: PresetId): Blob {
	const source = TILE_PRESETS[id];
	const bytes = Uint8Array.from(
		atob(source.slice(source.indexOf(",") + 1)),
		(char) => char.charCodeAt(0),
	);
	return new Blob([bytes], { type: "image/webp" });
}

/** Match the bytes of pictures saved by earlier versions of the picker. */
export async function findPreset(image: Blob): Promise<PresetId | undefined> {
	if (image.type !== "image/webp") {
		return undefined;
	}
	let source: Uint8Array | undefined;
	for (const id of Object.keys(TILE_PRESETS) as PresetId[]) {
		const candidate = presetImage(id);
		if (candidate.size === image.size) {
			const original = (source ??= new Uint8Array(
				await image.arrayBuffer(),
			));
			const bytes = new Uint8Array(await candidate.arrayBuffer());
			if (bytes.every((byte, index) => byte === original[index])) {
				return id;
			}
		}
	}
	return undefined;
}
