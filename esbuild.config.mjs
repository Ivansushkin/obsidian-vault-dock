import { context, build } from "esbuild";
import { copyFileSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { parseArgs, parseEnv } from "node:util";

const { values } = parseArgs({
	options: {
		watch: { type: "boolean" },
		vault: { type: "string" },
		"no-install": { type: "boolean" },
	},
});
const entry = resolve("src/main.ts");
const buildDir = resolve("build");
const assets = ["manifest.json", "styles.css"].map((path) => resolve(path));
const manifestPath = assets[0];

/** Read the configured plugin directories, with a fallback to the single path. */
function readLocalPluginDirs() {
	let source;
	try {
		source = readFileSync(".env", "utf8");
	} catch (error) {
		if (error.code === "ENOENT") {
			return [];
		}
		throw new Error("Could not read the local .env file.");
	}
	const env = parseEnv(source);
	const pluginDirs = (env.VAULT_SWITCHER_PLUGIN_PATHS ?? "")
		.split("\n")
		.map((path) => path.trim())
		.filter(Boolean);
	const legacyDir = env.VAULT_SWITCHER_PLUGIN_PATH?.trim();
	if (pluginDirs.length === 0 && legacyDir) {
		pluginDirs.push(legacyDir);
	}
	if (!pluginDirs.every(isAbsolute)) {
		throw new Error("Plugin installation paths in .env must be absolute.");
	}
	return pluginDirs;
}

const configDir =
	!values["no-install"] && values.vault
		? resolve(values.vault, ".obsidian")
		: undefined;
const localPluginDirs =
	!values["no-install"] && !configDir && process.env.CI !== "true"
		? readLocalPluginDirs()
		: [];
if (
	process.env.npm_lifecycle_event === "install:dev" &&
	!configDir &&
	localPluginDirs.length === 0
) {
	throw new Error(
		'Set VAULT_SWITCHER_PLUGIN_PATHS in .env or run npm run install:dev -- --vault "/path/to/test-vault".',
	);
}

if (
	configDir &&
	!statSync(configDir, { throwIfNoEntry: false })?.isDirectory()
) {
	throw new Error(
		"Open the test vault in Obsidian before installing the plugin.",
	);
}

const pluginAssets = {
	name: "obsidian-plugin-assets",
	setup(builder) {
		builder.onLoad({ filter: /[\\/]src[\\/]main\.ts$/ }, ({ path }) => ({
			contents: readFileSync(path),
			loader: "ts",
			resolveDir: dirname(path),
			watchFiles: assets,
		}));
		builder.onEnd(({ errors }) => {
			if (errors.length > 0) {
				return;
			}
			for (const asset of assets) {
				copyFileSync(asset, join(buildDir, basename(asset)));
			}
			if (!configDir && localPluginDirs.length === 0) {
				return;
			}
			const { id } = JSON.parse(readFileSync(manifestPath, "utf8"));
			if (typeof id !== "string" || !/^[a-z]+(?:-[a-z]+)*$/u.test(id)) {
				throw new Error("Invalid plugin ID in manifest.json.");
			}
			const pluginDirs = configDir
				? [join(configDir, "plugins", id)]
				: localPluginDirs;
			const installErrors = [];
			for (const pluginDir of pluginDirs) {
				try {
					mkdirSync(pluginDir, { recursive: true });
					for (const asset of [
						"main.js",
						"manifest.json",
						"styles.css",
					]) {
						copyFileSync(
							join(buildDir, asset),
							join(pluginDir, asset),
						);
					}
				} catch (error) {
					installErrors.push({
						text: `Could not install Vault Switcher Bar to ${pluginDir}. The destination may be partially updated. ${String(error)}`,
					});
					continue;
				}
				console.log(`Installed Vault Switcher Bar to ${pluginDir}`);
			}
			return { errors: installErrors };
		});
	},
};

const options = {
	entryPoints: [entry],
	outfile: join(buildDir, "main.js"),
	bundle: true,
	format: "cjs",
	platform: "browser",
	target: "es2022",
	external: ["obsidian", "electron"],
	logLevel: "info",
	minify: !values.watch,
	sourcemap: values.watch ? "inline" : false,
	plugins: [pluginAssets],
};

if (values.watch) {
	const watcher = await context(options);
	await watcher.watch();
} else {
	await build(options);
}
