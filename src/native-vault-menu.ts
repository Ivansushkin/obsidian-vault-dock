import type { Menu } from "obsidian";
import type { Desktop } from "./desktop";
import type { Translate } from "./i18n";
import {
	SWITCHING_MODES,
	switchingModeLabels,
	type SwitchingMode,
} from "./switching-mode";

type NativeVaultMenuOptions = {
	readMode: () => SwitchingMode | undefined;
	setMode: (mode: SwitchingMode) => void;
	selectVault: (path: string) => void;
	t: Translate;
};

/** Decorate only the menu built by Obsidian's sidebar vault switcher. */
export function watchNativeVaultMenu(
	menuType: { forEvent: typeof Menu.forEvent },
	document: Document,
	desktop: Desktop,
	{ readMode, setMode, selectVault, t }: NativeVaultMenuOptions,
): () => void {
	const forEvent = menuType?.forEvent;
	if (typeof forEvent !== "function") {
		return () => {};
	}
	const observed = new WeakSet<Menu>();
	let active = true;
	const observe: typeof forEvent = function (event) {
		const menu = forEvent.call(menuType, event);
		const target = event.currentTarget as HTMLElement | null;
		if (
			event.type !== "click" ||
			target?.ownerDocument !== document ||
			!target.matches(".workspace-drawer-vault-switcher") ||
			observed.has(menu)
		) {
			return menu;
		}
		observed.add(menu);
		const addItem = menu.addItem.bind(menu);
		menu.addItem = (buildItem) =>
			addItem((item) => {
				// Keep the original method for restoration after the item is built.
				// eslint-disable-next-line @typescript-eslint/unbound-method
				const onClick = item.onClick;
				item.onClick = (action) =>
					onClick.call(item, (event) => {
						if (active && readMode() !== undefined) {
							desktop.runNativeVaultMenuAction(() => {
								action(event);
							}, selectVault);
						} else {
							action(event);
						}
					});
				try {
					buildItem(item);
				} finally {
					item.onClick = onClick;
				}
			});
		// Obsidian fills the menu synchronously and schedules its display.
		queueMicrotask(() => {
			const currentMode = readMode();
			if (!active || currentMode === undefined) {
				return;
			}
			menu.addSeparator();
			addItem((item) => {
				item.setTitle(t("switchingMode")).setIsLabel(true);
			});
			const labels = switchingModeLabels(t);
			for (const mode of SWITCHING_MODES) {
				addItem((item) => {
					item.setTitle(labels[mode])
						.setChecked(mode === currentMode)
						.onClick(() => {
							if (active && readMode() !== mode) {
								setMode(mode);
							}
						});
				});
			}
		});
		return menu;
	};
	try {
		menuType.forEvent = observe;
	} catch {
		return () => {};
	}
	return () => {
		active = false;
		if (menuType.forEvent === observe) {
			menuType.forEvent = forEvent;
		}
	};
}
