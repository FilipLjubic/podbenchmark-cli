const HEX_PATTERN = /^[0-9A-Fa-f]{6}$/;

export const normalizeColorHex = (
	hex: string | null | undefined,
): string | null => {
	if (typeof hex !== "string") {
		return null;
	}

	const cleanHex = hex.trim().replace(/^#/, "");
	if (!HEX_PATTERN.test(cleanHex)) {
		return null;
	}

	return `#${cleanHex.toUpperCase()}`;
};

/** Ordered option-bound component chips; a malformed component invalidates the palette. */
export function readColorSwatchHexes(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	const hexes: string[] = [];
	for (const component of value) {
		// eslint-disable-next-line podbenchmark/no-runtime-typeof -- Each palette entry is checked here so browser bundles need no schema library.
		const hex = normalizeColorHex(typeof component === "string" ? component : null);
		if (!hex) return [];
		hexes.push(hex);
	}
	return hexes;
}

export const getNormalizedColorKey = (color: string): string =>
	color
		.trim()
		.toLowerCase()
		.replace(/[_-]+/g, " ")
		.replace(/\s+/g, " ");
