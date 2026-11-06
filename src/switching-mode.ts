const SWITCHING_MODES = ["keep-open", "replace", "focus"] as const;

export type SwitchingMode = (typeof SWITCHING_MODES)[number];

export const DEFAULT_SWITCHING_MODE: SwitchingMode = "keep-open";

export function isSwitchingMode(value: unknown): value is SwitchingMode {
	return SWITCHING_MODES.some((mode) => mode === value);
}
