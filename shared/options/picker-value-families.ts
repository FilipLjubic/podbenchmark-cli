/**
 * The industry's own groups for wall-art surface and paper, which the picker
 * offers instead of each supplier's stock names. A family is a derived read
 * model: profile facts keep the supplier's specific value ("hahnemuhle-photo-rag"),
 * the picker shows and keys its family ("fine-art-paper"), and selected-source
 * matching treats every member of the picked family as the pick, so price
 * decides between them. Decisions and evidence:
 * docs/architecture/picker-option-decisions.md and
 * docs/research/wall-art-paper-vocabulary-2026-11-08.md.
 *
 * A value outside every family keeps its own value. Bump
 * PICKER_VALUE_FAMILY_VERSION when membership changes: stored picker references
 * and selected-source matches depend on it.
 */

import { createClosedStringLookup } from "../kernel/closed-string-lookup";
import { WALL_ART_PICKER_CATEGORIES } from "./variant-picker-policy";

export const PICKER_VALUE_FAMILY_VERSION = "2026-11-08.5";

/** Surface: satin, lustre, pearl and semi-gloss are one sheen sellers know as satin. */
const lookupFinishFamily = createClosedStringLookup<string>({
  matte: "matte",
  glossy: "glossy",
  satin: "satin",
  "semi-glossy": "satin",
  "semi-matte": "satin",
  luster: "satin",
  lustre: "satin",
  pearl: "satin",
});

/**
 * Paper grade: poster paper (coated and uncoated poster stock, enhanced matte
 * and photo papers) and fine art paper (archival cotton-rag and named
 * fine-art papers). A third "enhanced matte" grade was measured on 2026-11-08
 * and dropped: the research found that line is base and brand, not process,
 * and it split Framed Poster's opening comparison from five suppliers to
 * three. Foil papers and stationery stocks are not wall-art grades and keep
 * their own value.
 */
const lookupPaperFamily = createClosedStringLookup<string>({
  matteposter: "poster-paper",
  glossyposter: "poster-paper",
  semiglossposter: "poster-paper",
  semimattelinenposter: "poster-paper",
  // Printify's framed poster: 200 gsm semi-gloss coated poster stock.
  "semi-glossy": "poster-paper",
  // Gelato's 170 and 200 gsm uncoated and coated-silk poster papers, and
  // Printful's and Fourthwall's 189 gsm "quality matte paper": no archival claim.
  "classic-matte": "poster-paper",
  "premium-matte": "poster-paper",
  "classic-semi-glossy": "poster-paper",
  "premium-semi-glossy": "poster-paper",
  matte: "poster-paper",
  // Enhanced matte and photo papers: Printful's and Fourthwall's Enhanced Matte,
  // Printful's Premium Luster (RC photo), Gelato's 200 gsm enhanced uncoated
  // "Fine Art" stock and Fourthwall's 260 gsm "museum-quality matte", neither
  // claiming archival.
  "enhanced-matte": "poster-paper",
  "premium-luster": "poster-paper",
  "enhanced-uncoated": "poster-paper",
  "high-quality-matte": "poster-paper",
  // Gelato's 250 gsm uncoated off-white archival paper.
  "archival-matte": "fine-art-paper",
  // Artelo's fine-art line (archival, pigment giclée) and its cotton-rag
  // satin; its photo papers are not fine art.
  archivalmattefineart: "fine-art-paper",
  coldpressfineart: "fine-art-paper",
  hotpressfineart: "fine-art-paper",
  germanetchingfineart: "fine-art-paper",
  watercolorfineart: "fine-art-paper",
  velvetfineart: "fine-art-paper",
  pearlfineart: "fine-art-paper",
  ragsatinphoto: "fine-art-paper",
  glossyphoto: "poster-paper",
  lusterphoto: "poster-paper",
  mattephoto: "poster-paper",
  pearlphoto: "poster-paper",
  semimattephoto: "poster-paper",
  "budget-art": "poster-paper",
  "enhanced-matte-art": "poster-paper",
  "smooth-art": "poster-paper",
  "lustre-photo": "poster-paper",
  "hahnemuhle-photo-rag": "fine-art-paper",
  "hahnemuhle-german-etching": "fine-art-paper",
  "cold-press-watercolour": "fine-art-paper",
  "poster-paper": "poster-paper",
  "fine-art-paper": "fine-art-paper",
});

const FAMILY_LOOKUPS = {
  finish: lookupFinishFamily,
  paperType: lookupPaperFamily,
} as const;

const lookupFamilyField = createClosedStringLookup<(value: string) => string | undefined>(
  FAMILY_LOOKUPS
);

const WALL_ART_CATEGORIES: ReadonlySet<string> = new Set(WALL_ART_PICKER_CATEGORIES);

/** The family a value belongs to, or null when the field or value has none. */
export function readPickerValueFamily(field: string, value: string | null | undefined): string | null {
  const token = value?.trim();
  if (!token) return null;
  return lookupFamilyField(field)?.(token) ?? null;
}

/** Whether a category's picker offers families instead of supplier values. */
function categoryUsesPickerValueFamilies(categorySlug: string | null | undefined): boolean {
  return categorySlug ? WALL_ART_CATEGORIES.has(categorySlug) : false;
}

/** The value the picker keys and shows: the family where one applies, else the value. */
export function pickerFamilyValue(input: {
  categorySlug: string | null | undefined;
  field: string;
  normalizedValue: string | null;
}): string | null {
  if (!categoryUsesPickerValueFamilies(input.categorySlug)) return input.normalizedValue;
  return readPickerValueFamily(input.field, input.normalizedValue) ?? input.normalizedValue;
}
