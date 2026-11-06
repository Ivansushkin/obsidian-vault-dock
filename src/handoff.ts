import {
	validBounds,
	type Bounds,
	type Desktop,
	type RegisteredVault,
} from "./desktop";
import { DEFAULT_SWITCHING_MODE, type SwitchingMode } from "./switching-mode";

const REQUEST_KEY = "vault-switcher-bar:request";
const REPLY_KEY = "vault-switcher-bar:reply";
const REVEAL_KEY = "vault-switcher-bar:reveal";
const LOCK_NAME = "vault-switcher-bar:handoff";
const FOCUS_TIMEOUT = 500;

type Request = {
	id: string;
	sourceId: string;
	targetId: string;
	bounds: Bounds;
	expires: number;
};
type Reply = {
	id: string;
	status: "ready" | "failed";
	windowId: number;
	hidden?: boolean;
};
type Reveal = Pick<Request, "targetId" | "expires">;
type Result = "ok" | "busy" | "timeout" | "failed" | "ignored";

function parse<T>(value: string | null): Partial<T> | null {
	try {
		return value ? (JSON.parse(value) as Partial<T>) : null;
	} catch {
		return null;
	}
}

function read<T>(storage: Storage, key: string): Partial<T> | null {
	return parse<T>(storage.getItem(key));
}

/** Coordinate one acknowledged switch per Obsidian profile. */
export class Handoff {
	private readonly lifecycle = new AbortController();
	private switching = false;
	private preparedId?: string;
	private hidden = false;
	private stopWatchingTargetClose?: () => void;

	constructor(
		private readonly win: Window,
		private readonly desktop: Desktop,
		private readonly currentId: string,
		private readonly timeout = 12_000,
	) {
		this.win.addEventListener(
			"focus",
			() => {
				if (this.hidden && this.win.document.hasFocus()) {
					this.clearHiddenState();
				}
			},
			{ signal: this.lifecycle.signal },
		);
	}

	dispose(): void {
		this.lifecycle.abort();
		this.restoreHiddenWindow();
		this.clearHiddenState();
	}

	/** Restore only a window that this handoff previously hid. */
	restoreHiddenWindow(): void {
		if (!this.hidden) {
			return;
		}
		try {
			if (!this.desktop.isWindowVisible(this.desktop.windowId)) {
				this.desktop.showInactive();
			}
			this.clearHiddenState();
		} catch {
			// The native window may already be gone during shutdown.
		}
	}

	private clearHiddenState(): void {
		this.hidden = false;
		this.stopWatchingTargetClose?.();
		this.stopWatchingTargetClose = undefined;
	}

	/** Close this hidden source only after its destination has closed. */
	private closeHiddenWindow(): void {
		this.stopWatchingTargetClose = undefined;
		if (!this.hidden || this.lifecycle.signal.aborted) {
			return;
		}
		try {
			const visible = this.desktop.isWindowVisible(this.desktop.windowId);
			this.hidden = false;
			if (!visible) {
				this.desktop.close();
			}
		} catch {
			this.hidden = true;
			this.restoreHiddenWindow();
		}
	}

	receive(layoutReady: boolean, event?: StorageEvent): void {
		if (this.lifecycle.signal.aborted) {
			return;
		}
		try {
			if (event?.key === REVEAL_KEY) {
				const reveal = parse<Reveal>(event.newValue);
				if (
					this.hidden &&
					reveal?.targetId === this.currentId &&
					typeof reveal.expires === "number" &&
					reveal.expires > Date.now() &&
					!this.desktop.isWindowVisible(this.desktop.windowId)
				) {
					this.desktop.showWindow(this.desktop.windowId);
					this.clearHiddenState();
				}
				return;
			}
			const storage = this.win.localStorage;
			const request = read<Request>(storage, REQUEST_KEY);
			if (
				!request ||
				typeof request.id !== "string" ||
				typeof request.expires !== "number" ||
				request.expires <= Date.now() ||
				request.targetId !== this.currentId ||
				request.sourceId === this.currentId ||
				!validBounds(request.bounds) ||
				read<Reply>(storage, REPLY_KEY)?.id === request.id
			) {
				return;
			}

			let status: Reply["status"] = "ready";
			try {
				if (request.id !== this.preparedId) {
					this.desktop.setBounds(request.bounds);
					this.preparedId = request.id;
				}
			} catch {
				status = "failed";
			}
			if (status === "ready" && !layoutReady) {
				return;
			}
			const reply: Reply = {
				id: request.id,
				status,
				windowId: this.desktop.windowId,
				hidden:
					this.hidden &&
					!this.desktop.isWindowVisible(this.desktop.windowId),
			};
			if (
				request.expires > Date.now() &&
				read<Request>(storage, REQUEST_KEY)?.id === request.id
			) {
				storage.setItem(REPLY_KEY, JSON.stringify(reply));
			}
		} catch {
			// The source keeps its window if the profile cannot deliver a reply.
		}
	}

	async switchTo(
		targetId: string,
		mode: SwitchingMode = DEFAULT_SWITCHING_MODE,
	): Promise<Result> {
		if (targetId === this.currentId || this.lifecycle.signal.aborted) {
			return "ignored";
		}
		if (this.switching) {
			return "busy";
		}
		this.switching = true;
		try {
			const result: unknown = await this.win.navigator.locks.request(
				LOCK_NAME,
				{ ifAvailable: true },
				async (lock): Promise<Result> => {
					if (!lock) {
						return "busy";
					}
					if (this.lifecycle.signal.aborted) {
						return "ignored";
					}
					const target = this.desktop
						.list()
						.find((vault) => vault.id === targetId);
					if (!target) {
						return "failed";
					}
					switch (mode) {
						case "focus":
							await this.desktop.openOrFocus(target);
							this.requestReveal(targetId);
							return "ok";
						case "keep-open":
							return this.handoffWindow(target, true);
						case "replace":
							return this.handoffWindow(target, false);
					}
				},
			);
			return result as Result;
		} catch {
			return "failed";
		} finally {
			this.switching = false;
		}
	}

	/** Reveal a plugin-hidden window after Obsidian accepts the open request. */
	private requestReveal(targetId: string): void {
		try {
			const storage = this.win.localStorage;
			const reveal: Reveal = {
				targetId,
				expires: Date.now() + this.timeout,
			};
			storage.setItem(REVEAL_KEY, JSON.stringify(reveal));
			storage.removeItem(REVEAL_KEY);
		} catch {
			// Opening a vault through its URI does not require plugin storage.
		}
	}

	/** Prepare the target geometry, then retire the source when the target is ready. */
	private async handoffWindow(
		target: RegisteredVault,
		keepOpen: boolean,
	): Promise<Result> {
		const storage = this.win.localStorage;
		const request: Request = {
			id: this.win.crypto.randomUUID(),
			sourceId: this.currentId,
			targetId: target.id,
			bounds: this.desktop.getBounds(),
			expires: Date.now() + this.timeout,
		};
		try {
			storage.setItem(REQUEST_KEY, JSON.stringify(request));
			if (!target.open) {
				this.desktop.open(target);
			}
			const reply = await this.waitForReply(storage, request);
			if (this.lifecycle.signal.aborted) {
				return "ignored";
			}
			if (!reply) {
				return "timeout";
			}
			const { windowId, hidden = false } = reply;
			if (
				reply.status !== "ready" ||
				windowId === this.desktop.windowId ||
				(keepOpen && reply.hidden === undefined) ||
				!this.desktop.isReadyWindow(
					windowId,
					request.bounds,
					keepOpen || hidden,
				)
			) {
				return "failed";
			}
			if (
				hidden ||
				(keepOpen && !this.desktop.isWindowVisible(windowId))
			) {
				this.desktop.showWindow(windowId);
			} else if (target.open) {
				this.desktop.open(target);
			}
			if (keepOpen || hidden) {
				const focused = await this.waitForFocus(windowId, request);
				if (this.lifecycle.signal.aborted) {
					return "ignored";
				}
				if (!focused) {
					return "failed";
				}
			} else if (!this.desktop.isReadyWindow(windowId, request.bounds)) {
				return "failed";
			}
			if (keepOpen) {
				this.clearHiddenState();
				this.stopWatchingTargetClose = this.desktop.watchWindowClose(
					windowId,
					() => this.closeHiddenWindow(),
				);
				this.hidden = true;
				try {
					this.desktop.hide();
				} catch (error) {
					this.restoreHiddenWindow();
					throw error;
				}
			} else {
				this.desktop.close();
			}
			return "ok";
		} finally {
			if (read<Request>(storage, REQUEST_KEY)?.id === request.id) {
				storage.removeItem(REQUEST_KEY);
			}
			if (read<Reply>(storage, REPLY_KEY)?.id === request.id) {
				storage.removeItem(REPLY_KEY);
			}
		}
	}

	/** Native focus can settle after the show or focus request returns. */
	private async waitForFocus(
		windowId: number,
		request: Request,
	): Promise<boolean> {
		const deadline = Math.min(request.expires, Date.now() + FOCUS_TIMEOUT);
		while (!this.lifecycle.signal.aborted && Date.now() < request.expires) {
			if (
				this.desktop.isReadyWindow(windowId, request.bounds) &&
				this.desktop.isWindowFocused(windowId)
			) {
				return true;
			}
			if (Date.now() >= deadline) {
				return false;
			}
			await new Promise<void>((resolve) =>
				this.win.setTimeout(resolve, 25),
			);
		}
		return false;
	}

	private waitForReply(
		storage: Storage,
		request: Request,
	): Promise<Reply | undefined> {
		return new Promise((resolve) => {
			const signal = this.lifecycle.signal;
			const finish = (reply?: Reply) => {
				this.win.clearTimeout(timer);
				this.win.removeEventListener("storage", inspect);
				signal.removeEventListener("abort", abort);
				resolve(reply);
			};
			const abort = () => finish();
			const inspect = () => {
				if (Date.now() >= request.expires) {
					finish();
					return;
				}
				const reply = read<Reply>(storage, REPLY_KEY);
				if (
					reply?.id === request.id &&
					(reply.status === "ready" || reply.status === "failed") &&
					typeof reply.windowId === "number" &&
					Number.isInteger(reply.windowId)
				) {
					finish({
						id: request.id,
						status: reply.status,
						windowId: reply.windowId,
						hidden:
							typeof reply.hidden === "boolean"
								? reply.hidden
								: undefined,
					});
				}
			};
			const timer = this.win.setTimeout(
				abort,
				Math.max(0, request.expires - Date.now()),
			);
			this.win.addEventListener("storage", inspect);
			signal.addEventListener("abort", abort, { once: true });
			if (signal.aborted) {
				abort();
			} else {
				inspect();
			}
		});
	}
}
