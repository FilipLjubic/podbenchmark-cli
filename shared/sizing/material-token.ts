/**
 * Comparison token for a supplier material description. Suppliers wrap the
 * same material in their own copy ("Material: 100% polyester for lightweight
 * durability", "polyester (100% polyester)", "Polyester"); all three are
 * `polyester`. Multi-part descriptions such as "60/40 cotton/polyester front;
 * 100% polyester mesh back" keep their structure because no single material
 * describes them.
 */
export function normalizeMaterialToken(value: string): string | null {
	// "Piqué" is "pique": drop accents before the ASCII-only slug.
	let text = value.trim().normalize("NFKD").replace(/\p{M}+/gu, "").toLowerCase();
	if (!text) return null;
	text = text.replace(/^materials?\s*:\s*/, "");
	if (/[;:]/.test(text) || /\d+\s*\/\s*\d+/.test(text)) return slugifyMaterial(text);

	text = text
		// A parenthetical that only restates the material: "polyester (100% polyester)".
		.replace(/\s*\(([^()]*)\)\s*/g, (match, inner: string) =>
			stripPurePercent(inner) === stripPurePercent(text.replace(match, " ").trim()) ? " " : match,
		)
		// Marketing clauses: "100% polyester for lightweight durability".
		.replace(/\s+for\s+.*$/, "");
	return slugifyMaterial(stripPurePercent(text));
}

function stripPurePercent(text: string): string {
	return text.replace(/^100\s*%\s*/, "").replace(/^100-percent\s+/, "").trim();
}

function slugifyMaterial(text: string): string | null {
	const slug = text
		.replace(/[^a-z0-9%/]+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "");
	return slug || null;
}
