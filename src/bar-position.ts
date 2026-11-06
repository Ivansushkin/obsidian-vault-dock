export type BarPosition = "top" | "bottom" | "left" | "right";

export const DEFAULT_BAR_POSITION: BarPosition = "top";

export function isBarPosition(value: unknown): value is BarPosition {
	return (
		value === "top" ||
		value === "bottom" ||
		value === "left" ||
		value === "right"
	);
}
