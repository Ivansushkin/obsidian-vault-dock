import { id as pluginId } from "../manifest.json";

export type Bounds = { x: number; y: number; width: number; height: number };
export type WindowState = "normal" | "maximized" | "fullscreen";

const WINDOW_POLL_INTERVAL = 100;

export type RegisteredVault = {
	id: string;
	path: string;
	name: string;
	open: boolean;
};

type WindowTransition =
	| "restore"
	| "leave-full-screen"
	| "unmaximize"
	| "enter-full-screen"
	| "maximize";
type WindowEvent = "closed" | WindowTransition;

type NativeWindow = {
	id: number;
	webContents?: {
		getURL(): string;
		executeJavaScript(code: string): Promise<unknown>;
	};
	getBounds(): Bounds;
	getNormalBounds?(): Bounds;
	setBounds(bounds: Bounds): void;
	isVisible(): boolean;
	isMaximized(): boolean;
	maximize(): void;
	isFullScreen(): boolean;
	setFullScreen(fullscreen: boolean): void;
	unmaximize(): void;
	restore(): void;
	isMinimized(): boolean;
	isDestroyed(): boolean;
	isFocused(): boolean;
	show(): void;
	showInactive(): void;
	hide(): void;
	once(event: WindowEvent, listener: () => void): void;
	removeListener(event: WindowEvent, listener: () => void): void;
};

type ElectronShell = { openExternal(url: string): Promise<void> };

type DesktopWindow = Window & {
	electron?: {
		ipcRenderer?: {
			sendSync: (channel: string, ...args: unknown[]) => unknown;
		};
		remote?: {
			BrowserWindow?: {
				fromId(id: number): NativeWindow | null;
				getAllWindows?(): NativeWindow[];
			};
		};
		shell?: ElectronShell;
	};
	electronWindow?: NativeWindow;
	require?: (id: "electron") => { shell?: ElectronShell };
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

export function validBounds(value: unknown): value is Bounds {
	return (
		isRecord(value) &&
		Number.isInteger(value.x) &&
		Number.isInteger(value.y) &&
		typeof value.width === "number" &&
		Number.isInteger(value.width) &&
		value.width > 0 &&
		typeof value.height === "number" &&
		Number.isInteger(value.height) &&
		value.height > 0
	);
}

function matchesBounds(first: Bounds, second: Bounds): boolean {
	return (
		first.x === second.x &&
		first.y === second.y &&
		first.width === second.width &&
		first.height === second.height
	);
}

function isNormalWindow(win: NativeWindow): boolean {
	return !win.isMaximized() && !win.isFullScreen() && !win.isMinimized();
}

function getWindowState(win: NativeWindow): WindowState {
	if (win.isFullScreen()) {
		return "fullscreen";
	}
	return win.isMaximized() ? "maximized" : "normal";
}

function requireNormalWindow(win: NativeWindow): void {
	if (!isNormalWindow(win)) {
		throw new Error("Vault switching requires normal windows");
	}
}

/** Subscribe before requesting a native state change, including synchronous events. */
function waitForWindowTransition(
	win: Window,
	target: NativeWindow,
	event: WindowTransition,
	isPending: () => boolean,
	change: () => void,
	expires: number,
	signal: AbortSignal,
): Promise<void> {
	return new Promise((resolve, reject) => {
		const remaining = expires - Date.now();
		if (signal.aborted || remaining <= 0 || target.isDestroyed()) {
			reject(new Error("The window transition was cancelled"));
			return;
		}
		const cleanup = () => {
			win.clearTimeout(timer);
			signal.removeEventListener("abort", cancel);
			try {
				if (!target.isDestroyed()) {
					target.removeListener(event, complete);
					target.removeListener("closed", cancel);
				}
			} catch {
				// The native window may close before listener removal reaches it.
			}
		};
		const complete = () => {
			cleanup();
			resolve();
		};
		const cancel = () => {
			cleanup();
			reject(new Error("The window transition was cancelled"));
		};
		const timer = win.setTimeout(cancel, remaining);
		signal.addEventListener("abort", cancel, { once: true });
		try {
			target.once(event, complete);
			target.once("closed", cancel);
			if (isPending()) {
				change();
			} else {
				complete();
			}
		} catch (error) {
			cleanup();
			reject(
				new Error("Could not change the native window state", {
					cause: error,
				}),
			);
		}
	});
}

export type Desktop = {
	currentId: string;
	windowId: number;
	list(): RegisteredVault[];
	getWindowPlacement(): { bounds: Bounds; state: WindowState };
	isNormalWindow(id: number): boolean;
	normalizeWindow(
		id: number,
		expires: number,
		signal: AbortSignal,
	): Promise<void>;
	setBounds(bounds: Bounds, windowId?: number): void;
	applyWindowState(
		id: number,
		state: Exclude<WindowState, "normal">,
		expires: number,
		signal: AbortSignal,
	): Promise<void>;
	findWindowWithoutPlugin(
		targetId: string,
		expires: number,
		signal: AbortSignal,
	): Promise<number | undefined>;
	runNativeVaultMenuAction(
		action: () => void,
		select: (path: string) => void,
	): void;
	open(target: RegisteredVault): void;
	openOrFocus(target: RegisteredVault): Promise<void>;
	isReadyWindow(
		id: number,
		bounds: Bounds | undefined,
		allowHidden?: boolean,
		state?: WindowState,
	): boolean;
	isWindowVisible(id: number): boolean;
	isWindowFocused(id: number): boolean;
	showWindow(id: number): void;
	showInactive(): void;
	hide(): void;
	watchWindowClose(id: number, listener: () => void): () => void;
	close(): void;
};

/** Isolate the window bridge and vault IPC used by Obsidian desktop. */
export function connectDesktop(win: DesktopWindow): Desktop | undefined {
	const ipc = win.electron?.ipcRenderer;
	const windows = win.electron?.remote?.BrowserWindow;
	const native = win.electronWindow;
	if (
		typeof ipc?.sendSync !== "function" ||
		typeof windows?.fromId !== "function" ||
		!native ||
		!Number.isInteger(native.id) ||
		typeof native.getBounds !== "function" ||
		typeof native.setBounds !== "function" ||
		typeof native.isMaximized !== "function" ||
		typeof native.isMinimized !== "function" ||
		typeof native.isFullScreen !== "function"
	) {
		return undefined;
	}
	const current = ipc.sendSync("vault");
	if (!isRecord(current) || typeof current.id !== "string" || !current.id) {
		return undefined;
	}
	const getWindow = (id: number) => {
		const target = id === native.id ? native : windows.fromId(id);
		return target && !target.isDestroyed() ? target : undefined;
	};
	const openRegistered = (target: RegisteredVault) =>
		ipc.sendSync("vault-open", target.path, false) === true;
	// Electron cannot cancel an evaluation already sent to a renderer.
	const pendingWindowProbes = new Set<number>();
	return {
		currentId: current.id,
		windowId: native.id,
		list() {
			const registry = ipc.sendSync("vault-list");
			if (!isRecord(registry)) {
				throw new Error("Vault registry unavailable");
			}
			const vaults: RegisteredVault[] = [];
			for (const [id, entry] of Object.entries(registry)) {
				if (
					!id ||
					!isRecord(entry) ||
					typeof entry.path !== "string" ||
					!entry.path
				) {
					continue;
				}
				const name =
					entry.path.split(/[/\\]/u).filter(Boolean).at(-1) ??
					entry.path;
				vaults.push({
					id,
					path: entry.path,
					name,
					open: entry.open === true,
				});
			}
			return vaults;
		},
		getWindowPlacement() {
			if (native.isMinimized()) {
				throw new Error("The source window is minimized");
			}
			const state = getWindowState(native);
			const bounds =
				state === "normal"
					? native.getBounds()
					: native.getNormalBounds?.();
			if (!validBounds(bounds)) {
				throw new Error("Invalid window geometry");
			}
			return { bounds, state };
		},
		isNormalWindow(id) {
			const target = getWindow(id);
			return !!target && isNormalWindow(target);
		},
		async normalizeWindow(id, expires, signal) {
			const target = getWindow(id);
			if (!target) {
				throw new Error("The target window is unavailable");
			}
			if (target.isMinimized()) {
				await waitForWindowTransition(
					win,
					target,
					"restore",
					() => target.isMinimized(),
					() => target.restore(),
					expires,
					signal,
				);
			}
			if (target.isFullScreen()) {
				await waitForWindowTransition(
					win,
					target,
					"leave-full-screen",
					() => target.isFullScreen(),
					() => target.setFullScreen(false),
					expires,
					signal,
				);
			}
			if (target.isMaximized()) {
				await waitForWindowTransition(
					win,
					target,
					"unmaximize",
					() => target.isMaximized(),
					() => target.unmaximize(),
					expires,
					signal,
				);
			}
			requireNormalWindow(target);
		},
		setBounds(bounds, windowId = native.id) {
			const target = getWindow(windowId);
			if (!target) {
				throw new Error("The target window is unavailable");
			}
			requireNormalWindow(target);
			target.setBounds(bounds);
			if (!matchesBounds(target.getBounds(), bounds)) {
				throw new Error("Could not apply window geometry");
			}
		},
		async applyWindowState(id, state, expires, signal) {
			const target = getWindow(id);
			const fullscreen = state === "fullscreen";
			if (
				!target ||
				(fullscreen
					? typeof target.setFullScreen !== "function"
					: typeof target.maximize !== "function")
			) {
				throw new Error("The target window state cannot be changed");
			}
			await waitForWindowTransition(
				win,
				target,
				fullscreen ? "enter-full-screen" : "maximize",
				() => getWindowState(target) !== state,
				() => {
					if (fullscreen) {
						target.setFullScreen(true);
					} else {
						target.maximize();
					}
				},
				expires,
				signal,
			);
		},
		findWindowWithoutPlugin(targetId, expires, signal) {
			// Restricted Mode unloads plugins without clearing enabledPlugins.
			// An enabled plugin may also be absent while it is still loading.
			const vaultPage = "app://obsidian.md/index.html";
			const probe = `location.href === ${JSON.stringify(vaultPage)} &&
				window.app?.appId === ${JSON.stringify(targetId)} &&
				window.app.workspace?.layoutReady === true &&
				window.app.workspace.containerEl?.ownerDocument.defaultView === window &&
				window.app.plugins?.getPlugin?.(${JSON.stringify(pluginId)}) === null &&
				(window.app.plugins?.isEnabled?.() === false ||
					window.app.plugins?.enabledPlugins?.has?.(${JSON.stringify(pluginId)}) === false)`;
			return new Promise((resolve) => {
				const remaining = expires - Date.now();
				if (
					!windows.getAllWindows ||
					signal.aborted ||
					remaining <= 0
				) {
					resolve(undefined);
					return;
				}
				let finished = false;
				const finish = (id?: number) => {
					finished = true;
					win.clearTimeout(timeout);
					win.clearInterval(interval);
					signal.removeEventListener("abort", cancel);
					resolve(id);
				};
				const cancel = () => finish();
				const inspect = async (candidate: NativeWindow) => {
					try {
						const id = candidate.id;
						if (
							id === native.id ||
							pendingWindowProbes.has(id) ||
							candidate.isDestroyed() ||
							(!candidate.isVisible() && !candidate.isMinimized())
						) {
							return;
						}
						const contents = candidate.webContents;
						if (contents?.getURL() !== vaultPage) {
							return;
						}
						pendingWindowProbes.add(id);
						try {
							if (
								(await contents.executeJavaScript(probe)) ===
									true &&
								!finished &&
								Date.now() < expires &&
								!candidate.isDestroyed() &&
								(candidate.isVisible() ||
									candidate.isMinimized())
							) {
								finish(id);
							}
						} finally {
							pendingWindowProbes.delete(id);
						}
					} catch {
						// A candidate may close during the probe.
					}
				};
				const poll = () => {
					if (Date.now() >= expires) {
						cancel();
						return;
					}
					try {
						for (const candidate of windows.getAllWindows?.() ??
							[]) {
							void inspect(candidate);
						}
					} catch {
						// Retry enumeration while the switch is still pending.
					}
				};
				const timeout = win.setTimeout(cancel, remaining);
				const interval = win.setInterval(poll, WINDOW_POLL_INTERVAL);
				signal.addEventListener("abort", cancel, { once: true });
				poll();
			});
		},
		runNativeVaultMenuAction(action, select) {
			// The built-in item sends this IPC synchronously during its callback.
			const sendSync = ipc.sendSync;
			const ownSendSync = Object.hasOwn(ipc, "sendSync");
			let path: string | undefined;
			try {
				ipc.sendSync = (channel, ...args) => {
					if (
						channel === "vault-open" &&
						typeof args[0] === "string" &&
						args[1] === false &&
						args.length === 2
					) {
						path = args[0];
						return true;
					}
					return sendSync.call(ipc, channel, ...args);
				};
			} catch {
				action();
				return;
			}
			try {
				action();
			} finally {
				if (ownSendSync) {
					ipc.sendSync = sendSync;
				} else {
					Reflect.deleteProperty(ipc, "sendSync");
				}
			}
			if (path !== undefined) {
				select(path);
			}
		},
		open(target) {
			if (!openRegistered(target)) {
				throw new Error("Could not open target vault");
			}
		},
		async openOrFocus(target) {
			try {
				// Obsidian's URI handler may leave an existing window unfocused.
				if (openRegistered(target)) {
					return;
				}
			} catch {
				// Let Obsidian handle the registered ID through its public URI.
			}
			const shell =
				win.electron?.shell ?? win.require?.("electron").shell;
			if (typeof shell?.openExternal !== "function") {
				throw new Error("The desktop URI bridge is unavailable");
			}
			await shell.openExternal(
				`obsidian://open?vault=${encodeURIComponent(target.id)}`,
			);
		},
		isReadyWindow(id, bounds, allowHidden = false, state = "normal") {
			const target = getWindow(id);
			if (
				!target ||
				target.isMinimized() ||
				getWindowState(target) !== state ||
				(!allowHidden && !target.isVisible())
			) {
				return false;
			}
			if (!bounds) {
				return true;
			}
			const actual =
				state === "normal"
					? target.getBounds()
					: target.getNormalBounds?.();
			return !!actual && matchesBounds(actual, bounds);
		},
		isWindowVisible: (id) => getWindow(id)?.isVisible() ?? false,
		isWindowFocused: (id) => getWindow(id)?.isFocused() ?? false,
		showWindow(id) {
			const target = getWindow(id);
			if (!target) {
				throw new Error("The target window is unavailable");
			}
			target.show();
		},
		showInactive() {
			try {
				native.showInactive();
			} catch {
				native.show();
			}
		},
		hide() {
			native.hide();
			if (native.isVisible()) {
				throw new Error("Could not hide the source window");
			}
		},
		watchWindowClose(id, listener) {
			const target = getWindow(id);
			if (
				!target ||
				typeof target.once !== "function" ||
				typeof target.removeListener !== "function"
			) {
				throw new Error("Cannot watch the target window close");
			}
			let watching = true;
			const onClose = () => {
				if (watching) {
					watching = false;
					listener();
				}
			};
			target.once("closed", onClose);
			// The target can close between lookup and listener registration.
			if (target.isDestroyed()) {
				watching = false;
				throw new Error("The target window has already closed");
			}
			return () => {
				watching = false;
				try {
					if (!target.isDestroyed()) {
						target.removeListener("closed", onClose);
					}
				} catch {
					// The native window may close before the removal reaches Electron.
				}
			};
		},
		close: () => win.close(),
	};
}
