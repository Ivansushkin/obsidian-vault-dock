import { isLanguagePreference, type LanguagePreference } from "./i18n";
import {
	DEFAULT_SWITCHING_MODE,
	isSwitchingMode,
	type SwitchingMode,
} from "./switching-mode";

const DATABASE = "vault-switcher-bar";
const COMMON_IMAGES = "images";
const LOCAL_IMAGES = "local-images";
const SETTINGS = "settings";
const CHANNEL = "vault-switcher-bar:images";
const SCOPE_KEY = "scope";
const COMMON_MODE_KEY = "common-mode";
const LANGUAGE_KEY = "language";

export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const MAX_IMAGE_SIZE = 512 * 1024;

type Scope = { shared: boolean; scopeRevision: number };
type LocalImage = { vaultId: string; tileId: string; image: Blob };
type Stores = {
	common: IDBObjectStore;
	local: IDBObjectStore;
	settings: IDBObjectStore;
};

export type SettingsSnapshot = Scope & {
	mode: SwitchingMode;
	language: LanguagePreference;
	pictures: Map<string, Blob>;
};

function result<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () =>
			reject(
				request.error ?? new Error("Settings storage request failed"),
			);
	});
}

/** Persist and coordinate common and vault-specific settings in one profile. */
export class SettingsStore {
	private readonly channel = new BroadcastChannel(CHANNEL);
	private readonly localModeKey: string[];
	private database?: Promise<IDBDatabase>;
	private disposed = false;

	constructor(
		private readonly vaultId: string,
		onChange: () => void,
	) {
		this.localModeKey = ["vault", vaultId];
		this.channel.onmessage = onChange;
	}

	private open(): Promise<IDBDatabase> {
		if (this.disposed) {
			return Promise.reject(new Error("Settings store is closed"));
		}
		if (!this.database) {
			const request = indexedDB.open(DATABASE, 2);
			request.onupgradeneeded = () => {
				const db = request.result;
				if (!db.objectStoreNames.contains(COMMON_IMAGES)) {
					db.createObjectStore(COMMON_IMAGES);
				}
				db.createObjectStore(LOCAL_IMAGES, {
					keyPath: ["vaultId", "tileId"],
				}).createIndex("vaultId", "vaultId");
				db.createObjectStore(SETTINGS);
			};
			this.database = new Promise<IDBDatabase>((resolve, reject) => {
				request.onsuccess = () => {
					const db = request.result;
					db.onversionchange = () => {
						db.close();
						this.database = undefined;
					};
					resolve(db);
				};
				request.onerror = () =>
					reject(
						request.error ??
							new Error("Could not open settings storage"),
					);
				request.onblocked = () => {
					// The queued open can still succeed after an old plugin window closes.
					request.onsuccess = () => request.result.close();
					reject(
						new Error("Settings upgrade blocked by another window"),
					);
				};
			}).catch((error: unknown) => {
				this.database = undefined;
				throw error;
			});
		}
		return this.database;
	}

	/** Scope changes and image edits share a transaction to prevent partial updates. */
	private async transact<T>(
		action: (stores: Stores) => Promise<T>,
	): Promise<T> {
		const db = await this.open();
		if (this.disposed) {
			throw new Error("Settings store is closed");
		}
		const transaction = db.transaction(
			[COMMON_IMAGES, LOCAL_IMAGES, SETTINGS],
			"readwrite",
		);
		const complete = new Promise<void>((resolve, reject) => {
			transaction.oncomplete = () => resolve();
			transaction.onabort = () =>
				reject(
					transaction.error ??
						new Error("Settings transaction aborted"),
				);
		});
		try {
			const value = await action({
				common: transaction.objectStore(COMMON_IMAGES),
				local: transaction.objectStore(LOCAL_IMAGES),
				settings: transaction.objectStore(SETTINGS),
			});
			await complete;
			return value;
		} catch (error) {
			try {
				transaction.abort();
			} catch {
				// IndexedDB may have aborted the transaction already.
			}
			await complete.catch(() => undefined);
			throw error;
		}
	}

	private async scope(stores: Stores, expected?: number): Promise<Scope> {
		const saved = (await result(stores.settings.get(SCOPE_KEY))) as
			Partial<Scope> | undefined;
		const scope = {
			shared: saved?.shared !== false,
			scopeRevision:
				typeof saved?.scopeRevision === "number"
					? saved.scopeRevision
					: 0,
		};
		if (expected !== undefined && scope.scopeRevision !== expected) {
			throw new Error("Settings scope changed");
		}
		return scope;
	}

	private async commonMode(stores: Stores): Promise<SwitchingMode> {
		const mode: unknown = await result(
			stores.settings.get(COMMON_MODE_KEY),
		);
		return isSwitchingMode(mode) ? mode : DEFAULT_SWITCHING_MODE;
	}

	/** Initialize a separate vault from the last common settings once. */
	private async ensureLocalSettings(stores: Stores): Promise<SwitchingMode> {
		const saved: unknown = await result(
			stores.settings.get(this.localModeKey),
		);
		if (isSwitchingMode(saved)) {
			return saved;
		}

		const [mode, ids, pictures] = await Promise.all([
			this.commonMode(stores),
			result(stores.common.getAllKeys()),
			result(stores.common.getAll()),
		]);
		for (const [index, tileId] of ids.entries()) {
			const image: unknown = pictures[index];
			if (typeof tileId === "string" && image instanceof Blob) {
				stores.local.put({ vaultId: this.vaultId, tileId, image });
			}
		}
		stores.settings.put(mode, this.localModeKey);
		return mode;
	}

	async read(ids: string[]): Promise<SettingsSnapshot> {
		return this.transact(async (stores) => {
			const scope = await this.scope(stores);
			const [mode, language] = await Promise.all([
				scope.shared
					? this.commonMode(stores)
					: this.ensureLocalSettings(stores),
				result<unknown>(stores.settings.get(LANGUAGE_KEY)),
			]);
			const pictures = new Map<string, Blob>();
			await Promise.all(
				ids.map(async (id) => {
					const request = scope.shared
						? stores.common.get(id)
						: stores.local.get([this.vaultId, id]);
					const value: unknown = await result(request);
					const image = scope.shared
						? value
						: (value as LocalImage | undefined)?.image;
					if (image instanceof Blob) {
						pictures.set(id, image);
					}
				}),
			);
			return {
				...scope,
				mode,
				language: isLanguagePreference(language) ? language : "system",
				pictures,
			};
		});
	}

	async setLanguage(language: LanguagePreference): Promise<void> {
		await this.transact(async ({ settings }) => {
			await result(settings.put(language, LANGUAGE_KEY));
		});
		this.notify();
	}

	async setShared(shared: boolean, scopeRevision: number): Promise<void> {
		const changed = await this.transact(async (stores) => {
			const scope = await this.scope(stores, scopeRevision);
			if (scope.shared === shared) {
				return false;
			}
			if (shared) {
				const mode = await this.ensureLocalSettings(stores);
				const pictures = (await result(
					stores.local.index("vaultId").getAll(this.vaultId),
				)) as LocalImage[];
				stores.common.clear();
				for (const { tileId, image } of pictures) {
					stores.common.put(image, tileId);
				}
				stores.settings.put(mode, COMMON_MODE_KEY);
			}
			stores.settings.put(
				{ shared, scopeRevision: scope.scopeRevision + 1 },
				SCOPE_KEY,
			);
			return true;
		});
		if (changed) {
			this.notify();
		}
	}

	async setMode(mode: SwitchingMode, scopeRevision: number): Promise<void> {
		await this.transact(async (stores) => {
			const scope = await this.scope(stores, scopeRevision);
			if (!scope.shared) {
				await this.ensureLocalSettings(stores);
			}
			stores.settings.put(
				mode,
				scope.shared ? COMMON_MODE_KEY : this.localModeKey,
			);
		});
		this.notify();
	}

	async save(
		id: string,
		image: Blob | undefined,
		scopeRevision: number,
	): Promise<void> {
		await this.transact(async (stores) => {
			const scope = await this.scope(stores, scopeRevision);
			if (scope.shared) {
				if (image) {
					stores.common.put(image, id);
				} else {
					stores.common.delete(id);
				}
				return;
			}

			await this.ensureLocalSettings(stores);
			if (image) {
				stores.local.put({ vaultId: this.vaultId, tileId: id, image });
			} else {
				stores.local.delete([this.vaultId, id]);
			}
		});
		this.notify();
	}

	private notify(): void {
		if (!this.disposed) {
			this.channel.postMessage(null);
		}
	}

	dispose(): void {
		this.disposed = true;
		this.channel.close();
		void this.database?.then(
			(db) => db.close(),
			() => undefined,
		);
	}
}
