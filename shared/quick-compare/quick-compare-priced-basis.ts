import { selectedSourceStructuredFallbackCompletionFact } from "../options/selected-source-variant-matching/structured-facts";
import type { ProductSpecs } from "../schemas/product-data";
import { createClosedStringLookup } from "../kernel/closed-string-lookup";
import {
  formatQuickComparePickerValueLabel,
  formatQuickComparePricedSizeLabel,
} from "./quick-compare-picker-labels";
import { NO_BLANK_COLOR_OPTION_KIND } from "../options/variant-picker-profile-evidence";
import { soleMember } from "../kernel/sole-member";

/**
 * What a summary-selected price was quoted for. A summary row prices one stored
 * variant, so it names that variant's size and color, and for printed-run
 * products the count the price buys. Missing evidence stays visible as unknown.
 */
export type QuickComparePricedBasis = {
  /** Size and color labels of the variant whose price the row shows. */
  configuration: { field: "size" | "color"; label: string }[];
  /** Pages in the quoted item, independent of how many items the price buys. */
  pageCount?: { state: "count"; count: number } | { state: "unavailable" };
  /** The count the price buys, or the unit whose count the source never states. */
  quantity?:
    | { state: "count"; count: number; unit: string }
    | { state: "unavailable"; unit: string };
  /**
   * The paper the priced variant is printed on and its weight, each only when
   * the supplier states it, so a heavier stock is easy to spot.
   */
  paper?: { label?: string; weightGsm?: number };
};

const NO_BLANK_COLOR_VALUE = `color:${NO_BLANK_COLOR_OPTION_KIND}`;

/** Profile facts that describe the priced variant; all are selected-profile scoped. */
export const PRICED_BASIS_FACT_FIELDS = [
  "size",
  "color",
  "quantity",
  "pageCount",
  "pages",
  "paperType",
  "substrateWeightGsm",
] as const;

/**
 * Stationery listings sold as a printed run or pack, keyed by `specs.subtype`.
 * The supplier quotes one product UID with no included count, so these rows say
 * the count is unavailable instead of implying one item. Notebooks, calendars
 * and single-unit products are deliberately absent: a missing count there is
 * not a missing price basis.
 */
const readPrintRunUnitBySubtype = createClosedStringLookup({
  letterhead: "sheet",
  "business-card": "card",
  "greeting-card": "card",
  postcard: "card",
});

type PricedBasisFact = {
  field: string;
  normalizedValue: string | null;
  state?: string;
  /** Source evidence the fact was normalized from, when the read carried it. */
  valueJson?: unknown;
};

export function readQuickCompareCanonicalPrintRunUnit(
  canonicalId: string
): string | null {
  return readPrintRunUnitBySubtype(canonicalId) ?? null;
}

type PricedBasisSource = {
  canonicalId?: string;
  facts: readonly PricedBasisFact[];
  /** The supplier's own color name, as the picker shows it, when the fact has one. */
  colorDisplayLabel?: string | null;
  /** Product-level `specs`, used only to recognise a printed-run listing. */
  specs: ProductSpecs | null;
};

/** A single ready value for the field; several distinct values are ambiguous. */
function readSingleValue(
  facts: readonly PricedBasisFact[],
  field: string
): string | null {
  const values = new Set(
    facts.flatMap(fact =>
      fact.field === field &&
      (fact.state === undefined || fact.state === "ready") &&
      fact.normalizedValue?.trim()
        ? [fact.normalizedValue.trim()]
        : []
    )
  );
  return values.size === 1 ? ([...values][0] ?? null) : null;
}

/** The priced variant's paper name and weight, each only when the supplier states it. */
function readPaper(
  facts: readonly PricedBasisFact[]
): QuickComparePricedBasis["paper"] {
  const paperType = readSingleValue(facts, "paperType");
  const label = paperType
    ? formatQuickComparePickerValueLabel({ field: "paperType", normalizedValue: paperType })
    : null;
  const weight = Number(readSingleValue(facts, "substrateWeightGsm")?.replace(/^gsm:/, ""));
  const weightGsm = Number.isFinite(weight) && weight > 0 ? weight : null;
  if (!label && weightGsm === null) return undefined;
  return { ...(label && { label }), ...(weightGsm !== null && { weightGsm }) };
}

/** The ready fact behind the single value, whose stored evidence spells labels the token cannot. */
function readSingleValueFact(
  facts: readonly PricedBasisFact[],
  field: string,
  normalizedValue: string | null
): PricedBasisFact | undefined {
  return normalizedValue === null
    ? undefined
    : facts.find(
        fact =>
          fact.field === field &&
          fact.normalizedValue?.trim() === normalizedValue
      );
}

/** The count in a normalized quantity value ("25", "quantity:25"), if any. */
function readQuickCompareQuantityCount(
  normalizedValue: string
): number | null {
  const count = /(?:^|:)(\d+)$/.exec(normalizedValue)?.[1];
  const parsed = count === undefined ? Number.NaN : Number(count);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

/** What a counted bundle holds when the product names it; a mug bundle buys mugs, not "items". */
function readBundleUnit(specs: ProductSpecs | null): string | null {
  return specs?.type === "drinkware" && specs.shape === "mug" ? "mug" : null;
}

function readPrintRunUnit(specs: ProductSpecs | null): string | null {
  return specs?.type === "stationery" && specs.subtype
    ? (readPrintRunUnitBySubtype(specs.subtype) ?? null)
    : null;
}

export function pluralizeQuickCompareUnit(unit: string, count: number): string {
  return count === 1 ? unit : `${unit}s`;
}

/** Reviewed bound-product classes owe a page basis even when source evidence is missing. */
export function quickCompareCanonicalRequiresPageCount(
  canonicalId: string
): boolean {
  return [
    "perfect-bound-brochure",
    "saddle-stitch-brochure",
    "wire-o-bound-brochure",
    "hardcover-photo-book",
    "softcover-photo-book",
    "layflat-photo-book",
    "magazine",
    "softcover-journal",
  ].includes(canonicalId);
}

function readPageCount(
  source: PricedBasisSource
): QuickComparePricedBasis["pageCount"] {
  const facts = source.facts.filter(
    fact => fact.field === "pageCount" || fact.field === "pages"
  );
  const counts = new Set(
    facts.flatMap(fact => {
      if (fact.state !== undefined && fact.state !== "ready") return [];
      const value = fact.normalizedValue?.trim();
      if (!value || !/^(?:page-count:|pages:)?\d+$/.test(value)) return [];
      const count = readQuickCompareQuantityCount(value);
      return count === null ? [] : [count];
    })
  );
  const count = soleMember(counts);
  if (count !== undefined) return { state: "count", count };
  return facts.length > 0 ||
    quickCompareCanonicalRequiresPageCount(source.canonicalId ?? "") ||
    (source.specs?.type === "stationery" && source.specs.pageRange)
    ? { state: "unavailable" }
    : undefined;
}

/**
 * The basis for one summary-selected variant, or null when nothing about it is
 * known and no printed-run count is owed.
 */
export function buildQuickComparePricedBasis(
  source: PricedBasisSource
): QuickComparePricedBasis | null {
  const configuration = (["size", "color"] as const).flatMap(field => {
    const normalizedValue = readSingleValue(source.facts, field);
    // The no-blank-color sentinel is matching evidence, not a color the seller
    // would name: the priced tuple omits it and the fact itself stays intact.
    if (field === "color" && normalizedValue === NO_BLANK_COLOR_VALUE)
      return [];
    // The size is the priced variant's own, named by its token or source
    // evidence; a range from the product's other variants is never borrowed.
    const label =
      field === "size"
        ? formatQuickComparePricedSizeLabel({
            normalizedValue,
            valueJson: readSingleValueFact(source.facts, field, normalizedValue)
              ?.valueJson,
          })
        : formatQuickComparePickerValueLabel({
            field,
            normalizedValue,
            colorDisplayLabel: source.colorDisplayLabel,
          });
    return label ? [{ field, label }] : [];
  });
  const unit =
    readPrintRunUnit(source.specs) ??
    readQuickCompareCanonicalPrintRunUnit(source.canonicalId ?? "");
  const quantityValue = readSingleValue(source.facts, "quantity");
  const count =
    quantityValue === null
      ? null
      : readQuickCompareQuantityCount(quantityValue);
  const completion = selectedSourceStructuredFallbackCompletionFact("quantity");
  const owesQuantity = source.facts.some(fact =>
    fact.field === "quantity" ||
    (fact.field === completion.field && fact.normalizedValue === completion.normalizedValue)
  );
  // A completed no-value read discloses unknown; it never creates a count.
  const quantity: QuickComparePricedBasis["quantity"] | undefined =
    count !== null
      ? {
          state: "count",
          count,
          unit: unit ?? readBundleUnit(source.specs) ?? "item",
        }
      : count === null && (unit !== null || owesQuantity)
        ? { state: "unavailable", unit: unit ?? "item" }
        : undefined;
  const pageCount = readPageCount(source);
  const paper = readPaper(source.facts);
  if (
    configuration.length === 0 &&
    quantity === undefined &&
    pageCount === undefined &&
    paper === undefined
  )
    return null;
  return {
    configuration,
    ...(quantity && { quantity }),
    ...(pageCount && { pageCount }),
    ...(paper && { paper }),
  };
}
