import { getLanguage, Notice, Plugin } from "obsidian";
import { Bar, mountBar } from "./bar";
import { DEFAULT_BAR_POSITION } from "./bar-position";
import { connectDesktop, type Desktop, type RegisteredVault } from "./desktop";
import { Handoff } from "./handoff";
import { getMessages, type Translate } from "./i18n";
import { SettingsStore, type SettingsSnapshot } from "./settings-store";
import { SwitcherSettingsTab } from "./settings-tab";

export default class ObsidianVaultDockPlugin extends Plugin {
	private vaults: RegisteredVault[] = [];
	private disposed = false;
	private pending = false;

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
		void handoff.receive(false);

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
				settings?.placeholderColors,
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
			const positionChanged =
				(settings?.barPosition ?? DEFAULT_BAR_POSITION) !==
				next.barPosition;
			const picturesChanged = settings?.pictures !== next.pictures;
			const previousColors = settings?.placeholderColors;
			const colorsChanged =
				previousColors?.size !== next.placeholderColors.size ||
				Array.from(next.placeholderColors).some(([id, colors]) => {
					const previous = previousColors.get(id);
					return (
						previous?.background !== colors.background ||
						previous?.text !== colors.text
					);
				});
			const labelsChanged =
				(settings?.hideLabels ?? false) !== next.hideLabels;
			const scaleChanged = settings?.tileScale !== next.tileScale;
			messages = nextMessages;
			const changed =
				languageChanged ||
				positionChanged ||
				scaleChanged ||
				settings?.language !== next.language ||
				settings?.mode !== next.mode ||
				settings?.hideLabels !== next.hideLabels ||
				settings?.scopeRevision !== next.scopeRevision;
			settings = next;
			bar.setPending(this.pending);
			if (scaleChanged) {
				bar.setTileScale(next.tileScale);
			}
			if (labelsChanged) {
				bar.setHideLabels(next.hideLabels);
			}
			if (languageChanged) {
				bar.localize();
			}
			if (next.mode !== "keep-open") {
				handoff.restoreHiddenWindow();
			}
			if (changed) {
				settingsTab.update();
			}
			if (picturesChanged || colorsChanged) {
				render();
			}
			if (positionChanged && workspace.layoutReady) {
				mount();
			}
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
			const mode = settings.mode;
			if (mode !== "focus") {
				this.pending = true;
				bar.setPending(true);
			}
			const result = await handoff.switchTo(id, mode);
			if (this.disposed) {
				return;
			}
			if (settings.mode !== "keep-open") {
				handoff.restoreHiddenWindow();
			}
			if (mode !== "focus") {
				this.pending = false;
				bar.setPending(false);
			}
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
			this.app,
			(id) => void select(id),
			() => settings?.scopeRevision,
			async (id, file, scopeRevision) => {
				await store.save(id, file, scopeRevision);
				await refreshSettings();
			},
			async (id, colors, scopeRevision) => {
				await store.savePlaceholderColors(id, colors, scopeRevision);
				await refreshSettings();
			},
			(scale) => settingsTab.setControlValue("tileScale", scale),
			t,
			(position) =>
				void settingsTab.setControlValue("barPosition", position),
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
						await store.setProfileSetting(...change.profile);
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
			const { parentElement, nextElementSibling } = bar.element;
			const position = bar.element.dataset.position;
			mountBar(
				container,
				bar.element,
				settings?.barPosition ?? DEFAULT_BAR_POSITION,
			);
			if (
				parentElement !== bar.element.parentElement ||
				nextElementSibling !== bar.element.nextElementSibling ||
				position !== bar.element.dataset.position
			) {
				bar.onPlacementChanged();
			}
			void handoff.receive(ready());
		};

		this.register(() => {
			this.disposed = true;
			handoff.dispose();
			store.dispose();
			bar.dispose();
		});
		this.registerDomEvent(
			win,
			"storage",
			(event) => void handoff.receive(ready(), event),
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
