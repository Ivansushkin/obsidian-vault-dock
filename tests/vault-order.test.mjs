import assert from "node:assert/strict";
import { buildSync } from "esbuild";
import test from "node:test";
import { runInNewContext } from "node:vm";

const { text: bundle } = buildSync({
	entryPoints: ["src/vault-order.ts"],
	bundle: true,
	write: false,
	format: "cjs",
}).outputFiles[0];
const module = { exports: {} };
runInNewContext(bundle, { module });
const { resolveVaultOrder, applyVaultMove } = module.exports;

test("vaults with the same name move independently by registered ID", () => {
	const vaults = [
		{ id: "local", name: "Notes" },
		{ id: "cloud", name: "Notes" },
	];
	const moved = applyVaultMove(
		vaults.map(({ id }) => id),
		[],
		{
			id: "cloud",
			anchorId: "local",
			side: "before",
		},
	);
	assert.deepEqual(Array.from(moved), ["cloud", "local"]);
});

test("registered newcomers follow the saved tiles and missing IDs are skipped", () => {
	const registered = ["new", "a", "b"];
	assert.deepEqual(Array.from(resolveVaultOrder(registered, [])), registered);
	assert.deepEqual(
		Array.from(resolveVaultOrder(registered, ["missing", "b", "b", "a"])),
		["b", "a", "new"],
	);
});

test("a stale registry snapshot leaves a newcomer’s saved position intact", () => {
	const first = applyVaultMove(["a", "b", "new"], [], {
		id: "new",
		anchorId: "a",
		side: "before",
	});
	const second = applyVaultMove(["a", "b"], first, {
		id: "b",
		anchorId: "a",
		side: "before",
	});
	assert.deepEqual(Array.from(second), ["new", "b", "a"]);
});

test("a second window can move by ID after the first window changes tile positions", () => {
	const registered = ["a", "b", "c", "d"];
	const first = applyVaultMove(registered, [], {
		id: "d",
		anchorId: "a",
		side: "before",
	});
	const second = applyVaultMove(registered, first, {
		id: "b",
		anchorId: "c",
		side: "after",
	});
	assert.deepEqual(Array.from(second), ["d", "a", "c", "b"]);
	assert.equal(
		applyVaultMove(registered, second, {
			id: "b",
			anchorId: "missing",
			side: "before",
		}),
		undefined,
	);
	assert.equal(
		applyVaultMove(registered, second, {
			id: "b",
			anchorId: "c",
			side: "after",
		}),
		undefined,
	);
});
