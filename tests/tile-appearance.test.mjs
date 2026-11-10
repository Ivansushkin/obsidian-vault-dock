import assert from "node:assert/strict";
import { buildSync } from "esbuild";
import test from "node:test";
import { runInNewContext } from "node:vm";

const { text: bundle } = buildSync({
	stdin: {
		contents: `export * from "./src/tile-appearance"; export { presetImage } from "./src/tile-presets";`,
		resolveDir: process.cwd(),
	},
	bundle: true,
	write: false,
	format: "cjs",
	loader: { ".webp": "dataurl" },
}).outputFiles[0];

function loadDraft(createImageBitmap = async () => ({ close() {} })) {
	const module = { exports: {} };
	runInNewContext(bundle, { module, Blob, atob, createImageBitmap });
	return module.exports;
}

const pngHeader = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const imageFile = new File([pngHeader], "picture.png", { type: "image/png" });

test("a preset, file and color update the same draft without changing the saved appearance", async () => {
	const { TileAppearanceDraft } = loadDraft();
	const colors = { background: "#1e293b", text: "#ffffff" };
	const draft = new TileAppearanceDraft(undefined, colors);
	assert.equal(draft.changed, false);
	draft.choosePreset("book");
	assert.equal(draft.appearance.kind, "preset");
	await draft.chooseFile(imageFile);
	assert.equal(draft.appearance.image, imageFile);
	draft.setColor("text", "#ec4899");
	assert.deepEqual(
		{ ...draft.appearance.colors },
		{ ...colors, text: "#ec4899" },
	);
	assert.deepEqual(
		{ ...draft.toChange().colors },
		{ ...colors, text: "#ec4899" },
	);
	assert.equal(draft.changed, true);
	assert.equal(colors.text, "#ffffff");
	await draft.chooseFile(imageFile);
	assert.deepEqual({ ...draft.toChange() }, { image: imageFile });
});

test("removing a picture returns the prior initials, including the theme defaults", () => {
	const { TileAppearanceDraft } = loadDraft();
	const draft = new TileAppearanceDraft(imageFile);
	draft.removeImage();
	assert.equal(draft.appearance.kind, "initials");
	assert.equal(draft.appearance.colors, undefined);
	assert.equal(draft.changed, true);
	assert.deepEqual({ ...draft.toChange() }, { image: undefined });

	const colors = { background: "#1e293b", text: "#ffffff" };
	const colored = new TileAppearanceDraft(imageFile, colors);
	colored.removeImage();
	assert.equal(colored.appearance.colors, colors);
	assert.deepEqual({ ...colored.toChange() }, { image: undefined });
});

test("a failed file check preserves the previous draft and a stale check cannot override a preset", async () => {
	const decoding = Promise.withResolvers();
	const started = Promise.withResolvers();
	const { TileAppearanceDraft } = loadDraft(() => {
		started.resolve();
		return decoding.promise;
	});
	const draft = new TileAppearanceDraft(imageFile);
	const check = draft.chooseFile(imageFile);
	assert.equal(draft.checking, true);
	await started.promise;
	draft.choosePreset("music");
	assert.equal(draft.checking, false);
	decoding.resolve({ close() {} });
	assert.equal(await check, "superseded");
	assert.equal(draft.appearance.id, "music");

	const failed = new (loadDraft(async () => {
		throw new Error("Corrupt image");
	}).TileAppearanceDraft)(imageFile);
	assert.equal(await failed.chooseFile(imageFile), "invalid");
	assert.equal(failed.appearance.image, imageFile);
	assert.equal(failed.changed, false);
});

test("a stored preset is recognized without treating the initial display as a change", async () => {
	const { TileAppearanceDraft, presetImage } = loadDraft();
	const draft = new TileAppearanceDraft(presetImage("compass"));
	await draft.identifyPreset();
	assert.equal(draft.appearance.id, "compass");
	assert.equal(draft.changed, false);
	draft.choosePreset("compass");
	assert.equal(draft.changed, false);
	draft.choosePreset("home");
	assert.equal(draft.changed, true);
});

test("an unsupported image renamed to PNG does not replace the preview", async () => {
	const { TileAppearanceDraft } = loadDraft();
	const draft = new TileAppearanceDraft(imageFile);
	const renamed = new File(["GIF89a"], "renamed.png", { type: "image/png" });
	assert.equal(await draft.chooseFile(renamed), "invalid");
	assert.equal(draft.appearance.image, imageFile);
});
