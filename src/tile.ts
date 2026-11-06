const nameSegments =
	typeof Intl.Segmenter === "function"
		? new Intl.Segmenter(undefined, { granularity: "grapheme" })
		: undefined;

/** Use up to two letters, or the first two graphemes in names without letters. */
export function getInitials(name: string): string {
	const trimmed = name.trim();
	const characters = nameSegments
		? Array.from(nameSegments.segment(trimmed), ({ segment }) => segment)
		: Array.from(trimmed);
	const letters = characters.filter((character) => /\p{L}/u.test(character));
	return (letters.length ? letters : characters).slice(0, 2).join("");
}

/** Create the shared tile markup for a vault in either layout. */
export function createTile(
	row: HTMLElement,
	vault: { id: string; name: string; path?: string },
	onSelect: (id: string) => void,
): { tile: HTMLButtonElement; picture: HTMLElement } {
	const tile = row.createEl("button", {
		cls: "vault-dock-tile",
		attr: {
			type: "button",
			title: vault.path ?? vault.name,
			"aria-label": vault.name,
			"data-vault-id": vault.id,
		},
	});
	const picture = tile.createSpan("vault-dock-picture");
	tile.createSpan({ cls: "vault-dock-label", text: vault.name });
	tile.addEventListener("click", () => onSelect(vault.id));
	return { tile, picture };
}

export function showInitials(picture: HTMLElement, name: string): void {
	picture.addClass("vault-dock-initials");
	picture.textContent = getInitials(name);
}
