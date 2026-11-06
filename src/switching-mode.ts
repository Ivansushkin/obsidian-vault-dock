const SWITCHING_MODES = ["replace", "keep-open", "focus"] as const;

export type SwitchingMode = (typeof SWITCHING_MODES)[number];

export const DEFAULT_SWITCHING_MODE: SwitchingMode = "replace";

export function isSwitchingMode(value: unknown): value is SwitchingMode {
	return SWITCHING_MODES.some((mode) => mode === value);
}
