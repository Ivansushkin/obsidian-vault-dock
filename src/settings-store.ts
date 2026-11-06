import {
	DEFAULT_BAR_POSITION,
	isBarPosition,
	type BarPosition,
} from "./bar-position";
import { isLanguagePreference, type LanguagePreference } from "./i18n";
import {
	isPlaceholderColors,
	type PlaceholderColors,
} from "./placeholder-colors";
import {
	DEFAULT_SWITCHING_MODE,
	isSwitchingMode,
	type SwitchingMode,
} from "./switching-mode";
import { DEFAULT_TILE_SCALE, isTileScale } from "./tile-scale";

// Keep the original database and channel so existing vault settings stay accessible.
const DATABASE = "vault-switcher-bar";
const COMMON_IMAGES = "images";
const LOCAL_IMAGES = "local-images";
const SETTINGS = "settings";
const CHANNEL = "vault-switcher-bar:images";
const SCOPE_KEY = "scope";
const COMMON_MODE_KEY = "common-mode";
const PICTURE_REVISION_KEY = "picture-revision";
const PLACEHOLDER_COLOR_KEY = "placeholder-colors";
const CHANGE_MESSAGE = "settings-changed";
const LEGACY_BAR_POSITION_KEY = "bar-at-bottom";
const PROFILE_SETTING_KEYS = {
	language: "language",
	hideLabels: "hide-labels",
	barPosition: "bar-position",
	tileScale: "tile-scale",
};

export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const MAX_IMAGE_SIZE = 512 * 1024;

type Scope = { shared: boolean; scopeRevision: number };
type LocalImage = { vaultId: string; tileId: string; image: Blob };
type Stores = {
	common: IDBObjectStore;
	local: IDBObjectStore;
	settings: IDBObjectStore;
};

type ProfileSettings = {
	language: LanguagePreference;
	hideLabels: boolean;
	barPosition: BarPosition;
	tileScale: number;
};
export type ProfileSettingChange = {
	[Key in keyof ProfileSettings]: [key: Key, value: ProfileSettings[Key]];
}[keyof ProfileSettings];

type PictureCache = Scope & {
	ids: readonly string[];
	revision: number;
	generation: number;
	pictures: Map<string, Blob>;
};

export type SettingsSnapshot = Scope &
	ProfileSettings & {
		mode: SwitchingMode;
		pictures: Map<string, Blob>;
		placeholderColors: Map<string, PlaceholderColors>;
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

/** Old databases have pictures without a stored revision. */
async function readPictureRevision(
	settings: IDBObjectStore,
	key: IDBValidKey,
): Promise<number> {
	const value: unknown = await result(settings.get(key));
	return typeof value === "number" ? value : 0;
}

/** Persist and coordinate common and vault-specific settings in one profile. */
export class SettingsStore {
	private readonly channel = new BroadcastChannel(CHANNEL);
	private readonly localModeKey: string[];
	private readonly localPictureRevisionKey: string[];
	private database?: Promise<IDBDatabase>;
	private pictureCache?: PictureCache;
	private pictureGeneration = 0;
	private disposed = false;

	constructor(
		private readonly vaultId: string,
		onChange: () => void,
	) {
		this.localModeKey = ["vault", vaultId];
		this.localPictureRevisionKey = [PICTURE_REVISION_KEY, vaultId];
		this.channel.onmessage = (event: MessageEvent<unknown>) => {
			if (event.data !== CHANGE_MESSAGE) {
				// Older windows update images without incrementing the revision.
				this.pictureGeneration++;
			}
			onChange();
		};
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
						this.pictureGeneration++;
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

	/** Read the previous toggle when the position has never been selected. */
	private async readBarPosition(
		settings: IDBObjectStore,
	): Promise<BarPosition> {
		const position: unknown = await result(
			settings.get(PROFILE_SETTING_KEYS.barPosition),
		);
		if (isBarPosition(position)) {
			return position;
		}
		const legacy: unknown = await result(
			settings.get(LEGACY_BAR_POSITION_KEY),
		);
		return legacy === true ? "bottom" : DEFAULT_BAR_POSITION;
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

	private pictureRevisionKey(shared: boolean): IDBValidKey {
		return shared ? PICTURE_REVISION_KEY : this.localPictureRevisionKey;
	}

	/** Reuse Blob identities while the same committed picture set is current. */
	private async readPictures(
		stores: Stores,
		scope: Scope,
		ids: readonly string[],
		generation: number,
	): Promise<PictureCache> {
		const revision = await readPictureRevision(
			stores.settings,
			this.pictureRevisionKey(scope.shared),
		);
		const cached = this.pictureCache;
		if (
			cached?.generation === generation &&
			cached.shared === scope.shared &&
			cached.scopeRevision === scope.scopeRevision &&
			cached.revision === revision &&
			cached.ids.length === ids.length &&
			ids.every((id, index) => cached.ids[index] === id)
		) {
			return cached;
		}
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
			ids: [...ids],
			revision,
			generation,
			pictures:
				!pictures.size && cached?.pictures.size === 0
					? cached.pictures
					: pictures,
		};
	}

	/** Read profile-wide colors for the currently registered tiles. */
	private async readPlaceholderColors(
		settings: IDBObjectStore,
		ids: readonly string[],
	): Promise<Map<string, PlaceholderColors>> {
		const colors = new Map<string, PlaceholderColors>();
		await Promise.all(
			ids.map(async (id) => {
				const value: unknown = await result(
					settings.get([PLACEHOLDER_COLOR_KEY, id]),
				);
				if (isPlaceholderColors(value)) {
					colors.set(id, value);
				}
			}),
		);
		return colors;
	}

	async read(ids: readonly string[]): Promise<SettingsSnapshot> {
		const generation = this.pictureGeneration;
		const { snapshot, cache } = await this.transact(async (stores) => {
			const scope = await this.scope(stores);
			const [
				mode,
				language,
				hideLabels,
				barPosition,
				tileScale,
				placeholderColors,
			] = await Promise.all([
				scope.shared
					? this.commonMode(stores)
					: this.ensureLocalSettings(stores),
				result<unknown>(
					stores.settings.get(PROFILE_SETTING_KEYS.language),
				),
				result<unknown>(
					stores.settings.get(PROFILE_SETTING_KEYS.hideLabels),
				),
				this.readBarPosition(stores.settings),
				result<unknown>(
					stores.settings.get(PROFILE_SETTING_KEYS.tileScale),
				),
				this.readPlaceholderColors(stores.settings, ids),
			]);
			const cache = await this.readPictures(
				stores,
				scope,
				ids,
				generation,
			);
			const snapshot: SettingsSnapshot = {
				...scope,
				mode,
				language: isLanguagePreference(language) ? language : "system",
				hideLabels: hideLabels === true,
				barPosition,
				tileScale: isTileScale(tileScale)
					? tileScale
					: DEFAULT_TILE_SCALE,
				pictures: cache.pictures,
				placeholderColors,
			};
			return { snapshot, cache };
		});
		if (generation === this.pictureGeneration) {
			this.pictureCache = cache;
		}
		return snapshot;
	}

	async setProfileSetting(
		...[key, value]: ProfileSettingChange
	): Promise<void> {
		await this.transact(async ({ settings }) => {
			settings.put(value, PROFILE_SETTING_KEYS[key]);
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
			await this.writePicture(stores, scope, id, image);
		});
		this.notify();
	}

	/** Replace the scoped image and save the shared color pair atomically. */
	async savePlaceholderColors(
		id: string,
		colors: PlaceholderColors,
		scopeRevision: number,
	): Promise<void> {
		await this.transact(async (stores) => {
			const scope = await this.scope(stores, scopeRevision);
			await this.writePicture(stores, scope, id, undefined);
			stores.settings.put(colors, [PLACEHOLDER_COLOR_KEY, id]);
		});
		this.notify();
	}

	/** Change the image and invalidate the cache for its settings scope. */
	private async writePicture(
		stores: Stores,
		scope: Scope,
		id: string,
		image: Blob | undefined,
	): Promise<void> {
		const key = this.pictureRevisionKey(scope.shared);
		const revision = await readPictureRevision(stores.settings, key);
		stores.settings.put(revision + 1, key);
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
	}

	private notify(): void {
		if (!this.disposed) {
			this.channel.postMessage(CHANGE_MESSAGE);
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
