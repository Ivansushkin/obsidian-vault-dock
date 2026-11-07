import {
	validBounds,
	type Bounds,
	type Desktop,
	type RegisteredVault,
	type WindowState,
} from "./desktop";
import { DEFAULT_SWITCHING_MODE, type SwitchingMode } from "./switching-mode";

const REQUEST_KEY = "vault-dock:request";
const REPLY_KEY = "vault-dock:reply";
const REVEAL_KEY = "vault-dock:reveal";
const LOCK_NAME = "vault-dock:handoff";
const FOCUS_TIMEOUT = 500;

type Request = {
	id: string;
	sourceId: string;
	targetId: string;
	bounds: Bounds;
	state?: Exclude<WindowState, "normal">;
	expires: number;
};
type Reply = {
	id: string;
	status: "ready" | "failed";
	windowId: number;
	hidden?: boolean;
};
type Destination = Reply | { status: "without-plugin"; windowId: number };
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
	private preparing?: { id: string; controller: AbortController };
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

	async receive(layoutReady: boolean, event?: StorageEvent): Promise<void> {
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
			if (this.preparing && this.preparing.id !== request?.id) {
				this.preparing.controller.abort();
				this.preparing = undefined;
			}
			if (
				!request ||
				typeof request.id !== "string" ||
				typeof request.expires !== "number" ||
				request.expires <= Date.now() ||
				request.targetId !== this.currentId ||
				request.sourceId === this.currentId ||
				!validBounds(request.bounds) ||
				this.preparing?.id === request.id ||
				read<Reply>(storage, REPLY_KEY)?.id === request.id
			) {
				return;
			}

			const { expires } = request;
			const isCurrent = () =>
				!this.lifecycle.signal.aborted &&
				expires > Date.now() &&
				read<Request>(storage, REQUEST_KEY)?.id === request.id;
			let status: Reply["status"] = "ready";
			try {
				const windowId = this.desktop.windowId;
				const state = request.state;
				const preserveState =
					(state === "maximized" || state === "fullscreen") &&
					this.desktop.isReadyWindow(
						windowId,
						undefined,
						true,
						state,
					);
				const normal = this.desktop.isNormalWindow(windowId);
				if (!preserveState && !normal) {
					if (!layoutReady) {
						return;
					}
					const preparing = {
						id: request.id,
						controller: new AbortController(),
					};
					this.preparing = preparing;
					try {
						if (
							this.hidden &&
							!this.desktop.isWindowVisible(windowId)
						) {
							// macOS can restore fullscreen when a hidden window is shown.
							this.desktop.showInactive();
						}
						await this.desktop.normalizeWindow(
							windowId,
							expires,
							AbortSignal.any([
								this.lifecycle.signal,
								preparing.controller.signal,
							]),
						);
					} finally {
						if (this.preparing === preparing) {
							this.preparing = undefined;
						}
					}
					if (!isCurrent()) {
						return;
					}
				}
				if (
					!preserveState &&
					(!normal || request.id !== this.preparedId)
				) {
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
			if (isCurrent()) {
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
		let pending: AbortSignal | undefined;
		try {
			const waitForPrevious = this.hasIncomingFullscreenRequest();
			if (waitForPrevious) {
				pending = AbortSignal.any([
					this.lifecycle.signal,
					AbortSignal.timeout(this.timeout),
				]);
			}
			const result: unknown = await this.win.navigator.locks.request(
				LOCK_NAME,
				pending ? { signal: pending } : { ifAvailable: true },
				async (lock): Promise<Result> => {
					pending = undefined;
					if (!lock) {
						return "busy";
					}
					if (
						this.lifecycle.signal.aborted ||
						(waitForPrevious &&
							!this.desktop.isWindowVisible(
								this.desktop.windowId,
							))
					) {
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
			if (this.lifecycle.signal.aborted) {
				return "ignored";
			}
			return pending?.aborted ? "timeout" : "failed";
		} finally {
			this.switching = false;
		}
	}

	/** A fullscreen destination can receive clicks before the source releases its lock. */
	private hasIncomingFullscreenRequest(): boolean {
		try {
			const request = read<Request>(this.win.localStorage, REQUEST_KEY);
			return (
				request?.state === "fullscreen" &&
				request.targetId === this.currentId &&
				typeof request.expires === "number" &&
				request.expires > Date.now()
			);
		} catch {
			return false;
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
		const { bounds, state } = this.desktop.getWindowPlacement();
		const request: Request = {
			id: this.win.crypto.randomUUID(),
			sourceId: this.currentId,
			targetId: target.id,
			bounds,
			state: state === "normal" ? undefined : state,
			expires: Date.now() + this.timeout,
		};
		try {
			storage.setItem(REQUEST_KEY, JSON.stringify(request));
			if (!target.open) {
				this.desktop.open(target);
			}
			const reply = await this.waitForDestination(storage, request);
			if (this.lifecycle.signal.aborted) {
				return "ignored";
			}
			if (!reply) {
				return "timeout";
			}
			const { windowId } = reply;
			if (
				reply.status === "failed" ||
				windowId === this.desktop.windowId
			) {
				return "failed";
			}
			const withoutPlugin = reply.status === "without-plugin";
			const hideSource = keepOpen && !withoutPlugin;
			const hidden = !withoutPlugin && reply.hidden === true;
			// Keep already expanded windows in their native state, including hidden Spaces.
			const preserveState =
				state !== "normal" &&
				this.desktop.isReadyWindow(windowId, undefined, true, state);
			if (withoutPlugin && !preserveState) {
				await this.desktop.normalizeWindow(
					windowId,
					request.expires,
					this.lifecycle.signal,
				);
				if (this.lifecycle.signal.aborted) {
					return "ignored";
				}
				if (Date.now() >= request.expires) {
					return "timeout";
				}
				this.desktop.setBounds(request.bounds, windowId);
			} else if (
				!withoutPlugin &&
				keepOpen &&
				reply.hidden === undefined
			) {
				return "failed";
			}
			if (
				!preserveState &&
				!this.desktop.isReadyWindow(
					windowId,
					request.bounds,
					hideSource || hidden,
				)
			) {
				return "failed";
			}
			if (state === "maximized" && !preserveState) {
				await this.desktop.applyWindowState(
					windowId,
					state,
					request.expires,
					this.lifecycle.signal,
				);
			}
			if (this.lifecycle.signal.aborted) {
				return "ignored";
			}
			if (Date.now() >= request.expires) {
				return "timeout";
			}
			if (
				hidden ||
				(hideSource && !this.desktop.isWindowVisible(windowId))
			) {
				this.desktop.showWindow(windowId);
			} else if (target.open || !this.desktop.isWindowFocused(windowId)) {
				this.desktop.open(target);
			}
			const focused = await this.waitForFocus(
				windowId,
				request,
				preserveState || state === "maximized" ? state : "normal",
				state === "normal" ? FOCUS_TIMEOUT : undefined,
				preserveState,
			);
			if (this.lifecycle.signal.aborted) {
				return "ignored";
			}
			if (!focused) {
				return state !== "normal" && Date.now() >= request.expires
					? "timeout"
					: "failed";
			}
			if (state === "fullscreen" && !preserveState) {
				await this.desktop.applyWindowState(
					windowId,
					state,
					request.expires,
					this.lifecycle.signal,
				);
				if (this.lifecycle.signal.aborted) {
					return "ignored";
				}
				if (Date.now() >= request.expires) {
					return "timeout";
				}
				if (!this.desktop.isWindowFocused(windowId)) {
					this.desktop.open(target);
				}
				const ready = await this.waitForFocus(windowId, request, state);
				if (this.lifecycle.signal.aborted) {
					return "ignored";
				}
				if (!ready) {
					return Date.now() >= request.expires ? "timeout" : "failed";
				}
			}
			if (hideSource) {
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
		} catch (error) {
			if (this.lifecycle.signal.aborted) {
				return "ignored";
			}
			if (Date.now() >= request.expires) {
				return "timeout";
			}
			throw error;
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
		state: WindowState,
		focusTimeout?: number,
		preserveBounds = false,
	): Promise<boolean> {
		const deadline =
			focusTimeout === undefined
				? request.expires
				: Math.min(request.expires, Date.now() + focusTimeout);
		while (!this.lifecycle.signal.aborted && Date.now() < deadline) {
			if (
				this.desktop.isReadyWindow(
					windowId,
					preserveBounds ? undefined : request.bounds,
					false,
					state,
				) &&
				this.desktop.isWindowFocused(windowId)
			) {
				return true;
			}
			await new Promise<void>((resolve) =>
				this.win.setTimeout(resolve, 25),
			);
		}
		return false;
	}

	/** Wait for a plugin acknowledgment or a ready Obsidian window without it. */
	private waitForDestination(
		storage: Storage,
		request: Request,
	): Promise<Destination | undefined> {
		return new Promise((resolve) => {
			const signal = this.lifecycle.signal;
			const search = new AbortController();
			let finished = false;
			const finish = (reply?: Destination) => {
				finished = true;
				this.win.clearTimeout(timer);
				this.win.removeEventListener("storage", inspect);
				signal.removeEventListener("abort", abort);
				search.abort();
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
			const findWindow = async () => {
				const windowId = await this.desktop
					.findWindowWithoutPlugin(
						request.targetId,
						request.expires,
						search.signal,
					)
					.catch(() => undefined);
				if (
					!finished &&
					windowId !== undefined &&
					Date.now() < request.expires
				) {
					finish({ status: "without-plugin", windowId });
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
				if (!finished) {
					void findWindow();
				}
			}
		});
	}
}
