import type { ColorFamily } from "../../data/color-families";

export const SELECTED_SOURCE_VARIANT_MATCH_CLASSIFICATIONS = [
  "exact",
  "equivalent",
  "defaulted",
  "fallback",
  "not-comparable",
  "normalization-needed",
] as const;

export type SelectedSourceVariantMatchClassification =
  (typeof SELECTED_SOURCE_VARIANT_MATCH_CLASSIFICATIONS)[number];

export type SelectedSourceVariantFactState =
  | "ready"
  | "unnormalized"
  | "absent";

export type SelectedSourceVariantFieldRole =
  | "required"
  | "conditional"
  | "defaultable"
  | "cosmetic"
  | "unsupported";

export type SelectedSourceVariantFallbackStrategy =
  | "none"
  | "wall-art-size-nearest"
  | "ordered-count-nearest"
  /**
   * The requested shade where sold, else the supplier's nearest shade of the
   * same family and look at any distance; another look only within the
   * reviewed closest-color boundary.
   */
  | "color-family-nearest";

export type SelectedSourceVariantFieldPolicy = {
  field: string;
  role: SelectedSourceVariantFieldRole;
  fallback?: SelectedSourceVariantFallbackStrategy;
  defaultValue?: string | readonly string[] | null;
  /**
   * A choice the picker does not offer: the seller never makes it, so the
   * selected source's value is disregarded and a target must state one of the
   * `defaultValue` values (its standard version) or not state the field at all.
   * A target stating anything else is another purchase, such as a pack of ten
   * beside a single print, and does not match.
   */
  standardOnly?: boolean;
  /**
   * The picker offers this field's families (picker-value-families.ts), so any
   * member of the picked value's family is the pick: Hahnemühle Photo Rag and
   * Cold Press Watercolour both satisfy "fine art paper" and price decides.
   */
  valueFamily?: boolean;
  sourceAxisKey?: string | null;
};

export type SelectedSourceVariantMatchingPolicy = {
  id: string;
  version: string;
  categorySlugs: readonly string[];
  fields: readonly SelectedSourceVariantFieldPolicy[];
  /**
   * A conditional field the selected option does not carry was not the
   * seller's choice (the picker hid it: one value, or not offered), so the
   * selected source's value for it does not bind other suppliers; each is
   * priced on its own version. See scopeSelectedSourcePolicyToOption.
   */
  ignoreUnpickedConditionalFields?: boolean;
};

export type SelectedSourceVariantProfileFact = {
  field: string;
  normalizedValue: string | null;
  rawValue?: string | null;
  state?: SelectedSourceVariantFactState;
  originScope?: string | null;
  normalizationStatus?: string | null;
  sourceAxisKey?: string | null;
  valueJson?: unknown;
  numericValue?: number | string | null;
  source?: string | null;
  evidencePath?: string | null;
  confidence?: number | string | null;
};

export type SelectedSourceColorSwatch = {
  label: string;
  normalizedValue: string;
  hex: string;
  owner: "base-product" | "frame-or-hardware" | "print-substrate";
};

/**
 * A supplier shade that has no swatch: the supplier published a true solid
 * color name and nothing else. It is named in words and never given a hex.
 */
export type SelectedSourceNamedColorShade = {
  label: string;
  normalizedValue: string;
  owner: SelectedSourceColorSwatch["owner"];
};

/**
 * A field-local fallback factor. Values with different kinds or units are
 * deliberately incomparable and must never be summed into one score.
 */
export type SelectedSourceVariantFallbackFactor =
  | {
      kind: "wall-art-size";
      /** hypot(ln w′/w, ln h′/h): one ratio step costs the same at any size or orientation. */
      unit: "log-ratio";
      value: number;
    }
  | {
      kind: "ordered-count";
      /** |ln n′/n|: 300 for 250 is nearer than 200 for 250. */
      unit: "log-ratio";
      value: number;
    }
  | {
      kind: "perceptual-color";
      unit: "delta-e-ok";
      value: number;
      /** Null when the shared color family and look bound the match instead. */
      maximum: number | null;
      colorFamily: ColorFamily;
      requested: SelectedSourceColorSwatch;
      offered: SelectedSourceColorSwatch;
    }
  | {
      /**
       * The supplier's shade has no swatch, so the family its name belongs to
       * is the only evidence: it carries no distance and ranks after every
       * shade that has one. Same look only (solid for solid, heather for
       * heather), because no distance can bound another look.
       */
      kind: "color-family-name";
      unit: "family";
      colorFamily: ColorFamily;
      requested: SelectedSourceColorSwatch;
      offered: SelectedSourceNamedColorShade;
    }
  | {
      /** Distance from one standard front print (print-decoration.ts). */
      kind: "print-decoration";
      unit: "rank";
      value: number;
    };

/** A fallback factor that measures a distance: every kind but a swatch-less color family. */
export type SelectedSourceDistanceFallbackFactor = Exclude<
  SelectedSourceVariantFallbackFactor,
  { kind: "color-family-name" }
>;

export type SelectedSourceVariantProfileInput = {
  variantProfileId: string;
  productId: string;
  supplierId: string;
  facts: readonly SelectedSourceVariantProfileFact[];
};

export type SelectedSourceTargetVariantInput =
  SelectedSourceVariantProfileInput & {
    variantId: string;
    variantRank?: number | null;
  };

export type SelectedSourceVariantFieldComparisonState =
  | "matched"
  | "equivalent"
  | "defaulted"
  | "fallback"
  | "different"
  | "missing"
  | "unnormalized"
  | "absent"
  | "ignored"
  | "unsupported";

export type SelectedSourceVariantFieldComparison = {
  field: string;
  role: SelectedSourceVariantFieldRole;
  state: SelectedSourceVariantFieldComparisonState;
  sourceValue: string | null;
  targetValue: string | null;
  sourceFactState: SelectedSourceVariantFactState | "missing";
  targetFactState: SelectedSourceVariantFactState | "missing";
  fallbackDistance: number | null;
  /** Optional for backwards compatibility with already materialized rows. */
  fallbackFactor?: SelectedSourceVariantFallbackFactor | null;
  /** The matcher's diagnostic wording; stays in the audit record, never on a comparison. */
  message: string;
};

/**
 * A field comparison as comparisons read and send it: the matcher's record
 * without its diagnostic `message`. Option fit, ranking and notes read only
 * these fields; the full record stays in `SelectedSourceVariantMatchCandidate`.
 */
export type SelectedSourceVariantFieldFit = Omit<
  SelectedSourceVariantFieldComparison,
  "message"
>;

/** The record without its diagnostic wording, for comparisons and the wire. */
export function toSelectedSourceVariantFieldFit(
  comparison: SelectedSourceVariantFieldFit
): SelectedSourceVariantFieldFit {
  const { field, role, state, sourceValue, targetValue, sourceFactState, targetFactState, fallbackDistance } = comparison;
  return {
    field,
    role,
    state,
    sourceValue,
    targetValue,
    sourceFactState,
    targetFactState,
    fallbackDistance,
    ...(comparison.fallbackFactor !== undefined && {
      fallbackFactor: comparison.fallbackFactor,
    }),
  };
}

export type MaterializedSelectedSourceVariantMatchCandidate = {
  sourceVariantProfileId: string;
  sourceProductId: string;
  sourceSupplierId: string;
  targetProductId: string;
  targetSupplierId: string;
  targetVariantId: string;
  targetVariantProfileId: string;
  policyId: string;
  policyVersion: string;
  sourceFactsSignature: string;
  targetFactsSignature: string;
  classification: SelectedSourceVariantMatchClassification;
  rank: number;
  qualityRank: number;
  fallbackDistance: number | null;
  matchedFields: string[];
  fieldComparisons: SelectedSourceVariantFieldComparison[];
  disclosureReasons: string[];
  materializedAt: string;
};

export type SelectedSourceVariantVisibleRow = {
  productId: string;
  supplierId: string;
  surfaceKind?: "primary" | "alternative" | string;
  matchKind?: "exact" | "alternative" | string;
};

export type SelectedSourceVariantLookupSource = {
  variantId?: string | null;
  variantProfileId: string;
  productId: string;
  supplierId: string;
  factsSignature?: string | null;
};

export type SelectedSourceVariantMaterializationExpectation = {
  policyId: string;
  policyVersion: string;
  sourceFactsSignature?: string | null;
  targetFactsSignatures?:
    | ReadonlyMap<string, string>
    | Readonly<Record<string, string>>;
};

export type SelectedSourceVariantRowMatch = {
  productId: string;
  supplierId: string;
  surfaceKind?: string;
  matchKind?: string;
  classification: SelectedSourceVariantMatchClassification;
  materializationStatus: "ready" | "missing" | "stale" | "source-self";
  selectedVariantId: string | null;
  selectedVariantProfileId: string | null;
  candidate: MaterializedSelectedSourceVariantMatchCandidate | null;
  fieldComparisons: SelectedSourceVariantFieldComparison[];
  disclosureReasons: string[];
};
