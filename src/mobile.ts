import { getLanguage, Notice, type Plugin } from "obsidian";
import { getMessages, type Translate } from "./i18n";
import {
	type MobileSettings,
	MobileSettingsTab,
	readMobileSettings,
} from "./mobile-settings";
import {
	findMobileVaultSwitcher,
	openMobileVault,
	readMobileVaults,
} from "./mobile-vault-switcher";
import { createTile, showInitials } from "./tile";
import { DEFAULT_TILE_SCALE } from "./tile-scale";

const DRAWER_HEADER =
	".workspace-drawer.mod-left > .workspace-drawer-inner > .workspace-drawer-header";

/** Mount the mobile dock and use Obsidian's native vault navigation. */
export async function startMobileDock(plugin: Plugin): Promise<void> {
	const { workspace } = plugin.app;
	const doc = workspace.containerEl.ownerDocument;
	let disposed = false;
	const dock = doc.createElement("div");
	dock.className = "vault-dock vault-dock-mobile";
	const row = dock.createDiv("vault-dock-tiles");
	row.setAttribute("role", "group");
	let switcher: HTMLSelectElement | undefined;
	let switcherObserver: MutationObserver | undefined;
	plugin.register(() => {
		disposed = true;
		switcherObserver?.disconnect();
		dock.remove();
	});

	let settings: MobileSettings;
	try {
		settings = readMobileSettings(await plugin.loadData());
	} catch {
		if (!disposed) {
			new Notice(
				getMessages("system", getLanguage()).settingsUnavailable,
			);
		}
		return;
	}
	if (disposed) {
		return;
	}

	const t: Translate = (key) =>
		getMessages(settings.language, getLanguage())[key];
	const render = () => {
		const native = switcher;
		const vaults = readMobileVaults(native);
		const select = (id: string) => {
			if (
				native !== switcher ||
				!native ||
				!openMobileVault(native, id)
			) {
				new Notice(t("mobileSwitchFailed"));
			}
		};
		row.setAttribute("aria-label", t("vaults"));
		row.classList.toggle("vault-dock-hide-labels", settings.hideLabels);
		dock.style.setProperty(
			"--vault-switcher-tile-scale",
			String((settings.tileScale / DEFAULT_TILE_SCALE) * 1.25),
		);
		const scrollLeft = row.scrollLeft;
		dock.hidden = vaults.length === 0;
		row.replaceChildren();
		for (const vault of vaults) {
			const { tile, picture } = createTile(row, vault, select);
			if (vault.id === native?.value) {
				tile.setAttribute("aria-current", "true");
			}
			showInitials(picture, vault.name);
		}
		row.scrollLeft = scrollLeft;
	};
	const mount = () => {
		const header = doc.querySelector(DRAWER_HEADER);
		if (!header) {
			dock.remove();
		} else if (header.nextElementSibling !== dock) {
			header.after(dock);
		}
		const next = findMobileVaultSwitcher(header);
		if (next !== switcher) {
			switcherObserver?.disconnect();
			switcher = next;
			if (next) {
				switcherObserver ??= new MutationObserver(render);
				switcherObserver.observe(next, {
					childList: true,
					subtree: true,
					characterData: true,
					attributes: true,
					attributeFilter: ["disabled", "label", "selected", "value"],
				});
			}
			render();
		}
	};

	let pending = Promise.resolve();
	const settingsTab = new MobileSettingsTab(
		plugin,
		() => settings,
		(change) => {
			pending = pending.then(async () => {
				if (disposed) {
					return;
				}
				const next = change(settings);
				try {
					await plugin.saveData(next);
				} catch {
					if (!disposed) {
						new Notice(t("saveSettingsFailed"));
						settingsTab.update();
					}
					return;
				}
				const languageChanged = next.language !== settings.language;
				settings = next;
				if (!disposed) {
					render();
					if (languageChanged) {
						settingsTab.update();
					}
				}
			});
			return pending;
		},
		t,
	);
	plugin.addSettingTab(settingsTab);
	render();
	workspace.onLayoutReady(() => {
		if (!disposed) {
			mount();
			plugin.registerEvent(workspace.on("layout-change", mount));
		}
	});
}
