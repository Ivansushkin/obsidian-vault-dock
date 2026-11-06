import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import {
	cpSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

/** Copy only build inputs into a temporary project with synthetic configuration. */
function createBuildFixture(t) {
	const root = mkdtempSync(join(tmpdir(), "vault-switcher-build-"));
	t.after(() => rmSync(root, { recursive: true, force: true }));
	for (const input of [
		"esbuild.config.mjs",
		"manifest.json",
		"styles.css",
		"src",
	]) {
		cpSync(input, join(root, input), { recursive: true });
	}
	symlinkSync(
		resolve("node_modules"),
		join(root, "node_modules"),
		"junction",
	);
	return root;
}

test("the local build installs into every plugin directory configured in .env", (t) => {
	const root = createBuildFixture(t);

	const vault = join(root, "test vault");
	const pluginPath = join(vault, ".obsidian", "plugins", "vault-dock");
	mkdirSync(join(vault, ".obsidian"), { recursive: true });
	writeFileSync(
		join(root, ".env"),
		`VAULT_SWITCHER_PLUGIN_PATH="${pluginPath}"\n`,
	);
	const build = (...args) =>
		execFileSync(process.execPath, ["esbuild.config.mjs", ...args], {
			cwd: root,
			env: { CI: "false" },
			encoding: "utf8",
			stdio: "pipe",
		});

	const installLog = `Installed Obsidian Vault Dock to ${pluginPath}`;
	assert.ok(build().includes(installLog));
	rmSync(pluginPath, { recursive: true });

	const secondPluginPath = join(
		root,
		"second vault",
		".obsidian",
		"plugins",
		"vault-dock",
	);
	const pluginPaths = [pluginPath, secondPluginPath];
	writeFileSync(
		join(root, ".env"),
		`VAULT_SWITCHER_PLUGIN_PATHS="\n${pluginPaths.join("\n")}\n"\n`,
	);
	const output = build();
	for (const path of pluginPaths) {
		for (const file of ["main.js", "manifest.json", "styles.css"]) {
			assert.deepEqual(
				readFileSync(join(path, file)),
				readFileSync(join(root, "build", file)),
			);
		}
		assert.ok(output.includes(`Installed Obsidian Vault Dock to ${path}`));
		rmSync(path, { recursive: true });
	}
	assert.ok(!build("--no-install").includes("Installed Obsidian Vault Dock"));
	assert.ok(pluginPaths.every((path) => !existsSync(path)));

	const explicitVault = join(root, "explicit vault");
	mkdirSync(join(explicitVault, ".obsidian"), { recursive: true });
	build("--vault", explicitVault);
	assert.ok(pluginPaths.every((path) => !existsSync(path)));
	assert.equal(
		existsSync(
			join(
				explicitVault,
				".obsidian",
				"plugins",
				"vault-dock",
				"main.js",
			),
		),
		true,
	);
});

test("a failed installation reports the destination and still installs into the other directories", (t) => {
	const root = createBuildFixture(t);
	const [first, broken, last] = ["first", "broken", "last"].map((name) =>
		join(root, name, "vault-dock"),
	);
	mkdirSync(join(broken, "manifest.json"), { recursive: true });
	writeFileSync(
		join(root, ".env"),
		`VAULT_SWITCHER_PLUGIN_PATHS="\n${first}\n${broken}\n${last}\n"\n`,
	);

	const result = spawnSync(process.execPath, ["esbuild.config.mjs"], {
		cwd: root,
		env: { CI: "false" },
		encoding: "utf8",
		stdio: "pipe",
	});

	assert.ifError(result.error);
	assert.equal(result.status, 1);
	for (const destination of [first, last]) {
		for (const file of ["main.js", "manifest.json", "styles.css"]) {
			const installedFile = join(destination, file);
			assert.ok(existsSync(installedFile), `Missing ${installedFile}`);
			assert.deepEqual(
				readFileSync(installedFile),
				readFileSync(join(root, "build", file)),
			);
		}
		assert.ok(
			result.stdout.includes(
				`Installed Obsidian Vault Dock to ${destination}`,
			),
		);
	}
	assert.ok(
		!result.stdout.includes(`Installed Obsidian Vault Dock to ${broken}`),
	);
	assert.ok(result.stderr.includes(broken));
	assert.match(result.stderr, /partially updated/u);
});
