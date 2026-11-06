const MANAGE_VAULTS = "manage-vaults";

/** Locate the native mobile picker used by Obsidian 1.15.0. */
export function findMobileVaultSwitcher(
	header: Element | null,
): HTMLSelectElement | undefined {
	return (
		header?.querySelector<HTMLSelectElement>(
			".workspace-drawer-header-switcher > select",
		) ?? undefined
	);
}

/** Read the picker after Obsidian appends its final management option. */
function readVaultOptions(
	switcher: HTMLSelectElement | undefined,
): HTMLOptionElement[] {
	if (!switcher?.isConnected || switcher.disabled) {
		return [];
	}
	const options = Array.from(switcher.options);
	if (options.at(-1)?.value !== MANAGE_VAULTS) {
		return [];
	}
	return options.filter(
		({ value, text, disabled }) =>
			value && value !== MANAGE_VAULTS && text && !disabled,
	);
}

/** Keep native labels and identify duplicate names by their folder location. */
export function readMobileVaults(
	switcher: HTMLSelectElement | undefined,
): { id: string; name: string; path?: string }[] {
	const options = readVaultOptions(switcher);
	const parent = (value: string) => value.split("/").at(-2) || value;
	return options.map(({ value, text }) => {
		const duplicates = options.filter(
			(option) => option.value !== value && option.text === text,
		);
		if (duplicates.length === 0) {
			return { id: value, name: text };
		}
		const folder = parent(value);
		const qualifier = duplicates.some(
			(option) => parent(option.value) === folder,
		)
			? value
			: folder;
		return { id: value, name: `${text} (${qualifier})`, path: value };
	});
}

/** Let the native picker open the exact location, including same-name vaults. */
export function openMobileVault(
	switcher: HTMLSelectElement,
	location: string,
): boolean {
	if (!readVaultOptions(switcher).some(({ value }) => value === location)) {
		return false;
	}
	if (switcher.value !== location) {
		switcher.value = location;
		switcher.dispatchEvent(new Event("change", { bubbles: true }));
	}
	return true;
}
