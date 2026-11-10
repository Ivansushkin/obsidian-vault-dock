export type VaultMove = {
	id: string;
	anchorId: string;
	side: "before" | "after";
};

/** Keep saved vaults first and append newcomers in registry order. */
export function resolveVaultOrder(
	registered: readonly string[],
	saved: readonly string[],
): string[] {
	const remaining = new Set(registered);
	return [...saved.filter((id) => remaining.delete(id)), ...remaining];
}

/** Move relative to the latest saved order, retaining currently hidden IDs. */
export function applyVaultMove(
	registered: readonly string[],
	saved: readonly string[],
	{ id, anchorId, side }: VaultMove,
): string[] | undefined {
	const order = resolveVaultOrder(registered, saved);
	const from = order.indexOf(id);
	const anchor = order.indexOf(anchorId);
	if (from < 0 || anchor < 0 || from === anchor) {
		return undefined;
	}
	const to = anchor - Number(from < anchor) + Number(side === "after");
	if (from === to) {
		return undefined;
	}
	const next = [...new Set([...saved, ...registered])];
	next.splice(next.indexOf(id), 1);
	next.splice(next.indexOf(anchorId) + Number(side === "after"), 0, id);
	return next;
}
