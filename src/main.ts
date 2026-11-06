import { getLanguage, Notice, Plugin } from "obsidian";
import { Bar, ImageSettings, mountBar } from "./bar";
import { connectDesktop, type Desktop, type RegisteredVault } from "./desktop";
import { Handoff } from "./handoff";
import { getMessages, type Translate } from "./i18n";
import { SettingsStore, type SettingsSnapshot } from "./settings-store";
import { SwitcherSettingsTab } from "./settings-tab";

export default class VaultSwitcherBarPlugin extends Plugin {
	private vaults: RegisteredVault[] = [];
	private disposed = false;
	private pending = false;
	private modal?: ImageSettings;

	onload(): void {
		let messages = getMessages("system", getLanguage());
		const t: Translate = (key) => messages[key];
		const workspace = this.app.workspace;
		const container = workspace.containerEl;
		const win = container.ownerDocument.defaultView;
		let desktop: Desktop | undefined;
		try {
			desktop = win ? connectDesktop(win) : undefined;
		} catch {
			// Internal APIs may be unavailable on a different Obsidian build.
		}
		if (!win || !desktop) {
			new Notice(t("desktopUnavailable"));
			return;
		}

		const activeId = desktop.currentId;
		const handoff = new Handoff(win, desktop, activeId);
		handoff.receive(false);

		let settings: SettingsSnapshot | undefined;
		let readRevision = 0;
		let settingsUnavailable = false;
		const emptyPictures = new Map<string, Blob>();
		const store = new SettingsStore(activeId, () => void refreshSettings());
		const render = () =>
			bar.render(
				this.vaults,
				activeId,
				settings?.pictures ?? emptyPictures,
				this.pending || !settings,
			);
		const refreshSettings = async () => {
			const revision = ++readRevision;
			const next = await store
				.read(this.vaults.map(({ id }) => id))
				.catch(() => undefined);
			if (this.disposed || revision !== readRevision) {
				return;
			}
			if (!next) {
				if (!settingsUnavailable) {
					settingsUnavailable = true;
					new Notice(t("settingsUnavailable"));
				}
				return;
			}
			settingsUnavailable = false;
			const nextMessages = getMessages(next.language, getLanguage());
			const languageChanged = messages !== nextMessages;
			messages = nextMessages;
			const changed =
				languageChanged ||
				settings?.language !== next.language ||
				settings?.mode !== next.mode ||
				settings?.scopeRevision !== next.scopeRevision;
			settings = next;
			if (languageChanged) {
				bar.localize();
				this.modal?.localize();
			}
			if (next.mode !== "keep-open") {
				handoff.restoreHiddenWindow();
			}
			if (changed) {
				settingsTab.update();
			}
			render();
		};
		const refresh = () => {
			try {
				const vaults = desktop.list();
				const tilesChanged =
					this.vaults.length !== vaults.length ||
					vaults.some((vault, index) => {
						const previous = this.vaults[index];
						return (
							vault.id !== previous?.id ||
							vault.path !== previous.path ||
							vault.name !== previous.name
						);
					});
				this.vaults = vaults;
				if (tilesChanged) {
					render();
				}
			} catch {
				new Notice(t("registryUnavailable"));
			}
			void refreshSettings();
		};
		const select = async (id: string) => {
			if (id === activeId || this.pending || !settings) {
				return;
			}
			this.pending = true;
			render();
			const result = await handoff.switchTo(id, settings.mode);
			if (this.disposed) {
				return;
			}
			if (settings.mode !== "keep-open") {
				handoff.restoreHiddenWindow();
			}
			this.pending = false;
			render();
			if (result === "timeout") {
				new Notice(t("switchTimeout"));
			} else if (result === "busy") {
				new Notice(t("switchBusy"));
			} else if (result === "failed") {
				new Notice(t("switchFailed"));
			}
		};
		const bar = new Bar(
			container.ownerDocument,
			(id) => void select(id),
			() => {
				refresh();
				this.modal?.close();
				this.modal = new ImageSettings(
					this.app,
					this.vaults,
					() => settings?.scopeRevision,
					async (id, file, scopeRevision) => {
						await store.save(id, file, scopeRevision);
						await refreshSettings();
					},
					t,
				);
				this.modal.open();
			},
			t,
		);
		const settingsTab = new SwitcherSettingsTab(
			this,
			() => settings,
			async (change, scopeRevision) => {
				try {
					if ("mode" in change) {
						await store.setMode(change.mode, scopeRevision);
					} else if ("shared" in change) {
						await store.setShared(change.shared, scopeRevision);
					} else {
						await store.setLanguage(change.language);
					}
				} catch {
					new Notice(t("saveSettingsFailed"));
					settingsTab.update();
				}
				await refreshSettings();
			},
			t,
		);
		this.addSettingTab(settingsTab);
		const ready = () =>
			bar.element.isConnected &&
			this.vaults.some(({ id }) => id === activeId);
		const mount = () => {
			mountBar(container, bar.element);
			handoff.receive(ready());
		};

		this.register(() => {
			this.disposed = true;
			handoff.dispose();
			store.dispose();
			this.modal?.close();
			bar.dispose();
		});
		this.registerDomEvent(win, "storage", (event) =>
			handoff.receive(ready(), event),
		);
		this.registerDomEvent(win, "focus", refresh);
		workspace.onLayoutReady(() => {
			if (this.disposed) {
				return;
			}
			refresh();
			mount();
			this.registerEvent(workspace.on("layout-change", mount));
		});
	}
}
