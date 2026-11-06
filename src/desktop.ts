export type Bounds = { x: number; y: number; width: number; height: number };

export type RegisteredVault = {
	id: string;
	path: string;
	name: string;
	open: boolean;
};

type NativeWindow = {
	id: number;
	getBounds(): Bounds;
	setBounds(bounds: Bounds): void;
	isVisible(): boolean;
	isMaximized(): boolean;
	isFullScreen(): boolean;
	isMinimized(): boolean;
	isDestroyed(): boolean;
	isFocused(): boolean;
	show(): void;
	showInactive(): void;
	hide(): void;
	once(event: "closed", listener: () => void): void;
	removeListener(event: "closed", listener: () => void): void;
};

type ElectronShell = { openExternal(url: string): Promise<void> };

type DesktopWindow = Window & {
	electron?: {
		ipcRenderer?: {
			sendSync(channel: string, ...args: unknown[]): unknown;
		};
		remote?: {
			BrowserWindow?: { fromId(id: number): NativeWindow | null };
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

function requireNormalWindow(win: NativeWindow): void {
	if (win.isMaximized() || win.isFullScreen() || win.isMinimized()) {
		throw new Error("Vault switching requires normal windows");
	}
}

export type Desktop = {
	currentId: string;
	windowId: number;
	list(): RegisteredVault[];
	getBounds(): Bounds;
	setBounds(bounds: Bounds): void;
	open(target: RegisteredVault): void;
	openOrFocus(target: RegisteredVault): Promise<void>;
	isReadyWindow(id: number, bounds: Bounds, allowHidden?: boolean): boolean;
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
		getBounds() {
			requireNormalWindow(native);
			const bounds = native.getBounds();
			if (!validBounds(bounds)) {
				throw new Error("Invalid window geometry");
			}
			return bounds;
		},
		setBounds(bounds) {
			requireNormalWindow(native);
			native.setBounds(bounds);
			if (!matchesBounds(native.getBounds(), bounds)) {
				throw new Error("Could not apply window geometry");
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
		isReadyWindow(id, bounds, allowHidden = false) {
			const target = getWindow(id);
			return (
				!!target &&
				(allowHidden || target.isVisible()) &&
				matchesBounds(target.getBounds(), bounds)
			);
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
