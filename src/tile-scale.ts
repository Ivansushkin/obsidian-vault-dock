export const DEFAULT_TILE_SCALE = 100;
export const MIN_TILE_SCALE = 75;
export const MAX_TILE_SCALE = 150;
export const TILE_SCALE_STEP = 5;

/** Accept only values that the size control can persist. */
export function isTileScale(value: unknown): value is number {
	return (
		typeof value === "number" &&
		value >= MIN_TILE_SCALE &&
		value <= MAX_TILE_SCALE &&
		value % TILE_SCALE_STEP === 0
	);
}
