export const PALETTE = {
	transparent: "transparent",
	white: "#ffffff",
	black: "#000000",
	gray: "#64748b",
	navy: "#1e293b",
	red: "#ef4444",
	orange: "#f97316",
	yellow: "#facc15",
	green: "#22c55e",
	teal: "#14b8a6",
	blue: "#3b82f6",
	purple: "#a855f7",
	pink: "#ec4899",
} as const;

export type PaletteName = keyof typeof PALETTE;
type PaletteColor = (typeof PALETTE)[PaletteName];
export type PlaceholderColors = {
	background: PaletteColor;
	text: Exclude<PaletteColor, typeof PALETTE.transparent>;
};

export const DEFAULT_PLACEHOLDER_COLORS: PlaceholderColors = {
	background: PALETTE.navy,
	text: PALETTE.white,
};

const paletteValues: ReadonlySet<unknown> = new Set(Object.values(PALETTE));

/** Accept only pairs that the picker can display and apply. */
export function isPlaceholderColors(
	value: unknown,
): value is PlaceholderColors {
	return (
		typeof value === "object" &&
		value !== null &&
		"background" in value &&
		"text" in value &&
		paletteValues.has(value.background) &&
		value.text !== PALETTE.transparent &&
		paletteValues.has(value.text)
	);
}
