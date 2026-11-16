/**
 * Print technology aliases for normalization.
 *
 * Maps supplier-specific technique names to canonical print technology names.
 * Used during scraping to ensure consistent technology identification.
 *
 * Format: "supplier_term" → "canonical"
 */
export const PRINT_TECH_ALIASES = {
	// DTG (Direct-to-Garment)
	DTG: "dtg",
	dtg: "dtg",
	"direct to garment": "dtg",
	"direct-to-garment": "dtg",
	"Direct to garment": "dtg",
	"Direct to garment (DTG)": "dtg",

	// UV-curable transfer film for object decoration, distinct from apparel DTF.
	"uv-dtf": "uv-dtf",
	"UV-DTF": "uv-dtf",
	"UV DTF": "uv-dtf",
	"uv dtf": "uv-dtf",

	// DTF (Direct-to-Film)
	DTF: "dtf",
	dtf: "dtf",
	DTFILM: "dtf",
	DTFX: "dtf",
	"direct to film": "dtf",
	"direct-to-film": "dtf",
	dtflex: "dtf",

	// Gelato position+technique codes (position info captured separately in parsers.ts)
	"4 0 dtf": "dtf",
	"0 4 dtf": "dtf",
	"4 4 dtf": "dtf",
	"4 0 lg": "dtg",
	"0 4 lg": "dtg",
	"4 4 lg": "dtg",
	"4 lg 4": "dtg",
	"4 lg 4 lg": "dtg",
	"chstl dtf": "dtf",
	"chstl emb": "embroidery",
	"chstc emb": "embroidery",
	"chstlg emb": "embroidery",
	"4 0 emb": "embroidery",
	"0 4 emb": "embroidery",
	"4 4 emb": "embroidery",
	"left emb": "embroidery",
	"right emb": "embroidery",
	"backlg emb": "embroidery",
	"Front left": "embroidery",
	"4-0": "dtg",
	"0-4": "dtg",
	"4-4": "dtg",

	// Sublimation
	SUBLIMATION: "sublimation",
	sublimation: "sublimation",
	"dye sublimation": "sublimation",
	"dye-sublimation": "sublimation",
	"Dye sublimation": "sublimation",
	"Sublimation print": "sublimation",
	// Coverage/placement labels are intentionally not print-process aliases.
	// Preserve the supplier label as raw evidence and resolve the decoration
	// process separately when the source provides one.

	// Embroidery
	EMBROIDERY: "embroidery",
	embroidery: "embroidery",
	embroidered: "embroidery",

	// Screen Print
	"SCREEN-PRINT": "screen-print",
	"screen print": "screen-print",
	"screen-print": "screen-print",
	screenprint: "screen-print",
	"screen printing": "screen-print",
	"screen-printing": "screen-print",
	screenprinting: "screen-print",
	screen: "screen-print",

	// UV Print (hard surfaces)
	UV: "uv-print",
	"UV-PRINT": "uv-print",
	"uv print": "uv-print",
	"uv-print": "uv-print",
	"uv printing": "uv-print",
	"uv-direct": "uv-print",
	"PHONE-CASE": "uv-print",
	"UV-CYLINDER": "uv-print",
	"Direct UV digital printing": "uv-print",

	// Preserve supplier-specific decoration methods rather than collapsing them
	// into DTG, DTF, UV print, or a different laser process.
	"puff-print": "puff-print",
	"glitter-print": "glitter-print",
	"metallic-print": "metallic-print",
	LASER_ETCHED: "laser-etched",
	"laser-etched": "laser-etched",
	UVgel: "uvgel",
	uvgel: "uvgel",

	// Laser Engrave
	"LASER-ENGRAVE": "laser-engrave",
	"laser engrave": "laser-engrave",
	"laser-engrave": "laser-engrave",
	"laser engraving": "laser-engrave",
	"laser-engraving": "laser-engrave",
	engraved: "laser-engrave",
	engraving: "laser-engrave",

	// Cut & Sew is a construction workflow, not a print-process alias.
	"CUT-SEW": "cut-sew",
	"cut-sew": "cut-sew",
	"cut & sew": "cut-sew",
	"cut and sew": "cut-sew",
	// DIRECT-TO-FABRIC describes application or construction context and is
	// intentionally left unresolved until a decoration process is named.

	// Giclée (fine art printing)
	giclee: "giclee",
	giclée: "giclee",
	"gicl-e": "giclee",
	"Giclée": "giclee",
	"fine art print": "giclee",
	"Aqueous inks": "giclee",

	// Vinyl Print (stickers, decals)
	STICKER: "vinyl-print",
	"vinyl print": "vinyl-print",
	"vinyl-print": "vinyl-print",

	// Digital Print (paper products)
	// Artelo's two stock-specific poster chart rows name this press process.
	"toner-based-digital-press": "toner-based-digital-press",
	"toner-based digital press": "toner-based-digital-press",
	"DIGITAL-PRINT": "digital-print",
	"digital print": "digital-print",
	"digital-print": "digital-print",
	"digital printing": "digital-print",
	"digital-printing": "digital-print",
	"Digital print": "digital-print",
	"Digital press": "digital-print",
	"Direct digital printing": "digital-print",
	"HP Indigo digital print": "digital-print",
	inkjet: "digital-print",
	"Eco Solvent": "digital-print",
	"eco-solvent": "digital-print",
	"Solvent inkjet": "digital-print",
	"Latex inkjet": "digital-print",
	"Latex inks": "digital-print",
	DIGITAL: "digital-print",
	PRINTED: "digital-print",
	POSTCARD: "digital-print",
	DIE_CUT_PUZZLE: "digital-print",

	// Printify source-preserved customization method for jacquard-style goods.
	// Kept out of the glossary registry until it has its own researched definition.
	WEAVING: "weaving",
	weaving: "weaving",

	// Knit excluded — manufacturing method, not print tech. See NOT_PRINT_TECH in normalize-print-tech.ts

	// CustomCat specific - DIGISOFT (proprietary DTG/DTF hybrid)
	digisoft: "digisoft",
	DIGISOFT: "digisoft",

	// Mug sublimation (Printful specific)
	MUG: "sublimation",

	// Heat-transfer family and its vinyl subtype
	"Heat transfer": "heat-transfer",
	"heat transfer": "heat-transfer",
	"heat transfers": "heat-transfer",
	"heat-transfers": "heat-transfer",
	"heat press": "heat-transfer",
	"heat-press": "heat-transfer",
	"heat pressing": "heat-transfer",
	htv: "htv",
	HTV: "htv",
	"heat-transfer vinyl": "htv",
	"heat transfer vinyl": "htv",

	// Photo printing (silver halide / C-type)
	"Silver halide": "photo-print",
	"C-type": "photo-print",
	"c-type": "photo-print",
	// Prodigi lists two names for the same silver-halide process.
	"C-type, Silver halide": "photo-print",
	"c-type, silver halide": "photo-print",
} satisfies Record<string, string>;

/**
 * Canonical print technology names.
 * These are the "correct" values we normalize to.
 */
export const CANONICAL_PRINT_TECHS = [
	"dtg",
	"dtf",
	"sublimation",
	"embroidery",
	"screen-print",
	"uv-print",
	"uv-dtf",
	"laser-engrave",
	"cut-sew",
	"giclee",
	"vinyl-print",
	"digital-print",
	"digisoft",
	"heat-transfer",
	"htv",
	"photo-print",
] as const;

export type CanonicalPrintTech = (typeof CANONICAL_PRINT_TECHS)[number];

export const PRINT_DECORATION_AREAS = [
	"front",
	"back",
	"front-back",
	"chest",
	"pocket",
	"sleeve",
	"neck",
	"other",
	"unstated",
] as const;

export type PrintDecorationArea = (typeof PRINT_DECORATION_AREAS)[number];
