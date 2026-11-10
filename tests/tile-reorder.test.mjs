import assert from "node:assert/strict";
import { buildSync } from "esbuild";
import test from "node:test";
import { runInNewContext } from "node:vm";

const { text: bundle } = buildSync({
	entryPoints: ["src/tile-reorder.ts"],
	bundle: true,
	write: false,
	format: "cjs",
}).outputFiles[0];
const module = { exports: {} };
runInNewContext(bundle, { module, AbortController });
const { TileReorder } = module.exports;

function dockGesture(flexDirection = "row", direction = "ltr") {
	class Tile {
		constructor(id) {
			this.dataset = { vaultId: id };
		}
		closest() {
			return this;
		}
		getBoundingClientRect() {
			return { left: 50, top: 50, width: 100, height: 100 };
		}
		removeAttribute() {}
	}
	const source = new Tile("a");
	const anchor = new Tile("b");
	let frameId = 0;
	const frames = new Map();
	const view = Object.assign(new EventTarget(), {
		Element: Tile,
		getComputedStyle: () => ({ flexDirection, direction }),
		requestAnimationFrame: (callback) => {
			frames.set(++frameId, callback);
			return frameId;
		},
		cancelAnimationFrame: (id) => frames.delete(id),
	});
	const row = Object.assign(new EventTarget(), {
		ownerDocument: { defaultView: view },
		classList: { add() {}, remove() {} },
		scrollLeft: 0,
		scrollTop: 0,
		querySelectorAll: () => [source, anchor],
		getBoundingClientRect: () => ({
			left: 0,
			right: 200,
			top: 0,
			bottom: 200,
		}),
		setPointerCapture() {},
		hasPointerCapture: () => false,
	});
	const moves = [];
	new TileReorder(
		row,
		() => true,
		(move) => moves.push({ ...move }),
	);

	const pointer = (type, clientX, clientY = 25) => {
		const event = Object.assign(new Event(type, { cancelable: true }), {
			button: 0,
			isPrimary: true,
			pointerId: 1,
			pointerType: "mouse",
			clientX,
			clientY,
		});
		Object.defineProperty(event, "target", { value: source });
		(type === "pointerdown" ? row : view).dispatchEvent(event);
	};
	const click = (detail = 1) => {
		const event = Object.assign(new Event("click", { cancelable: true }), {
			detail,
		});
		return !row.dispatchEvent(event);
	};
	const advanceFrame = () => {
		for (const [id, callback] of [...frames]) {
			frames.delete(id);
			callback();
		}
	};
	return { row, view, moves, pointer, click, advanceFrame };
}

test("Escape cancels a pending drag before it crosses the movement threshold", () => {
	const { view, moves, pointer, click } = dockGesture();
	pointer("pointerdown", 25);
	view.dispatchEvent(Object.assign(new Event("keydown"), { key: "Escape" }));
	pointer("pointermove", 165);
	pointer("pointerup", 165);
	assert.deepEqual(moves, []);
	assert.equal(click(), true);
});

test("dragging uses the active axis and logical direction", () => {
	const layouts = [
		["row", "ltr", [25, 25], [165, 25]],
		["row", "rtl", [165, 25], [25, 25]],
		["column", "ltr", [25, 25], [25, 165]],
	];
	for (const [axis, direction, start, end] of layouts) {
		const { moves, pointer } = dockGesture(axis, direction);
		pointer("pointerdown", ...start);
		pointer("pointermove", ...end);
		pointer("pointerup", ...end);
		assert.deepEqual(moves, [{ id: "a", anchorId: "b", side: "after" }]);
	}
});

test("dropping outside the dock does not move or open the tile", () => {
	const { moves, pointer, click } = dockGesture();
	pointer("pointerdown", 25);
	pointer("pointermove", 165);
	pointer("pointerup", 205);
	assert.deepEqual(moves, []);
	assert.equal(click(0), false);
	assert.equal(click(), true);
});

test("a fresh click still opens the tile after a drag", () => {
	const { moves, pointer, click } = dockGesture();
	pointer("pointerdown", 25);
	pointer("pointermove", 165);
	pointer("pointerup", 165);
	assert.deepEqual(moves, [{ id: "a", anchorId: "b", side: "after" }]);
	pointer("pointerdown", 25);
	pointer("pointermove", 28);
	pointer("pointerup", 28);
	assert.equal(moves.length, 1);
	assert.equal(click(), false);
});

test("dragging at the edge scrolls along the strip and stops on blur", () => {
	const { row, view, moves, pointer, advanceFrame } = dockGesture("column");
	pointer("pointerdown", 25, 25);
	pointer("pointermove", 25, 190);
	advanceFrame();
	assert.ok(row.scrollTop > 0);
	assert.equal(row.scrollLeft, 0);
	const scrollTop = row.scrollTop;
	view.dispatchEvent(new Event("blur"));
	advanceFrame();
	pointer("pointerup", 25, 190);
	assert.equal(row.scrollTop, scrollTop);
	assert.deepEqual(moves, []);
});
