import { readWallArtLayoutEvidence, readWallArtLayout, wallArtLayoutToken } from "../sizing/wall-art-layout";
import {
  normalizeColorHex,
  readColorSwatchHexes,
} from "../color/normalize-color";
import { srgbHexOklabDelta } from "../color/oklab";
import {
  classifyPickerColor,
  INTERCHANGEABLE_PICKER_COLOR_TEXTURES,
  type PickerColorClass,
} from "../color/color-family";
import { readUnknownRecord } from "../schemas/record";
import type { ColorFamily } from "../data/color-families";
import type {
  SelectedSourceColorSwatch,
  SelectedSourceNamedColorShade,
  SelectedSourceVariantFallbackFactor,
} from "./selected-source-variant-matching/types";
import { isStructuredApparelPickerCategory } from "./variant-picker-policy";
import { COARSE_ML_PER_US_FLUID_OUNCE } from "../kernel/units.ts";
import { NO_BLANK_COLOR_OPTION_KIND } from "./variant-picker-profile-evidence";

const SELECTED_SOURCE_MEASUREMENT_POLICY_VERSION = "2026-11-07.1";

/**
 * Reviewed against real cross-supplier apparel and frame swatches. Delta E OK
 * values above this boundary are visibly different enough to remain unresolved.
 */
export const MAX_SELECTED_SOURCE_COLOR_DELTA_E_OK = 0.06;

type SelectedSourceMeasurementClassification =
  | "exact"
  | "equivalent"
  | "defaulted"
  | "fallback"
  | "not-comparable"
  | "normalization-needed";

type SelectedSourceMeasurementPolicyEntry = {
  id: string;
  domain: string;
  categorySlugs: readonly string[];
  categoryFamilies?: readonly string[];
  fields: readonly string[];
  sourceAxisKeys?: readonly string[];
  sourceLocalAxes?: readonly string[];
  canonicalValueModel: string;
  equivalence: readonly string[];
  fallback: string;
  defaulting: string;
  disclosure: string;
  evidence: string;
  resultContract: {
    classification: string;
    equivalenceBasis: string;
    fallbackDistance: string;
    policyId: string;
    disclosureReasons: string;
    evidenceRequirement: string;
  };
};

type MatchFact = {
  field?: string | null;
  normalizedValue?: string | null;
  rawValue?: string | null;
  valueJson?: unknown;
  numericValue?: number | string | null;
  state?: string | null;
  normalizationStatus?: string | null;
  originScope?: string | null;
  source?: string | null;
  evidencePath?: string | null;
  confidence?: number | string | null;
};

export type SelectedSourceMeasurementMatchInput = {
  categorySlug?: string | null;
  field?: string | null;
  sourceAxisKey?: string | null;
  source?: MatchFact | null;
  target?: MatchFact | null;
};

type SelectedSourceMeasurementMatchResult = {
  classification: SelectedSourceMeasurementClassification;
  policyId: string;
  policyVersion: string;
  canonicalValueModel: string;
  equivalenceBasis: string | null;
  fallbackDistance: number | null;
  fallbackFactor: SelectedSourceVariantFallbackFactor | null;
  evidenceRequirement: string;
  disclosureReason: string;
  disclosureReasons: readonly string[];
};

export type SelectedSourceMeasurementMatchEvaluator = (
  input: SelectedSourceMeasurementMatchInput
) => SelectedSourceMeasurementMatchResult;

type MatchFactInspection = {
  capacityMl: number | null;
  dimensions: {
    widthMm: number;
    heightMm: number;
    orientation?: string;
  } | null;
  hasColorMeta: boolean;
  isSourceLocal: boolean;
  normalizationStatusKey: string;
  stableValueJsonText: string;
  standard: string | null;
  stateKey: string;
};

type MatchFactInspectionCache = WeakMap<MatchFact, MatchFactInspection>;

const SELECTED_SOURCE_PERCEPTUAL_COLOR_WITHHOLD_REASONS = [
  "missing-color-meta",
  "non-color-kind",
  "unknown-owner",
  "unsupported-descriptor",
  "missing-normalized-value",
  "normalization-not-exact",
  "missing-provenance",
  "invalid-srgb-hex",
] as const;

export type SelectedSourcePerceptualColorWithholdReason =
  (typeof SELECTED_SOURCE_PERCEPTUAL_COLOR_WITHHOLD_REASONS)[number];

type SelectedSourcePerceptualColorFactInspection =
  | { eligible: true; reason: "eligible"; swatch: SelectedSourceColorSwatch }
  | {
      eligible: false;
      reason: SelectedSourcePerceptualColorWithholdReason;
      swatch: null;
    };

type ColorFactEvidence =
  | {
      ok: true;
      meta: StructuredColorMeta;
      owner: SelectedSourceColorSwatch["owner"];
      normalizedValue: string;
      label: string;
    }
  | { ok: false; reason: SelectedSourcePerceptualColorWithholdReason };

/**
 * Everything a closest-color shade needs except its swatch: a true solid
 * color of a known owner, with an exact normalized value and provenance.
 */
function inspectColorFactEvidence(
  fact: SelectedSourceMeasurementMatchInput["source"]
): ColorFactEvidence {
  const meta = readColorMeta(fact ?? null);
  if (!meta) return { ok: false, reason: "missing-color-meta" };
  if (meta.kind !== "color") return { ok: false, reason: "non-color-kind" };
  if (!isKnownColorOwner(meta.owner)) {
    return { ok: false, reason: "unknown-owner" };
  }
  if (unsupportedPerceptualColorDescriptor(fact ?? null, meta)) {
    return { ok: false, reason: "unsupported-descriptor" };
  }

  const factNormalizedValue = normalizedValue(fact)?.trim();
  if (!factNormalizedValue) {
    return { ok: false, reason: "missing-normalized-value" };
  }
  if (fact?.normalizationStatus !== "exact") {
    return { ok: false, reason: "normalization-not-exact" };
  }
  if (!readTextValue(fact.source) || !readTextValue(fact.evidencePath)) {
    return { ok: false, reason: "missing-provenance" };
  }
  return {
    ok: true,
    meta,
    owner: meta.owner,
    normalizedValue: factNormalizedValue,
    label:
      readTextValue(meta.displayColor) ??
      readTextValue(meta.raw) ??
      factNormalizedValue,
  };
}

export function inspectSelectedSourcePerceptualColorFact(
  fact: SelectedSourceMeasurementMatchInput["source"]
): SelectedSourcePerceptualColorFactInspection {
  const evidence = inspectColorFactEvidence(fact);
  if (!evidence.ok) return withheldColorFact(evidence.reason);
  const hexSource = readTextValue(evidence.meta.hex);
  const hex = hexSource ? normalizeColorHex(hexSource) : null;
  if (!hex) return withheldColorFact("invalid-srgb-hex");

  return {
    eligible: true,
    reason: "eligible",
    swatch: {
      label: evidence.label,
      normalizedValue: evidence.normalizedValue,
      hex,
      owner: evidence.owner,
    },
  };
}

type SelectedSourceNamedColorFactInspection =
  | { eligible: true; shade: SelectedSourceNamedColorShade }
  | {
      eligible: false;
      reason: SelectedSourcePerceptualColorWithholdReason;
    };

/**
 * A true solid color that the supplier published without any swatch: no hex
 * at all and no swatch image. Its name is its only evidence, so it can stand
 * in by color family (never by distance) for a pick that has a swatch. A
 * malformed hex or a textured chip image is other evidence, not absence.
 */
export function inspectSelectedSourceNamedColorFact(
  fact: SelectedSourceMeasurementMatchInput["source"]
): SelectedSourceNamedColorFactInspection {
  const evidence = inspectColorFactEvidence(fact);
  if (!evidence.ok) return { eligible: false, reason: evidence.reason };
  if (readTextValue(evidence.meta.hex)) {
    return { eligible: false, reason: "invalid-srgb-hex" };
  }
  if (evidence.meta.hasSwatchImage) {
    return { eligible: false, reason: "unsupported-descriptor" };
  }
  return {
    eligible: true,
    shade: {
      label: evidence.label,
      normalizedValue: evidence.normalizedValue,
      owner: evidence.owner,
    },
  };
}

/** The family a swatch-less shade's name places it in, null when it names none. */
export function classifySelectedSourceNamedColorShade(
  shade: Pick<SelectedSourceNamedColorShade, "label">
): PickerColorClass {
  return classifyPickerColor({ label: shade.label, hexes: [] });
}

/**
 * Whether a swatch-less shade can stand in for a requested swatch: a known
 * single family, the same on both sides, and the same interchangeable look
 * (solid for solid, heather for heather). Another look needs a distance
 * bound that a shade without a swatch cannot give.
 */
function namedColorFamilyOf(
  sourceSwatch: Pick<SelectedSourceColorSwatch, "label" | "hex">,
  shade: Pick<SelectedSourceNamedColorShade, "label">
): ColorFamily | null {
  const source = classifySelectedSourceColorSwatch(sourceSwatch);
  const target = classifySelectedSourceNamedColorShade(shade);
  if (
    !source.family ||
    source.family === "multicolor" ||
    source.family !== target.family ||
    source.texture !== target.texture ||
    !INTERCHANGEABLE_PICKER_COLOR_TEXTURES.has(source.texture)
  ) {
    return null;
  }
  return source.family;
}

const RESULT_CONTRACT = {
  classification: "classification selected from exact/equivalent/defaulted/fallback/not-comparable/normalization-needed",
  equivalenceBasis: "raw-token-exact, exact-unit-conversion, supplier-declared-pair, reviewed-nominal-alias, protected-standard, advisory-only, or normalization-needed",
  fallbackDistance: "legacy scalar mirror only when one reviewed field-local fallback applies",
  policyId: "stable policy id and version used for materialized #69 candidates",
  disclosureReasons: "auditable disclosure reason strings for UI and review",
  evidenceRequirement: "required VariantProfileValue evidence and provenance state",
} as const;

export const SELECTED_SOURCE_MEASUREMENT_POLICY_MATRIX = [
  {
    id: "wall-art-2d-size",
    domain: "wall-art size dimension",
    categorySlugs: ["canvas-prints", "posters", "framed-posters", "art-prints"],
    categoryFamilies: ["wall-art"],
    fields: ["size"],
    canonicalValueModel:
      "VariantProfileValue.field=size with valueJson.widthMm, valueJson.heightMm, valueJson.orientation/aspect and normalizedValue such as wall-art:dim:3048x4064. Raw supplier labels remain evidence and must not be parsed at selected-source runtime.",
    equivalence: [
      "exact-unit-conversion over widthMm/heightMm",
      "supplier-declared-pair only when structured valueJson agrees",
      "reviewed-nominal-alias only from durable policy evidence",
      "raw-token-exact is display evidence, not enough by itself",
      "normalization-needed for conflicting valueJson",
    ],
    fallback:
      "nearest fallback is allowed for wall-art size only, ranked by width/height ratio (hypot of log ratios) in the same orientation, within 30% aspect drift and x2 area; ties fall to price.",
    defaulting:
      "size is required; missing, absent, or unnormalized facts block matching rather than defaulting.",
    disclosure:
      "Disclose exact-unit-conversion, reviewed alias, fallback distance, orientation/aspect changes, missing/absent/unnormalized state, and not-comparable decisions.",
    evidence:
      "Requires normalized/materialized VariantProfileValue valueJson + normalizedValue + normalizationStatus. Raw labels remain evidence only.",
    resultContract: RESULT_CONTRACT,
  },
  {
    id: "drinkware-capacity-as-size",
    domain: "capacity volume for mugs and bottles",
    categorySlugs: ["mugs", "water-bottles", "drinkware"],
    categoryFamilies: ["drinkware"],
    fields: ["size", "capacity"],
    canonicalValueModel:
      "Capacity is ml/liter or reviewed oz market bucket, currently often carried by VariantProfileValue.field=size for mugs as well as capacity-specific facts.",
    equivalence: [
      "reviewed-nominal-alias for known ml/oz buckets such as 325 ml / 11 oz",
      "exact-unit-conversion when structured ml and oz agree within reviewed tolerance",
      "supplier-declared-pair for an exact reviewed policy case, preserving both marketed units and its reviewed case ID even when nominal rounding differs",
      "normalization-needed for null or unreviewed conflicting paired labels",
    ],
    fallback:
      "nearest capacity fallback is not generic; allow only category-approved ordered drinkware capacity policy with disclosure, otherwise not-comparable.",
    defaulting:
      "Do not default capacity. Missing, absent, unnormalized, or conflicting capacity facts stay normalization-needed/not-comparable.",
    disclosure:
      "Disclose reviewed capacity alias, unit conversion, conflict, and whether fallback was unavailable by policy.",
    evidence:
      "Requires VariantProfileValue.valueJson ml/oz or reviewed normalizedValue; raw supplier labels remain evidence only.",
    resultContract: RESULT_CONTRACT,
  },
  {
    id: "ordered-quantity-and-page-count",
    domain: "ordered quantity and page count",
    categorySlugs: ["postcards", "notebooks", "greeting-cards", "calendars"],
    categoryFamilies: ["stationery"],
    fields: ["quantity", "pageCount"],
    canonicalValueModel:
      "Integer count with unitKind/countUnit/quantityKind such as print-run, pages, puzzle-pieces, or pack identity.",
    equivalence: [
      "raw-token-exact when normalizedValue and count unitKind match",
      "reviewed-nominal-alias for supplier-declared page/count labels",
      "advisory-only for ordered-looking marketing tiers without count unitKind or with different valid unitKind values",
      "normalization-needed when count or unitKind is missing",
    ],
    fallback:
      "nearest fallback may be used for ordered print-run quantities and page counts when unitKind matches; pack identity, bundle identity, and mixed count kinds are no-nearest/not-comparable.",
    defaulting:
      "Quantity/pageCount can be required or defaultable only when category policy declares the role; missing required facts are not guessed.",
    disclosure:
      "Disclose ordered count, unitKind, fallbackDistance, exact-only pack identity, and defaulted/missing states.",
    evidence:
      "Requires normalized VariantProfileValue numericValue or valueJson.count plus unitKind and normalizationStatus.",
    resultContract: RESULT_CONTRACT,
  },
  {
    id: "protected-paper-standards",
    domain: "protected paper standards",
    categorySlugs: ["notebooks", "postcards", "flyers", "stationery"],
    categoryFamilies: ["home-stationery", "paper"],
    fields: ["size", "paperType"],
    canonicalValueModel:
      "Protected standard token such as A4, A5, Letter, Legal, Tabloid, or Ledger plus optional dimensions for display.",
    equivalence: [
      "protected-standard exact token only",
      "exact-unit-conversion is display-only for protected paper standards",
      "normalization-needed for mixed paper/dimension labels without protected token authority",
    ],
    fallback:
      "No-nearest: A4, Letter, Legal, Tabloid, Ledger and related protected standards do not collapse through generic dimension distance.",
    defaulting:
      "Do not default protected paper standard when a required paper/size fact is missing or absent.",
    disclosure:
      "Disclose protected-standard token mismatch as not-comparable even when dimensions are close.",
    evidence:
      "Requires VariantProfileValue.valueJson.standard or reviewed normalizedValue token with provenance.",
    resultContract: RESULT_CONTRACT,
  },
  {
    id: "apparel-footwear-size-chart-deferral",
    domain: "apparel and footwear regional sizing",
    categorySlugs: [
      "t-shirts",
      "long-sleeve-shirts",
      "hoodies",
      "shoes",
      "footwear",
      "sandals",
      "socks",
      "apparel",
    ],
    categoryFamilies: ["apparel", "footwear"],
    fields: ["size"],
    canonicalValueModel:
      "Regional/apparel/footwear token with system plus size-chart measurements when available; without size-chart evidence it is advisory-only.",
    equivalence: [
      "raw-token-exact only within the same reviewed size system",
      "advisory-only for cross-system labels",
      "normalization-needed until size-chart facts exist",
    ],
    fallback:
      "Deferred no-nearest: no generic M/L, US/EU, youth, toddler, or footwear nearest fallback until size-chart materialization exists.",
    defaulting:
      "No defaulting across body/garment/footwear systems without chart-backed evidence.",
    disclosure:
      "Disclose size-chart deferral and not-comparable status instead of closest-size promises.",
    evidence:
      "Requires VariantProfileValue.valueJson system/token plus chart provenance before any reviewed alias or fallback can be considered.",
    resultContract: RESULT_CONTRACT,
  },
  {
    id: "device-fit-compatibility",
    domain: "device fit compatibility",
    categorySlugs: ["phone-cases", "tablet-cases", "electronics-accessories"],
    categoryFamilies: ["device-fit"],
    fields: ["deviceFit", "caseType"],
    canonicalValueModel:
      "Reviewed compatibility token for device/model/system; dimensions are not authority for fit.",
    equivalence: [
      "raw-token-exact or reviewed compatibility alias only",
      "protected-standard-style compatibility token",
      "normalization-needed for unparsed model strings",
    ],
    fallback:
      "Exact-only/no-nearest: never use measurement math or name similarity for device fit.",
    defaulting:
      "Do not default deviceFit; missing/absent compatibility means not-comparable or normalization-needed.",
    disclosure:
      "Disclose exact compatibility token, missing fit, and excluded nearest behavior.",
    evidence:
      "Requires normalized VariantProfileValue field=deviceFit or reviewed caseType compatibility evidence.",
    resultContract: RESULT_CONTRACT,
  },
  {
    id: "quality-and-thickness-no-nearest",
    domain: "quality metrics, gsm stock weight, thickness depth",
    categorySlugs: ["postcards", "canvas-prints", "stickers", "cards"],
    categoryFamilies: ["quality", "material"],
    fields: ["substrateWeightGsm", "canvasThicknessType", "thicknessMm", "depthMm"],
    canonicalValueModel:
      "Field-specific valueJson such as gsm, stock weight, thickness, depth, or reviewed tier token.",
    equivalence: [
      "raw-token-exact within the same field",
      "exact-unit-conversion for true thickness units only when field policy allows",
      "advisory-only for quality/tier semantics",
      "normalization-needed for missing units or conflicting tier evidence",
    ],
    fallback:
      "No-nearest by default for GSM/stock weight, areal density, thickness, depth, canvasThicknessType, and quality metrics unless a reviewed category policy promotes a narrow fallback.",
    defaulting:
      "Do not default quality metrics into product identity; absent fixed facts remain disclosure context.",
    disclosure:
      "Disclose exact-only or reviewed-category-policy requirement and not-comparable quality/tier differences.",
    evidence:
      "Requires VariantProfileValue.valueJson/numericValue and normalizationStatus for the exact field.",
    resultContract: RESULT_CONTRACT,
  },
  {
    id: "categorical-selected-source-context",
    domain: "categorical selected-source axes",
    categorySlugs: ["canvas-prints", "postcards", "phone-cases", "candles", "labels"],
    categoryFamilies: ["categorical", "selected-source"],
    fields: [
      "color",
      "finish",
      "frameIncluded",
      "frameMaterial",
      "material",
      "printType",
      "printPosition",
      "paperType",
      "caseType",
      "protection",
      "style",
      "scent",
      "labelType",
    ],
    canonicalValueModel:
      "Categorical token or structured valueJson with field roles required/defaultable/cosmetic context/display/unsupported/excluded. Finish, frameIncluded, frameMaterial, printType, printPosition, paperType, caseType, protection, style, scent, labelType, material, and color are exact/context decisions, not numeric axes.",
    equivalence: [
      "raw-token-exact only after normalized field ownership is known",
      "reviewed-alias for explicitly approved categorical aliases",
      "advisory-only for display/context-only facts",
      "normalization-needed for unnormalized or conflicting categorical facts",
    ],
    fallback:
      "No-nearest/exact-only for categorical systems unless a reviewed alias exists; unsupported or excluded fields do not participate in closest matching.",
    defaulting:
      "Defaultable is allowed only for supplier-declared fixed context. Missing, absent, and unnormalized required facts stay distinct from defaulted facts.",
    disclosure:
      "Disclose required/defaultable/cosmetic/context/display/unsupported/excluded role and reviewed-alias basis.",
    evidence:
      "Requires VariantProfileValue field ownership, originScope, valueJson/normalizedValue, normalizationStatus, and provenance.",
    resultContract: RESULT_CONTRACT,
  },
  {
    id: "color-option-kind-owner",
    domain: "color hex option kind owner",
    categorySlugs: [
      "canvas-prints",
      "t-shirts",
      "long-sleeve-shirts",
      "postcards",
      "phone-cases",
      "wall-art",
    ],
    categoryFamilies: ["color"],
    fields: ["color", "frameMaterial", "finish", "paperType"],
    canonicalValueModel:
      "colorMeta with raw, displayColor, hex, option kind, owner/what is colored: product color/base-product versus presentation/frame color/frame-or-hardware/print-substrate. A supplier-proven no-blank-color-option is a defaultable base-product choice, while unrelated non-color kinds such as paper, material, finish, scent, quantity, configuration, or shape are not color matches.",
    equivalence: [
      "raw-token-exact for same normalized color token with same owner",
      "defaulted when exactly one side has supplier-proven no-blank-color-option and the other side has a structured base-product color",
      "reviewed alias for explicitly reviewed same color/owner pairs",
      "perceptual fallback only for solid provenance-backed sRGB swatches with the same known owner",
      "advisory-only for unknown owner or display-only labels",
      "normalization-needed for non-color option kind leakage",
    ],
    fallback:
      "After exact normalized/reviewed aliases, explicitly enabled color fields may use Delta E OK in OKLab up to 0.06. Patterns, gradients, multicolor, clear/transparent, finishes, materials, missing or invalid swatches, unknown owners, and missing provenance remain unresolved.",
    defaulting:
      "Do not default color owner or invent a missing color axis. Default only a supplier-proven no-blank-color-option with owner=base-product; unknown owner and unrelated non-color kinds still block or re-route.",
    disclosure:
      "Disclose requested and offered labels/swatches plus closest-available wording. Never expose the raw distance as a user-facing quality claim.",
    evidence:
      "Requires canonical VariantProfileValue.valueJson.colorMeta kind=color, six-digit sRGB hex, display label, known owner, normalizedValue, normalizationStatus=exact, source, and evidencePath.",
    resultContract: RESULT_CONTRACT,
  },
  {
    id: "source-local-selected-source-exclusions",
    domain: "source-local metadata and not-a-product-picker axes",
    categorySlugs: ["mugs", "phone-cases", "apparel", "all"],
    categoryFamilies: ["source-local", "metadata"],
    fields: ["provider", "fulfilledFrom", "currency", "supplierVariantId", "pricingMode", "finish", "surface", "shape", "sla", "radio", "stitch_color"],
    sourceAxisKeys: ["provider", "fulfilledFrom", "currency", "supplierVariantId", "pricingMode", "surface", "finish", "shape", "sla", "radio", "stitch_color"],
    sourceLocalAxes: ["provider", "fulfilledFrom", "currency", "supplierVariantId", "pricingMode", "surface", "finish", "shape", "sla", "radio", "stitch_color"],
    canonicalValueModel:
      "Source-local provider, fulfilledFrom fulfillment, currency pricing, supplierVariantId metadata, pricingMode pricing, SLA, radio, stitch_color, and gift packaging surface/shape add-on axes are not product picker facts.",
    equivalence: [
      "advisory-only metadata",
      "normalization-needed if an excluded source-local axis was mapped into a product field",
    ],
    fallback:
      "Excluded/source-local/no-nearest/not-comparable: provider, fulfillment, pricing, supplier identity, gift packaging add-on, and operational metadata must not drive closest product matching.",
    defaulting:
      "Do not default source-local metadata into product facts; keep missing/absent/unnormalized/defaulted states explicit.",
    disclosure:
      "Disclose source-local not-a-product-picker metadata, add-on packaging, pricing/fulfillment role, and excluded selected-source status.",
    evidence:
      "Requires outcome-ledger provenance or normalized VariantProfileValue originScope showing metadata/source-local semantics.",
    resultContract: RESULT_CONTRACT,
  },
] as const satisfies readonly SelectedSourceMeasurementPolicyEntry[];

export const SELECTED_SOURCE_MEASUREMENT_POLICIES =
  SELECTED_SOURCE_MEASUREMENT_POLICY_MATRIX;

export const MEASUREMENT_LIKE_SELECTED_SOURCE_POLICIES =
  SELECTED_SOURCE_MEASUREMENT_POLICY_MATRIX;

const ALWAYS_SOURCE_LOCAL_FACT_FIELDS = new Set(
  [
    "provider",
    "fulfilledfrom",
    "currency",
    "suppliervariantid",
    "pricingmode",
    "sla",
    "radio",
    "stitch_color",
  ].map(normalizeKey),
);

// The axis vocabulary adds picker fields to the same normalized source-local facts.
const SOURCE_LOCAL_AXIS_KEYS = new Set([
  ...ALWAYS_SOURCE_LOCAL_FACT_FIELDS,
  "finish",
  "surface",
  "shape",
]);

const APPAREL_CATEGORY_TERMS = [
  "shirt",
  "hoodie",
  "apparel",
  "shoe",
  "footwear",
  "sandal",
  "sock",
];
const WALL_ART_CATEGORY_TERMS = ["canvas", "poster", "print", "wall-art", "wallart"];
/**
 * Closest options are compared by ratio, so one step costs the same at any
 * size and in either orientation (a 3:4 to 2:3 change is 0.118 whichever way
 * the print hangs). A ladder step is about x1.25; past x2 or /2 the option is
 * another product, not the closest one. Aspect drift beyond 30% changes the
 * shape (8x24 stands in for 8x30; 12x36 doesn't for 10x44). Distances are
 * rounded so two neighbours one ratio step away tie exactly and price decides
 * between them.
 */
const MAX_WALL_ART_NEAREST_LOG_ASPECT_DRIFT = Math.log(1.3);
const MAX_NEAREST_LOG_RATIO = Math.log(2) + 1e-9;
const NEAREST_LOG_DISTANCE_PRECISION = 1000;

function roundedLogDistance(value: number): number {
  return Math.round(value * NEAREST_LOG_DISTANCE_PRECISION) / NEAREST_LOG_DISTANCE_PRECISION;
}

type WallArtNearestSize =
  | { readonly kind: "nearest"; readonly distance: number }
  | { readonly kind: "invalid-dimensions" }
  | { readonly kind: "aspect-drift" }
  | { readonly kind: "area-bound" };

function hasPositiveDimensions(value: { readonly widthMm: number; readonly heightMm: number }): boolean {
  return (
    Number.isFinite(value.widthMm) &&
    Number.isFinite(value.heightMm) &&
    value.widthMm > 0 &&
    value.heightMm > 0
  );
}

/**
 * The closest-size distance between two same-orientation prints, or why the
 * target cannot stand in: hypot(ln w′/w, ln h′/h), within the aspect drift and
 * the x2 area bound. Callers check orientation and transposition first.
 */
export function wallArtNearestSize(
  source: { readonly widthMm: number; readonly heightMm: number },
  target: { readonly widthMm: number; readonly heightMm: number },
): WallArtNearestSize {
  if (!hasPositiveDimensions(source) || !hasPositiveDimensions(target)) {
    return { kind: "invalid-dimensions" };
  }
  const logWidth = Math.log(target.widthMm / source.widthMm);
  const logHeight = Math.log(target.heightMm / source.heightMm);
  if (Math.abs(logWidth - logHeight) > MAX_WALL_ART_NEAREST_LOG_ASPECT_DRIFT) {
    return { kind: "aspect-drift" };
  }
  if (Math.abs(logWidth + logHeight) > MAX_NEAREST_LOG_RATIO) {
    return { kind: "area-bound" };
  }
  return { kind: "nearest", distance: roundedLogDistance(Math.hypot(logWidth, logHeight)) };
}

export function classifySelectedSourceMeasurementMatch(
  input: SelectedSourceMeasurementMatchInput,
): SelectedSourceMeasurementMatchResult {
  return evaluateSelectedSourceMeasurementMatch(input);
}

export function createSelectedSourceMeasurementMatchEvaluator(): SelectedSourceMeasurementMatchEvaluator {
  const inspectionCache: MatchFactInspectionCache = new WeakMap();
  return input =>
    evaluateSelectedSourceMeasurementMatchWithInspectionCache(
      input,
      inspectionCache
    );
}

export function evaluateSelectedSourceMeasurementMatch(
  input: SelectedSourceMeasurementMatchInput,
): SelectedSourceMeasurementMatchResult {
  return evaluateSelectedSourceMeasurementMatchWithInspectionCache(input);
}

function absentMeasurementResult(
  field: string,
  disclosure: string
): SelectedSourceMeasurementMatchResult {
  return result({
    classification: "not-comparable",
    policyId: policyForField(field),
    canonicalValueModel: "documented absent VariantProfileValue state",
    equivalenceBasis: "advisory-only",
    disclosure,
    evidenceRequirement:
      "Preserve VariantProfileValue.state=absent / normalizationStatus=absent as documented absence; do not default or exact-match stale normalizedValue tokens.",
  });
}

function sourceLocalMeasurementResult(): SelectedSourceMeasurementMatchResult {
  return result({
    classification: "not-comparable",
    policyId: "source-local-selected-source-exclusions",
    canonicalValueModel: "source-local metadata not-a-product-picker",
    equivalenceBasis: "advisory-only",
    disclosure:
      "source-local not-a-product-picker metadata/add-on axis is excluded from selected-source closest matching; provider, fulfillment, pricing, supplier identity, or gift packaging add-on differences are not product fallback dimensions.",
    evidenceRequirement:
      "Use normalized/source-local outcome provenance; do not compare this metadata as product VariantProfileValue authority.",
  });
}

function blockedNormalizationMeasurementResult(
  field: string,
  disclosure: string
): SelectedSourceMeasurementMatchResult {
  return result({
    classification: "normalization-needed",
    policyId: policyForField(field),
    canonicalValueModel: "structured VariantProfileValue authority",
    equivalenceBasis: "normalization-needed",
    disclosure,
    evidenceRequirement:
      "Resolve VariantProfileValue.valueJson, normalizedValue, and normalizationStatus before matching; raw labels remain evidence only.",
  });
}

function protectedPaperMeasurementResult(
  source: MatchFact | null,
  target: MatchFact | null,
  inspectionCache?: MatchFactInspectionCache,
): SelectedSourceMeasurementMatchResult {
  const sourceStandard = readStandard(source, inspectionCache);
  const targetStandard = readStandard(target, inspectionCache);
  if (sourceStandard && sourceStandard === targetStandard) {
    return result({
      classification: "exact",
      policyId: "protected-paper-standards",
      canonicalValueModel: "protected paper standard token",
      equivalenceBasis: "protected-standard",
      disclosure:
        "protected-standard token matches exactly; dimensions are display context and are not generic nearest authority.",
      evidenceRequirement:
        "Requires VariantProfileValue.valueJson.standard or reviewed protected normalizedValue.",
    });
  }
  return result({
    classification: "not-comparable",
    policyId: "protected-paper-standards",
    canonicalValueModel: "protected paper standard token",
    equivalenceBasis: "protected-standard",
    disclosure:
      "protected-standard mismatch is not-comparable; A4, Letter, Legal, Tabloid, and Ledger must not collapse through generic dimension distance.",
    evidenceRequirement:
      "Requires protected standard token evidence in VariantProfileValue.valueJson/normalizedValue.",
  });
}

function exactNormalizedMeasurementResult(
  field: string
): SelectedSourceMeasurementMatchResult {
  return result({
    classification: "exact",
    policyId: policyForField(field),
    canonicalValueModel: "normalized VariantProfileValue token",
    equivalenceBasis: "raw-token-exact",
    disclosure:
      "normalizedValue matches exactly under field policy; raw supplier labels remain evidence/display context.",
    evidenceRequirement:
      "Requires ready VariantProfileValue.normalizedValue and normalizationStatus.",
  });
}

function defaultNotComparableMeasurementResult(
  field: string
): SelectedSourceMeasurementMatchResult {
  return result({
    classification: "not-comparable",
    policyId: policyForField(field),
    canonicalValueModel: "field-specific normalized VariantProfileValue",
    equivalenceBasis: "advisory-only",
    disclosure:
      "No reviewed equivalence, defaulting, or nearest fallback applies for this field; missing, absent, unnormalized, and different facts remain disclosed.",
    evidenceRequirement:
      "Requires a policy-owned normalized/materialized fact before selected-source matching can compare this value.",
  });
}

function inspectWallArtLayoutFact(fact: MatchFact | null): {
  token: string | null;
  malformed: boolean;
} {
  const layout = readWallArtLayout(fact?.valueJson);
  const token = layout ? wallArtLayoutToken(layout) : null;
  return {
    token,
    malformed:
      readWallArtLayoutEvidence(fact?.valueJson, fact?.normalizedValue) &&
      (token === null || token !== fact?.normalizedValue),
  };
}

function evaluateWallArtLayout(
  source: MatchFact | null,
  target: MatchFact | null
): SelectedSourceMeasurementMatchResult {
  const sourceLayout = inspectWallArtLayoutFact(source);
  const targetLayout = inspectWallArtLayoutFact(target);
  const malformed = sourceLayout.malformed || targetLayout.malformed;
  const exact =
    !malformed &&
    sourceLayout.token !== null &&
    sourceLayout.token === targetLayout.token;
  return result({
    classification: malformed
      ? "normalization-needed"
      : exact
        ? "exact"
        : "not-comparable",
    policyId: "wall-art-layout",
    canonicalValueModel:
      "ordered wall-art component dimensions and orientations",
    equivalenceBasis: malformed
      ? "normalization-needed"
      : exact
        ? "ordered-components-exact"
        : "advisory-only",
    disclosure: malformed
      ? "Layout evidence is malformed or conflicts with its normalized token."
      : exact
        ? "Ordered layout components match exactly; names are display context."
        : "Different layouts and layout-versus-rectangle sizes have no nearest fallback.",
    evidenceRequirement:
      "Requires a validated ordered component tuple, matching quantity and normalized layout token.",
  });
}

function evaluateFieldSpecificMeasurement(
  field: string,
  categorySlug: string,
  source: MatchFact | null,
  target: MatchFact | null,
  inspectionCache?: MatchFactInspectionCache,
): SelectedSourceMeasurementMatchResult | null {
  if (field === "size" && (readWallArtLayoutEvidence(source?.valueJson, source?.normalizedValue) || readWallArtLayoutEvidence(target?.valueJson, target?.normalizedValue))) {
    return evaluateWallArtLayout(source, target);
  }

  if (
    field === "capacity" ||
    (field === "size" && isCapacityLike(categorySlug, source, target, inspectionCache))
  ) {
    return evaluateCapacity(source, target, inspectionCache);
  }

  if (field === "quantity" || field === "pagecount") {
    return evaluateOrderedCount(field, source, target);
  }

  if (field === "size" && isApparelOrFootwear(categorySlug, source, target)) {
    return evaluateApparelOrFootwearSize(source, target);
  }

  if (field === "size" && isWallArtSize(categorySlug, source, target)) {
    return evaluateWallArtSize(source, target, inspectionCache);
  }

  if (["substrateweightgsm", "canvasthicknesstype", "thicknessmm", "depthmm"].includes(field)) {
    return evaluateQualityMetric(field, source, target);
  }

  if (["devicefit", "casetype"].includes(field)) {
    return evaluateDeviceFitCompatibility(source, target);
  }

  return null;
}

function evaluateSelectedSourceMeasurementMatchWithInspectionCache(
  input: SelectedSourceMeasurementMatchInput,
  inspectionCache?: MatchFactInspectionCache
): SelectedSourceMeasurementMatchResult {
  const field = normalizeField(input.field ?? input.source?.field ?? input.target?.field);
  const categorySlug = String(input.categorySlug ?? "").toLowerCase();
  const sourceAxisKey = normalizeKey(input.sourceAxisKey ?? "");
  const source = input.source ?? null;
  const target = input.target ?? null;

  const absent = absentStateReason(source, target, inspectionCache);
  if (absent) return absentMeasurementResult(field, absent);

  if (
    SOURCE_LOCAL_AXIS_KEYS.has(sourceAxisKey) ||
    isSourceLocalFact(source, inspectionCache) ||
    isSourceLocalFact(target, inspectionCache)
  ) {
    return sourceLocalMeasurementResult();
  }

  if (isColorMeasurement(field, source, target, inspectionCache)) {
    return evaluateColor(input);
  }

  const blocked = blockingNormalizationReason(
    source,
    target,
    inspectionCache
  );
  if (blocked) return blockedNormalizationMeasurementResult(field, blocked);

  if (isProtectedPaperComparison(source, target, inspectionCache)) {
    return protectedPaperMeasurementResult(source, target, inspectionCache);
  }

  const fieldSpecific = evaluateFieldSpecificMeasurement(
    field,
    categorySlug,
    source,
    target,
    inspectionCache
  );
  if (fieldSpecific) return fieldSpecific;

  if (normalizedValue(source) && normalizedValue(source) === normalizedValue(target)) {
    return exactNormalizedMeasurementResult(field);
  }

  return defaultNotComparableMeasurementResult(field);
}

export const evaluateMeasurementLikeSelectedSourceMatch =
  evaluateSelectedSourceMeasurementMatch;

function evaluateWallArtSize(
  source: MatchFact | null,
  target: MatchFact | null,
  inspectionCache?: MatchFactInspectionCache,
): SelectedSourceMeasurementMatchResult {
  if (!hasUsableNormalizedValue(source) || !hasUsableNormalizedValue(target)) {
    return result({
      classification: "normalization-needed",
      policyId: "wall-art-2d-size",
      canonicalValueModel: "wall-art widthMm/heightMm/orientation",
      equivalenceBasis: "normalization-needed",
      disclosure:
        "wall-art size is missing normalizedValue; it requires a usable VariantProfileValue.normalizedValue as well as structured width/height evidence before exact or closest fallback matching.",
      evidenceRequirement:
        "Requires valueJson.widthMm/valueJson.heightMm plus normalizedValue and normalizationStatus.",
    });
  }

  const sourceDims = readDimensions(source, inspectionCache);
  const targetDims = readDimensions(target, inspectionCache);
  if (
    !sourceDims ||
    !targetDims ||
    !hasPositiveDimensions(sourceDims) ||
    !hasPositiveDimensions(targetDims)
  ) {
    return result({
      classification: "normalization-needed",
      policyId: "wall-art-2d-size",
      canonicalValueModel: "wall-art widthMm/heightMm/orientation",
      equivalenceBasis: "normalization-needed",
      disclosure:
        "wall-art size requires positive structured VariantProfileValue.valueJson widthMm/heightMm before exact or closest matching can run.",
      evidenceRequirement:
        "Requires valueJson.widthMm/valueJson.heightMm plus normalizedValue and normalizationStatus.",
    });
  }

  if (approximatelyEqual(sourceDims.widthMm, targetDims.widthMm) && approximatelyEqual(sourceDims.heightMm, targetDims.heightMm)) {
    return result({
      classification: "equivalent",
      policyId: "wall-art-2d-size",
      canonicalValueModel: "wall-art widthMm/heightMm/orientation",
      equivalenceBasis: "exact-unit-conversion",
      disclosure:
        "same structured wall-art dimensions match by exact-unit-conversion over VariantProfileValue.valueJson widthMm/heightMm and normalizedValue.",
      evidenceRequirement:
        "Requires ready normalized VariantProfileValue.valueJson dimensions and normalizationStatus.",
    });
  }

  if (normalizedValue(source) && normalizedValue(source) === normalizedValue(target)) {
    return result({
      classification: "normalization-needed",
      policyId: "wall-art-2d-size",
      canonicalValueModel: "wall-art widthMm/heightMm/orientation",
      equivalenceBasis: "normalization-needed",
      disclosure:
        "same normalized wall-art size token has structured VariantProfileValue.valueJson dimension mismatch beyond tolerance; normalizedValue cannot override width/height evidence before matching or fallback.",
      evidenceRequirement:
        "Resolve valueJson.widthMm/valueJson.heightMm and normalizedValue consistency before wall-art exact or nearest fallback matching.",
    });
  }

  if (isTransposed(sourceDims, targetDims) || orientation(sourceDims) !== orientation(targetDims)) {
    return result({
      classification: "not-comparable",
      policyId: "wall-art-2d-size",
      canonicalValueModel: "wall-art widthMm/heightMm/orientation",
      equivalenceBasis: "advisory-only",
      disclosure:
        "transposed orientation/aspect change must not be silently exact or equivalent; review rotation/orientation before any fallback.",
      evidenceRequirement:
        "Requires orientation/aspect-aware VariantProfileValue.valueJson evidence.",
    });
  }

  const nearest = wallArtNearestSize(sourceDims, targetDims);
  if (nearest.kind === "invalid-dimensions") {
    return result({
      classification: "normalization-needed",
      policyId: "wall-art-2d-size",
      canonicalValueModel: "wall-art widthMm/heightMm/orientation",
      equivalenceBasis: "normalization-needed",
      disclosure: "wall-art size requires positive structured dimensions before closest matching can run.",
      evidenceRequirement: "Requires positive valueJson.widthMm/valueJson.heightMm.",
    });
  }
  if (nearest.kind === "aspect-drift") {
    return result({
      classification: "not-comparable",
      policyId: "wall-art-2d-size",
      canonicalValueModel: "wall-art widthMm/heightMm/aspect ratio",
      equivalenceBasis: "advisory-only",
      disclosure:
        "wall-art nearest fallback is blocked because the aspect ratio differs by more than 30%; that is another shape, not the closest size.",
      evidenceRequirement:
        "Requires aspect-ratio-aware VariantProfileValue.valueJson evidence before nearest fallback.",
    });
  }
  if (nearest.kind === "area-bound") {
    return result({
      classification: "not-comparable",
      policyId: "wall-art-2d-size",
      canonicalValueModel: "wall-art widthMm/heightMm area ratio",
      equivalenceBasis: "advisory-only",
      disclosure:
        "wall-art nearest fallback is blocked because the offered print is more than twice or under half the requested area; that is another product, not the closest size.",
      evidenceRequirement:
        "Requires a size within x2 of the requested area before nearest fallback.",
    });
  }

  return result({
    classification: "fallback",
    policyId: "wall-art-2d-size",
    canonicalValueModel: "wall-art widthMm/heightMm/orientation",
    equivalenceBasis: "advisory-only",
    fallbackDistance: nearest.distance,
    fallbackFactor: {
      kind: "wall-art-size",
      unit: "log-ratio",
      value: nearest.distance,
    },
    disclosure:
      "wall-art nearest fallback ranks sizes by width and height ratio, the same in either orientation, within x2 of the requested area; ties fall to price.",
    evidenceRequirement:
      "Requires structured VariantProfileValue.valueJson dimensions and category-approved nearest fallback policy.",
  });
}

function evaluateCapacity(
  source: MatchFact | null,
  target: MatchFact | null,
  inspectionCache?: MatchFactInspectionCache,
): SelectedSourceMeasurementMatchResult {
  const internalConflict = capacityInternalConflictReason(source) ?? capacityInternalConflictReason(target);
  if (internalConflict) {
    return result({
      classification: "normalization-needed",
      policyId: "drinkware-capacity-as-size",
      canonicalValueModel: "capacity ml/oz reviewed bucket",
      equivalenceBasis: "normalization-needed",
      disclosure: internalConflict,
      evidenceRequirement:
        "Requires each VariantProfileValue.valueJson capacity ml/oz pair to agree within reviewed tolerance before alias equivalence.",
    });
  }

  const sameNormalized = normalizedValue(source) && normalizedValue(source) === normalizedValue(target);
  const reviewedSupplierPair =
    isReviewedCapacitySupplierPair(source) || isReviewedCapacitySupplierPair(target);
  if (sameNormalized && reviewedSupplierPair) {
    return result({
      classification: "equivalent",
      policyId: "drinkware-capacity-as-size",
      canonicalValueModel: "capacity ml/oz reviewed bucket",
      equivalenceBasis: "supplier-declared-pair",
      disclosure:
        "capacity matches through an exact reviewed supplier-declared pair; both marketed units and the durable policy case remain attached to the profile fact.",
      evidenceRequirement:
        "Requires matching reviewed normalizedValue plus valueJson.equivalenceBasis=supplier-declared-pair, reviewedBucket, and reviewedCaseId.",
    });
  }

  const sourceCapacity = readCapacityMl(source, inspectionCache);
  const targetCapacity = readCapacityMl(target, inspectionCache);
  if (sourceCapacity !== null && targetCapacity !== null) {
    const distance = Math.abs(sourceCapacity - targetCapacity);
    if (distance > 15) {
      if (sameNormalized) {
        return result({
          classification: "normalization-needed",
          policyId: "drinkware-capacity-as-size",
          canonicalValueModel: "capacity ml/oz reviewed bucket",
          equivalenceBasis: "normalization-needed",
          disclosure:
            "structured capacity ml/oz evidence disagrees beyond reviewed tolerance; same normalized bucket cannot override valueJson mismatch and needs normalization before matching.",
          evidenceRequirement:
            "Requires VariantProfileValue.valueJson ml/oz to agree within reviewed tolerance before reviewed capacity alias equivalence.",
        });
      }

      return result({
        classification: "not-comparable",
        policyId: "drinkware-capacity-as-size",
        canonicalValueModel: "capacity ml/oz reviewed bucket",
        equivalenceBasis: "advisory-only",
        disclosure:
          "different valid capacity buckets have no reviewed alias or category-approved nearest fallback; keep as not-comparable rather than guessing closest capacity.",
        evidenceRequirement:
          "Requires reviewed capacity alias evidence before different ml/oz buckets can match.",
      });
    }
  }

  if (sameNormalized || (sourceCapacity !== null && targetCapacity !== null)) {
    return result({
      classification: "equivalent",
      policyId: "drinkware-capacity-as-size",
      canonicalValueModel: "capacity ml/oz reviewed bucket",
      equivalenceBasis: "reviewed-nominal-alias",
      disclosure:
        "capacity matches through reviewed-nominal-alias / exact unit conversion for ml/oz bucket; conflicts remain normalization-needed.",
      evidenceRequirement:
        "Requires VariantProfileValue.valueJson ml/oz or reviewed normalizedValue with normalizationStatus.",
    });
  }
  return result({
    classification: "not-comparable",
    policyId: "drinkware-capacity-as-size",
    canonicalValueModel: "capacity ml/oz reviewed bucket",
    equivalenceBasis: "advisory-only",
    disclosure:
      "capacity has no reviewed alias or category-approved nearest fallback; keep as not-comparable rather than guessing.",
    evidenceRequirement:
      "Requires reviewed capacity alias or structured ml/oz valueJson before matching.",
  });
}

function evaluateOrderedCount(
  field: string,
  source: MatchFact | null,
  target: MatchFact | null,
): SelectedSourceMeasurementMatchResult {
  const internalConflict = orderedCountInternalConflictReason(source) ?? orderedCountInternalConflictReason(target);
  if (internalConflict) {
    return result({
      classification: "normalization-needed",
      policyId: "ordered-quantity-and-page-count",
      canonicalValueModel: "count plus unitKind",
      equivalenceBasis: "normalization-needed",
      disclosure: internalConflict,
      evidenceRequirement:
        "Requires each VariantProfileValue.valueJson.count to agree with numericValue before ordered exact or nearest fallback matching.",
    });
  }

  const sourceCount = readCount(source);
  const targetCount = readCount(target);
  if (!sourceCount || !targetCount) {
    return result({
      classification: "normalization-needed",
      policyId: "ordered-quantity-and-page-count",
      canonicalValueModel: "count plus unitKind",
      equivalenceBasis: "normalization-needed",
      disclosure:
        "ordered quantity/page count requires count and matching unitKind before exact or fallback comparison.",
      evidenceRequirement:
        "Requires VariantProfileValue.valueJson.count, numericValue, unitKind, and normalizationStatus.",
    });
  }

  if (!sourceCount.unitKind || !targetCount.unitKind) {
    return result({
      classification: "normalization-needed",
      policyId: "ordered-quantity-and-page-count",
      canonicalValueModel: "count plus unitKind",
      equivalenceBasis: "normalization-needed",
      disclosure:
        "ordered quantity/page count requires count and unitKind before exact or fallback comparison.",
      evidenceRequirement:
        "Requires VariantProfileValue.valueJson.count, numericValue, unitKind, and normalizationStatus.",
    });
  }

  if (sourceCount.unitKind !== targetCount.unitKind) {
    return result({
      classification: "not-comparable",
      policyId: "ordered-quantity-and-page-count",
      canonicalValueModel: "count plus unitKind",
      equivalenceBasis: "advisory-only",
      disclosure:
        "ordered quantity/page count has different valid unitKind values; no reviewed cross-unit conversion is allowed.",
      evidenceRequirement:
        "Requires matching unitKind or a reviewed cross-unit equivalence before exact or fallback matching.",
    });
  }

  if (sourceCount.count <= 0 || targetCount.count <= 0) {
    return result({
      classification: "normalization-needed",
      policyId: "ordered-quantity-and-page-count",
      canonicalValueModel: "ordered count plus unitKind",
      equivalenceBasis: "normalization-needed",
      disclosure: "ordered quantity/page count must be positive before exact or closest matching.",
      evidenceRequirement: "Requires a positive VariantProfileValue.valueJson.count.",
    });
  }

  if (
    normalizedValue(source) &&
    normalizedValue(source) === normalizedValue(target) &&
    sourceCount.count !== targetCount.count
  ) {
    return result({
      classification: "normalization-needed",
      policyId: "ordered-quantity-and-page-count",
      canonicalValueModel: "count plus unitKind",
      equivalenceBasis: "normalization-needed",
      disclosure:
        "same normalized ordered quantity/page-count token has structured count or numericValue mismatch; normalizedValue cannot override count evidence before exact or fallback matching.",
      evidenceRequirement:
        "Requires VariantProfileValue.valueJson.count/numericValue and unitKind to agree with normalizedValue before ordered exact or nearest fallback matching.",
    });
  }

  if (sourceCount.count === targetCount.count) {
    return result({
      classification: "exact",
      policyId: "ordered-quantity-and-page-count",
      canonicalValueModel: "count plus unitKind",
      equivalenceBasis: "raw-token-exact",
      disclosure:
        "ordered quantity/page count exact match on count and unitKind.",
      evidenceRequirement:
        "Requires normalized count/unitKind VariantProfileValue evidence.",
    });
  }

  if (!orderedCountAllowsNearestFallback(field, sourceCount.unitKind)) {
    return result({
      classification: "not-comparable",
      policyId: "ordered-quantity-and-page-count",
      canonicalValueModel: "exact-only count identity",
      equivalenceBasis: "advisory-only",
      disclosure:
        "pack identity, bundle identity, puzzle-piece counts, and other non print-run/page-count quantities are exact-only/no-nearest; different counts are not-comparable.",
      evidenceRequirement:
        "Requires reviewed ordered print-run or page-count policy before nearest count fallback can be used.",
    });
  }

  const logRatio = Math.abs(Math.log(targetCount.count / sourceCount.count));
  if (logRatio > MAX_NEAREST_LOG_RATIO) {
    return result({
      classification: "not-comparable",
      policyId: "ordered-quantity-and-page-count",
      canonicalValueModel: "ordered count plus unitKind",
      equivalenceBasis: "advisory-only",
      disclosure:
        "ordered quantity/page count is more than twice or under half the requested count; that is another order, not the closest one.",
      evidenceRequirement: "Requires a count within x2 of the requested count before nearest fallback.",
    });
  }

  const fallbackDistance = roundedLogDistance(logRatio);
  return result({
    classification: "fallback",
    policyId: "ordered-quantity-and-page-count",
    canonicalValueModel: "ordered count plus unitKind",
    equivalenceBasis: "advisory-only",
    fallbackDistance,
    fallbackFactor: {
      kind: "ordered-count",
      unit: "log-ratio",
      value: fallbackDistance,
    },
    disclosure:
      field === "pagecount"
        ? "ordered page count fallback ranks counts by ratio with matching unitKind=pages, within x2."
        : "ordered quantity print-run fallback ranks counts by ratio with matching unitKind, within x2.",
    evidenceRequirement:
      "Requires category-approved ordered count policy, numericValue/count, and matching unitKind.",
  });
}

function evaluateApparelOrFootwearSize(
  source: MatchFact | null,
  target: MatchFact | null,
): SelectedSourceMeasurementMatchResult {
  const sourceSize = readApparelOrFootwearSize(source);
  const targetSize = readApparelOrFootwearSize(target);
  const sourceNormalized = normalizedValue(source);
  const targetNormalized = normalizedValue(target);
  const sameNormalized =
    sourceNormalized !== null && sourceNormalized === targetNormalized;

  if (
    sameNormalized &&
    sourceSize &&
    targetSize &&
    normalizeKey(sourceSize.system) === normalizeKey(targetSize.system) &&
    normalizeKey(sourceSize.token) === normalizeKey(targetSize.token)
  ) {
    return result({
      classification: "equivalent",
      policyId: "apparel-footwear-size-chart-deferral",
      canonicalValueModel: "apparel/footwear same reviewed size-system token",
      equivalenceBasis: "raw-token-exact",
      disclosure:
        "same reviewed apparel/footwear size system and token match by raw-token-exact; size-chart closest fallback remains deferred/no-nearest for cross-token or cross-system comparisons.",
      evidenceRequirement:
      "Requires VariantProfileValue.valueJson system/token and reviewed normalizedValue for both sides; size-chart facts are required before any nearest fallback.",
    });
  }

  if (
    sourceSize &&
    targetSize &&
    sourceNormalized &&
    targetNormalized &&
    sourceNormalized !== targetNormalized
  ) {
    return result({
      classification: "not-comparable",
      policyId: "apparel-footwear-size-chart-deferral",
      canonicalValueModel: "apparel/footwear size-chart-backed token",
      equivalenceBasis: "advisory-only",
      disclosure:
        "The reviewed apparel/footwear size tokens differ. They are not comparable because size-chart nearest fallback remains disabled.",
      evidenceRequirement:
        "Requires the same reviewed size system/token for equivalence; size-chart facts are required before any nearest fallback.",
    });
  }

  return result({
    classification: "normalization-needed",
    policyId: "apparel-footwear-size-chart-deferral",
    canonicalValueModel: "apparel/footwear size-chart-backed token",
    equivalenceBasis: "advisory-only",
    disclosure:
      "Apparel or footwear size evidence is missing or internally inconsistent; the same reviewed size system/token is required before comparison.",
    evidenceRequirement:
      "Requires VariantProfileValue.valueJson system/token plus size-chart provenance before reviewed equivalence or fallback.",
  });
}

function evaluateQualityMetric(
  field: string,
  source: MatchFact | null,
  target: MatchFact | null,
): SelectedSourceMeasurementMatchResult {
  const internalConflict = qualityMetricInternalConflictReason(field, source) ?? qualityMetricInternalConflictReason(field, target);
  if (internalConflict) {
    return result({
      classification: "normalization-needed",
      policyId: "quality-and-thickness-no-nearest",
      canonicalValueModel: "quality metric/gsm/thickness/depth field-specific value",
      equivalenceBasis: "normalization-needed",
      disclosure: internalConflict,
      evidenceRequirement:
        "Requires each VariantProfileValue.valueJson field-specific numeric value to agree with numericValue before exact-only quality matching.",
    });
  }

  const same = normalizedValue(source) && normalizedValue(source) === normalizedValue(target);
  const sourceMetric = readQualityMetricValue(field, source);
  const targetMetric = readQualityMetricValue(field, target);

  if (
    same &&
    sourceMetric !== null &&
    targetMetric !== null &&
    !approximatelyEqual(sourceMetric, targetMetric)
  ) {
    return result({
      classification: "normalization-needed",
      policyId: "quality-and-thickness-no-nearest",
      canonicalValueModel: "quality metric/gsm/thickness/depth field-specific value",
      equivalenceBasis: "normalization-needed",
      disclosure:
        "structured GSM/stock-weight/thickness valueJson or numericValue mismatch cannot be overridden by the same normalized token; resolve the field-specific numeric evidence before exact-only matching.",
      evidenceRequirement:
        "Requires VariantProfileValue.valueJson/numericValue to agree for the exact field before raw-token-exact quality matching.",
    });
  }

  return result({
    classification: same ? "exact" : "not-comparable",
    policyId: "quality-and-thickness-no-nearest",
    canonicalValueModel: "quality metric/gsm/thickness/depth field-specific value",
    equivalenceBasis: same ? "raw-token-exact" : "advisory-only",
    disclosure:
      "GSM, stock weight, thickness, depth, and quality metrics are exact-only/no-nearest unless a reviewed category policy explicitly promotes a narrow fallback.",
    evidenceRequirement:
      "Requires VariantProfileValue.valueJson/numericValue and normalizationStatus for the exact field.",
  });
}

function evaluateDeviceFitCompatibility(
  source: MatchFact | null,
  target: MatchFact | null,
): SelectedSourceMeasurementMatchResult {
  const same = normalizedValue(source) && normalizedValue(source) === normalizedValue(target);
  const sourceIdentity = readDeviceCompatibilityIdentity(source);
  const targetIdentity = readDeviceCompatibilityIdentity(target);

  if (same && sourceIdentity && targetIdentity && sourceIdentity !== targetIdentity) {
    return result({
      classification: "normalization-needed",
      policyId: "device-fit-compatibility",
      canonicalValueModel: "device compatibility token",
      equivalenceBasis: "normalization-needed",
      disclosure:
        "structured device compatibility valueJson brand/model/system mismatch cannot be overridden by the same normalized deviceFit token; resolve compatibility identity before exact matching.",
      evidenceRequirement:
        "Requires VariantProfileValue.valueJson brand/model/system compatibility identity to agree with normalizedValue before exact-only device matching.",
    });
  }

  return result({
    classification: same ? "exact" : "not-comparable",
    policyId: "device-fit-compatibility",
    canonicalValueModel: "device compatibility token",
    equivalenceBasis: same ? "raw-token-exact" : "advisory-only",
    disclosure:
      "deviceFit/caseType compatibility is exact-only; no measurement or name-similarity nearest fallback is allowed.",
    evidenceRequirement:
      "Requires reviewed normalized VariantProfileValue compatibility token.",
  });
}

function orderedCountAllowsNearestFallback(field: string, unitKind: string): boolean {
  const normalizedUnitKind = normalizeKey(unitKind);
  if (field === "pagecount") {
    return normalizedUnitKind === "page" || normalizedUnitKind === "pages";
  }
  return normalizedUnitKind === "printrun";
}

function colorConflictResult(
  disclosure: string
): SelectedSourceMeasurementMatchResult {
  return result({
    classification: "normalization-needed",
    policyId: "color-option-kind-owner",
    canonicalValueModel: "colorMeta option kind and owner",
    equivalenceBasis: "normalization-needed",
    disclosure,
    evidenceRequirement:
      "Resolve conflicting VariantProfileValue.valueJson/colorMeta evidence before color owner or exact-token matching.",
  });
}

function evaluateNoBlankColorOption(
  sourceMeta: StructuredColorMeta | null,
  targetMeta: StructuredColorMeta | null
): SelectedSourceMeasurementMatchResult | null {
  const sourceHasNoBlankColorOption =
    sourceMeta?.kind === NO_BLANK_COLOR_OPTION_KIND;
  const targetHasNoBlankColorOption =
    targetMeta?.kind === NO_BLANK_COLOR_OPTION_KIND;
  if (!sourceHasNoBlankColorOption && !targetHasNoBlankColorOption) return null;

  const hasInvalidNoColorOwner =
    (sourceHasNoBlankColorOption && sourceMeta?.owner !== "base-product") ||
    (targetHasNoBlankColorOption && targetMeta?.owner !== "base-product");
  if (hasInvalidNoColorOwner) {
    return result({
      classification: "normalization-needed",
      policyId: "no-blank-color-option",
      canonicalValueModel: "supplier-proven absence of a blank-color picker",
      equivalenceBasis: "normalization-needed",
      disclosure:
        "A no-blank-color-option fact must describe the base product; its color owner evidence is inconsistent.",
      evidenceRequirement:
        "Requires exact variant-scoped colorMeta kind=no-blank-color-option and owner=base-product from supplier option and print-method evidence.",
    });
  }

  if (sourceHasNoBlankColorOption && targetHasNoBlankColorOption) {
    return result({
      classification: "exact",
      policyId: "no-blank-color-option",
      canonicalValueModel: "supplier-proven absence of a blank-color picker",
      equivalenceBasis: "raw-token-exact",
      disclosure:
        "Neither supplier exposes a blank-color choice for this all-over-print product.",
      evidenceRequirement:
        "Requires exact variant-scoped colorMeta kind=no-blank-color-option and owner=base-product on both sides.",
    });
  }

  const selectedColorMeta = sourceHasNoBlankColorOption
    ? targetMeta
    : sourceMeta;
  if (
    selectedColorMeta?.kind !== "color" ||
    selectedColorMeta.owner !== "base-product"
  ) {
    return result({
      classification: "normalization-needed",
      policyId: "no-blank-color-option",
      canonicalValueModel: "supplier-proven absence of a blank-color picker",
      equivalenceBasis: "normalization-needed",
      disclosure:
        "The supplier-proven no-color-picker fact can only default against a structured base-product color.",
      evidenceRequirement:
        "Requires exact variant-scoped base-product color evidence on the color-selectable side and supplier option/print-method evidence on the no-picker side.",
    });
  }

  return result({
    classification: "defaulted",
    policyId: "no-blank-color-option",
    canonicalValueModel: "supplier-proven absence of a blank-color picker",
    equivalenceBasis: "supplier-declared-pair",
    disclosure:
      "This supplier does not expose a blank-color choice for the all-over-print product, so that option is safely defaulted instead of hiding the closest offer.",
    evidenceRequirement:
      "Requires exact variant-scoped colorMeta kind=no-blank-color-option and owner=base-product from supplier option and print-method evidence.",
  });
}

function evaluateApparelGarmentColorOwners(
  sourceMeta: StructuredColorMeta | null,
  targetMeta: StructuredColorMeta | null
): SelectedSourceMeasurementMatchResult | null {
  if (sourceMeta?.kind !== "color" || targetMeta?.kind !== "color") {
    return result({
      classification: "normalization-needed",
      policyId: "t-shirt-garment-color",
      canonicalValueModel: "base-product garment color",
      equivalenceBasis: "normalization-needed",
      disclosure:
        "T-shirt color matching requires structured colorMeta kind=color on both profiles.",
      evidenceRequirement:
        "Requires canonical valueJson.colorMeta kind=color and owner=base-product for both T-shirt profiles.",
    });
  }

  const owners = [sourceMeta.owner, targetMeta.owner];
  if (owners.some(owner => !owner || owner === "unknown")) {
    return result({
      classification: "normalization-needed",
      policyId: "t-shirt-garment-color",
      canonicalValueModel: "base-product garment color",
      equivalenceBasis: "normalization-needed",
      disclosure:
        "T-shirt garment color owner is missing or unknown; owner=base-product is required.",
      evidenceRequirement:
        "Requires canonical valueJson.colorMeta owner=base-product for both T-shirt profiles.",
    });
  }
  if (owners.some(owner => owner !== "base-product")) {
    return result({
      classification: "not-comparable",
      policyId: "t-shirt-garment-color",
      canonicalValueModel: "base-product garment color",
      equivalenceBasis: "advisory-only",
      disclosure:
        "T-shirt color owner mismatch: non-garment print-substrate or frame/hardware color cannot match base-product garment color.",
      evidenceRequirement:
        "Requires canonical valueJson.colorMeta owner=base-product for both T-shirt profiles.",
    });
  }
  return null;
}

function nonColorKindResult(
  nonColorKind: string
): SelectedSourceMeasurementMatchResult {
  return result({
    classification: "normalization-needed",
    policyId: "color-option-kind-owner",
    canonicalValueModel: "colorMeta option kind and owner",
    equivalenceBasis: "normalization-needed",
    disclosure: `color option kind leakage: kind=${nonColorKind} is not color/non-color paper or material metadata and must be re-routed before color matching.`,
    evidenceRequirement:
      "Requires canonical valueJson.colorMeta kind=color, owner, hex/displayColor when available, normalizedValue, and normalizationStatus.",
  });
}

function missingColorMetaResult(): SelectedSourceMeasurementMatchResult {
  return result({
    classification: "normalization-needed",
    policyId: "color-option-kind-owner",
    canonicalValueModel: "colorMeta option kind and owner",
    equivalenceBasis: "normalization-needed",
    disclosure:
      "colorMeta option kind and owner evidence is missing; true-color rows need product/base versus frame/presentation context before matching.",
    evidenceRequirement:
      "Requires canonical colorMeta option kind plus owner/what is colored for both source and target.",
  });
}

function evaluateColorOwnerIssue(
  sourceOwner: string | undefined,
  targetOwner: string | undefined
): SelectedSourceMeasurementMatchResult | null {
  if (!sourceOwner || !targetOwner) {
    return result({
      classification: "normalization-needed",
      policyId: "color-option-kind-owner",
      canonicalValueModel: "colorMeta option kind and owner",
      equivalenceBasis: "normalization-needed",
      disclosure:
        "color owner is missing; product color/base-product versus frame/presentation color must be materialized before exact matching.",
      evidenceRequirement:
        "Requires color owner/what is colored in canonical colorMeta for both source and target.",
    });
  }
  if (sourceOwner === "unknown" || targetOwner === "unknown") {
    return result({
      classification: "normalization-needed",
      policyId: "color-option-kind-owner",
      canonicalValueModel: "colorMeta option kind and owner",
      equivalenceBasis: "normalization-needed",
      disclosure:
        "color owner is unknown; product color/base-product versus presentation/frame color must be known before #69 closest matching.",
      evidenceRequirement:
        "Requires color owner/what is colored in canonical colorMeta.",
    });
  }
  if (sourceOwner !== targetOwner) {
    return result({
      classification: "not-comparable",
      policyId: "color-option-kind-owner",
      canonicalValueModel: "colorMeta option kind and owner",
      equivalenceBasis: "advisory-only",
      disclosure:
        "color owner mismatch blocks matching: product color/base-product and frame/presentation color can share a token or hex but color what-is-colored semantics differ.",
      evidenceRequirement:
        "Requires same canonical color owner/what is colored before exact or reviewed color matching.",
    });
  }
  return null;
}

function colorExactResult(): SelectedSourceMeasurementMatchResult {
  return result({
    classification: "exact",
    policyId: "color-option-kind-owner",
    canonicalValueModel: "colorMeta option kind and owner",
    equivalenceBasis: "raw-token-exact",
    disclosure:
      "color exact match requires same normalized color token and same owner; hex is evidence, not nearest-distance authority.",
    evidenceRequirement:
      "Requires canonical colorMeta kind=color, known matching owner, and the same normalizedValue token.",
  });
}

function evaluateColorDescriptorEligibility(
  input: SelectedSourceMeasurementMatchInput,
  sourceMeta: StructuredColorMeta,
  targetMeta: StructuredColorMeta
): SelectedSourceMeasurementMatchResult | null {
  const compositeDescriptor =
    compositePerceptualColorDescriptor(input.source ?? null, sourceMeta) ??
    compositePerceptualColorDescriptor(input.target ?? null, targetMeta);
  if (compositeDescriptor) {
    return result({
      classification: "not-comparable",
      policyId: "color-option-kind-owner",
      canonicalValueModel: "structured composite color choice",
      equivalenceBasis: "advisory-only",
      disclosure: `${compositeDescriptor} is a composite color choice and cannot be represented by a single-swatch closest-color match.`,
      evidenceRequirement:
        "Requires an exact reviewed composite-color alias; single-swatch perceptual fallback is intentionally unavailable.",
    });
  }

  const transparentDescriptor =
    transparentPerceptualColorDescriptor(input.source ?? null, sourceMeta) ??
    transparentPerceptualColorDescriptor(input.target ?? null, targetMeta);
  if (transparentDescriptor) {
    return result({
      classification: "not-comparable",
      policyId: "color-option-kind-owner",
      canonicalValueModel: "structured transparent appearance choice",
      equivalenceBasis: "advisory-only",
      disclosure: `${transparentDescriptor} describes transparency rather than a solid opaque swatch and cannot participate in closest-color matching.`,
      evidenceRequirement:
        "Requires an exact reviewed transparency alias; opaque single-swatch perceptual fallback is intentionally unavailable.",
    });
  }

  const unsupportedDescriptor =
    unsupportedPerceptualColorDescriptor(input.source ?? null, sourceMeta) ??
    unsupportedPerceptualColorDescriptor(input.target ?? null, targetMeta);
  if (unsupportedDescriptor) {
    return result({
      classification: "normalization-needed",
      policyId: "color-option-kind-owner",
      canonicalValueModel: "solid sRGB color swatch with known owner",
      equivalenceBasis: "normalization-needed",
      disclosure: `${unsupportedDescriptor} is not eligible for single-swatch closest-color matching; patterns, gradients, multicolor/transparent choices, finishes, and materials remain unresolved.`,
      evidenceRequirement:
        "Requires a solid color option rather than pattern, transparency, finish, material, gradient, or multicolor evidence.",
    });
  }

  return null;
}

function evaluatePerceptualColorFallback(
  input: SelectedSourceMeasurementMatchInput
): SelectedSourceMeasurementMatchResult {
  const sourceInspection = inspectSelectedSourcePerceptualColorFact(
    input.source
  );
  const targetInspection = inspectSelectedSourcePerceptualColorFact(
    input.target
  );
  if (!sourceInspection.eligible || !targetInspection.eligible) {
    // The supplier's shade has no swatch at all: its name places it in a
    // family, so it can still stand in for a pick that has one.
    if (sourceInspection.eligible && !targetInspection.eligible) {
      const named = evaluateNamedColorFamily({
        sourceSwatch: sourceInspection.swatch,
        target: input.target,
      });
      if (named) return named;
    }
    return result({
      classification: "normalization-needed",
      policyId: "color-option-kind-owner",
      canonicalValueModel: "provenance-backed solid sRGB color swatch",
      equivalenceBasis: "normalization-needed",
      disclosure: `closest-color matching is withheld because one or both color facts lack eligible swatch evidence (${sourceInspection.reason}/${targetInspection.reason}).`,
      evidenceRequirement:
        "Requires normalizationStatus=exact plus non-empty source/evidencePath and a valid six-digit colorMeta.hex on both facts, or a swatch-less true color whose name places it in the picked swatch's family.",
    });
  }
  const sourceSwatch = sourceInspection.swatch;
  const targetSwatch = targetInspection.swatch;

  const fallbackDistance = srgbHexOklabDelta(
    sourceSwatch.hex,
    targetSwatch.hex
  );
  if (fallbackDistance === null) {
    return result({
      classification: "normalization-needed",
      policyId: "color-option-kind-owner",
      canonicalValueModel: "provenance-backed solid sRGB color swatch",
      equivalenceBasis: "normalization-needed",
      disclosure:
        "closest-color matching is withheld because one or both sRGB swatches could not be converted to OKLab.",
      evidenceRequirement:
        "Requires valid six-digit sRGB colorMeta.hex evidence on both color facts.",
    });
  }

  // Only a shade of the same family stands in, however near another
  // family's shade is.
  return (
    evaluateSameColorFamily({ sourceSwatch, targetSwatch, fallbackDistance }) ??
    outsideColorFamilyResult()
  );
}

function outsideColorFamilyResult(): SelectedSourceMeasurementMatchResult {
  return result({
    classification: "not-comparable",
    policyId: "color-option-kind-owner",
    canonicalValueModel: "color family and texture of a solid sRGB swatch",
    equivalenceBasis: "advisory-only",
    disclosure:
      "the supplier's nearest shade belongs to another color family, or to another look beyond the reviewed closest-color boundary, so the option remains unresolved rather than being presented as a substitute.",
    evidenceRequirement:
      "Requires the same color family on both shades, and an interchangeable texture (solid or heather) unless the shades are within the reviewed closest-color boundary.",
  });
}

/**
 * The family and look of a supplier's swatch, as closest-color matching
 * sees it. Picker evidence stores the same family so a read can skip shades
 * that can never stand in.
 */
export function classifySelectedSourceColorSwatch(
  swatch: Pick<SelectedSourceColorSwatch, "label" | "hex">
): PickerColorClass {
  return classifyPickerColor({ label: swatch.label, hexes: [swatch.hex] });
}

/**
 * Whether a target's color could ever compare with the requested one: the
 * same color, no color choice, a no-blank option, or a shade of the requested
 * swatch's family. Picker evidence reads load only these shades for a
 * supplier without the requested color, so every read ranks the same
 * candidates when a supplier has no match.
 */
export function canSelectedSourceColorMatch(input: {
  source: MatchFact | null;
  target: MatchFact | null;
}): boolean {
  const sourceValue = input.source?.normalizedValue ?? null;
  const targetValue = input.target?.normalizedValue ?? null;
  if (!sourceValue || !targetValue || sourceValue === targetValue) return true;
  if (
    readColorMeta(input.source)?.kind === NO_BLANK_COLOR_OPTION_KIND ||
    readColorMeta(input.target)?.kind === NO_BLANK_COLOR_OPTION_KIND
  ) {
    return true;
  }
  const source = inspectSelectedSourcePerceptualColorFact(input.source);
  const target = inspectSelectedSourcePerceptualColorFact(input.target);
  if (source.eligible && !target.eligible) {
    const named = inspectSelectedSourceNamedColorFact(input.target);
    return (
      named.eligible && namedColorFamilyOf(source.swatch, named.shade) !== null
    );
  }
  if (!source.eligible || !target.eligible) return false;
  const family = classifySelectedSourceColorSwatch(source.swatch).family;
  return (
    family !== null &&
    family === classifySelectedSourceColorSwatch(target.swatch).family
  );
}

/**
 * A shade of the same family and look (solid for solid, heather for heather)
 * stands in for a requested shade the supplier doesn't sell, at any distance.
 */
function evaluateSameColorFamily(input: {
  sourceSwatch: SelectedSourceColorSwatch;
  targetSwatch: SelectedSourceColorSwatch;
  fallbackDistance: number;
}): SelectedSourceMeasurementMatchResult | null {
  const source = classifySelectedSourceColorSwatch(input.sourceSwatch);
  const target = classifySelectedSourceColorSwatch(input.targetSwatch);
  if (
    !source.family ||
    source.family === "multicolor" ||
    source.family !== target.family
  ) {
    return null;
  }
  const sameLook =
    source.texture === target.texture &&
    INTERCHANGEABLE_PICKER_COLOR_TEXTURES.has(source.texture);
  // Another look of the family stands in only where it reads as the same
  // shade (Cool Blue → Heather Cool Blue), and after every same-look shade.
  if (
    !sameLook &&
    input.fallbackDistance > MAX_SELECTED_SOURCE_COLOR_DELTA_E_OK
  ) {
    return null;
  }
  return result({
    classification: "fallback",
    policyId: "color-option-kind-owner",
    canonicalValueModel: "provenance-backed solid sRGB swatch in OKLab",
    equivalenceBasis: "advisory-only",
    fallbackDistance: input.fallbackDistance,
    fallbackFactor: {
      kind: "perceptual-color",
      unit: "delta-e-ok",
      value: input.fallbackDistance,
      maximum: sameLook ? null : MAX_SELECTED_SOURCE_COLOR_DELTA_E_OK,
      colorFamily: source.family,
      requested: input.sourceSwatch,
      offered: input.targetSwatch,
    },
    disclosure: `${input.targetSwatch.label} is this supplier's ${source.family} nearest to requested ${input.sourceSwatch.label}; the requested and offered swatches remain visibly disclosed.`,
    evidenceRequirement:
      "Requires the same known color owner, exact provenance-backed sRGB swatches, and the same color family; another texture only within the reviewed closest-color boundary.",
  });
}

/**
 * A swatch-less shade of the picked family stands in for the pick, named in
 * words. It has no distance, so it ranks after every shade that has a swatch.
 * Null leaves the fact withheld exactly as before.
 */
function evaluateNamedColorFamily(input: {
  sourceSwatch: SelectedSourceColorSwatch;
  target: SelectedSourceMeasurementMatchInput["target"];
}): SelectedSourceMeasurementMatchResult | null {
  const named = inspectSelectedSourceNamedColorFact(input.target);
  if (!named.eligible) return null;
  const colorFamily = namedColorFamilyOf(input.sourceSwatch, named.shade);
  if (!colorFamily) return null;
  return result({
    classification: "fallback",
    policyId: "color-option-kind-owner",
    canonicalValueModel: "color family of a swatch-less true color name",
    equivalenceBasis: "advisory-only",
    fallbackFactor: {
      kind: "color-family-name",
      unit: "family",
      colorFamily,
      requested: input.sourceSwatch,
      offered: named.shade,
    },
    disclosure: `${named.shade.label} is this supplier's ${colorFamily} for requested ${input.sourceSwatch.label}; the supplier publishes no swatch for it, so the match rests on the shade's name.`,
    evidenceRequirement:
      "Requires the same known color owner, a swatch-less solid true color whose name places it in the picked swatch's family and look, and a provenance-backed swatch on the requested shade. Never a borrowed hex.",
  });
}

function evaluateColor(input: SelectedSourceMeasurementMatchInput): SelectedSourceMeasurementMatchResult {
  const conflict = structuredConflictReason(input.source ?? null, input.target ?? null);
  if (conflict) return colorConflictResult(conflict);

  const sourceMeta = readColorMeta(input.source ?? null);
  const targetMeta = readColorMeta(input.target ?? null);
  const noBlankResult = evaluateNoBlankColorOption(sourceMeta, targetMeta);
  if (noBlankResult) return noBlankResult;

  if (isStructuredApparelPickerCategory(input.categorySlug)) {
    const apparelResult = evaluateApparelGarmentColorOwners(sourceMeta, targetMeta);
    if (apparelResult) return apparelResult;
  }

  const nonColorKind = [sourceMeta?.kind, targetMeta?.kind].find(
    kind => kind && kind !== "color",
  );
  if (nonColorKind) return nonColorKindResult(nonColorKind);

  if (!sourceMeta || !targetMeta) return missingColorMetaResult();

  const ownerResult = evaluateColorOwnerIssue(sourceMeta.owner, targetMeta.owner);
  if (ownerResult) return ownerResult;

  // Exact normalized tokens remain authoritative. Perceptual-only safety gates
  // must not reinterpret or reject a supplier/canonical alias that has already
  // been resolved upstream.
  const sameNormalizedColor =
    normalizedValue(input.source) &&
    normalizedValue(input.source) === normalizedValue(input.target);
  if (sameNormalizedColor) return colorExactResult();

  const descriptorResult = evaluateColorDescriptorEligibility(
    input,
    sourceMeta,
    targetMeta
  );
  if (descriptorResult) return descriptorResult;

  return evaluatePerceptualColorFallback(input);
}

function result(input: {
  classification: SelectedSourceMeasurementClassification;
  policyId: string;
  canonicalValueModel: string;
  equivalenceBasis: string | null;
  disclosure: string;
  evidenceRequirement: string;
  fallbackDistance?: number | null;
  fallbackFactor?: SelectedSourceVariantFallbackFactor | null;
}): SelectedSourceMeasurementMatchResult {
  return {
    classification: input.classification,
    policyId: input.policyId,
    policyVersion: SELECTED_SOURCE_MEASUREMENT_POLICY_VERSION,
    canonicalValueModel: input.canonicalValueModel,
    equivalenceBasis: input.equivalenceBasis,
    fallbackDistance: input.fallbackDistance ?? null,
    fallbackFactor: input.fallbackFactor ?? null,
    evidenceRequirement: input.evidenceRequirement,
    disclosureReason: input.disclosure,
    disclosureReasons: [input.disclosure],
  };
}

function policyForField(field: string): string {
  if (field === "size") return "wall-art-2d-size";
  if (field === "capacity") return "drinkware-capacity-as-size";
  if (field === "quantity" || field === "pagecount") return "ordered-quantity-and-page-count";
  if (field === "color") return "color-option-kind-owner";
  if (["substrateweightgsm", "canvasthicknesstype", "thicknessmm", "depthmm"].includes(field)) return "quality-and-thickness-no-nearest";
  if (["devicefit", "casetype"].includes(field)) return "device-fit-compatibility";
  return "categorical-selected-source-context";
}

function blockingNormalizationReason(
  source: MatchFact | null,
  target: MatchFact | null,
  inspectionCache?: MatchFactInspectionCache,
): string | null {
  const conflict = structuredConflictReason(source, target, inspectionCache);
  if (conflict) return conflict;

  for (const [side, fact] of [
    ["source", source],
    ["target", target],
  ] as const) {
    if (!fact) continue;
    if (fact.state === "unnormalized" || fact.normalizationStatus === "unknown") {
      return `${side} VariantProfileValue is unnormalized or missing normalizedValue; normalization-needed/not-comparable before matching.`;
    }
  }
  return null;
}

function hasUsableNormalizedValue(fact: MatchFact | null | undefined): boolean {
  return typeof fact?.normalizedValue === "string" && fact.normalizedValue.trim().length > 0;
}

function absentStateReason(
  source: MatchFact | null,
  target: MatchFact | null,
  inspectionCache?: MatchFactInspectionCache,
): string | null {
  for (const [side, fact] of [
    ["source", source],
    ["target", target],
  ] as const) {
    if (!fact) continue;
    const inspection = inspectMatchFact(fact, inspectionCache);
    if (
      inspection.stateKey === "absent" ||
      inspection.normalizationStatusKey === "absent"
    ) {
      return `${side} VariantProfileValue is documented absent; absent facts remain not-comparable and must not be defaulted, exact-matched, or treated as equivalent even if a stale normalizedValue is present.`;
    }
  }
  return null;
}

function structuredConflictReason(
  source: MatchFact | null,
  target: MatchFact | null,
  inspectionCache?: MatchFactInspectionCache,
): string | null {
  for (const [side, fact] of [
    ["source", source],
    ["target", target],
  ] as const) {
    if (!fact) continue;
    const inspection = inspectMatchFact(fact, inspectionCache);
    if (
      inspection.normalizationStatusKey === "conflict" ||
      inspection.stateKey === "conflict"
    ) {
      return `${side} VariantProfileValue normalizationStatus=conflict requires normalization-needed/not-comparable before matching, even when valueJson lacks a conflict string or normalizedValue tokens are equal.`;
    }
    if (inspection.stableValueJsonText.includes("conflict")) {
      return `${side} structured VariantProfileValue.valueJson conflict requires normalization-needed/not-comparable before matching.`;
    }
  }
  return null;
}

function isSourceLocalFact(
  fact: MatchFact | null,
  inspectionCache?: MatchFactInspectionCache,
): boolean {
  return fact
    ? inspectMatchFact(fact, inspectionCache).isSourceLocal
    : false;
}

function isWallArtSize(
  categorySlug: string,
  source: MatchFact | null,
  target: MatchFact | null,
): boolean {
  return WALL_ART_CATEGORY_TERMS.some(term => categorySlug.includes(term)) ||
    normalizedValue(source)?.startsWith("wall-art:") === true ||
    normalizedValue(target)?.startsWith("wall-art:") === true;
}

function isApparelOrFootwear(
  categorySlug: string,
  source: MatchFact | null,
  target: MatchFact | null,
): boolean {
  return APPAREL_CATEGORY_TERMS.some(term => categorySlug.includes(term)) ||
    normalizedValue(source)?.startsWith("apparel:") === true ||
    normalizedValue(target)?.startsWith("apparel:") === true ||
    normalizedValue(source)?.startsWith("footwear:") === true ||
    normalizedValue(target)?.startsWith("footwear:") === true;
}

function isCapacityLike(
  categorySlug: string,
  source: MatchFact | null,
  target: MatchFact | null,
  inspectionCache?: MatchFactInspectionCache,
): boolean {
  return categorySlug.includes("mug") ||
    categorySlug.includes("bottle") ||
    categorySlug.includes("drinkware") ||
    normalizedValue(source)?.startsWith("capacity:") === true ||
    normalizedValue(target)?.startsWith("capacity:") === true ||
    readCapacityMl(source, inspectionCache) !== null ||
    readCapacityMl(target, inspectionCache) !== null;
}

function isProtectedPaperComparison(
  source: MatchFact | null,
  target: MatchFact | null,
  inspectionCache?: MatchFactInspectionCache,
): boolean {
  return Boolean(
    readStandard(source, inspectionCache) ||
      readStandard(target, inspectionCache)
  );
}

function readDimensions(
  fact: MatchFact | null,
  inspectionCache?: MatchFactInspectionCache,
): { widthMm: number; heightMm: number; orientation?: string } | null {
  if (!fact) return null;
  if (inspectionCache) {
    return inspectMatchFact(fact, inspectionCache).dimensions;
  }
  return readDimensionsUncached(fact);
}

function readDimensionsUncached(fact: MatchFact): {
  widthMm: number;
  heightMm: number;
  orientation?: string;
} | null {
  const value = readRecord(fact?.valueJson);
  const widthMm = readNumberValue(value?.widthMm);
  const heightMm = readNumberValue(value?.heightMm);
  if (widthMm === null || heightMm === null) return null;
  const rawOrientation = value?.orientation;
  return {
    widthMm,
    heightMm,
    orientation: readTextValue(rawOrientation) ?? undefined,
  };
}

function isTransposed(
  source: { widthMm: number; heightMm: number },
  target: { widthMm: number; heightMm: number },
): boolean {
  return approximatelyEqual(source.widthMm, target.heightMm) && approximatelyEqual(source.heightMm, target.widthMm);
}

function orientation(value: { widthMm: number; heightMm: number; orientation?: string }): string {
  if (value.orientation) return value.orientation;
  if (approximatelyEqual(value.widthMm, value.heightMm)) return "square";
  return value.widthMm > value.heightMm ? "landscape" : "portrait";
}

function readCapacityMl(
  fact: MatchFact | null,
  inspectionCache?: MatchFactInspectionCache,
): number | null {
  if (!fact) return null;
  if (inspectionCache) {
    return inspectMatchFact(fact, inspectionCache).capacityMl;
  }
  return readCapacityMlUncached(fact);
}

function readCapacityMlUncached(fact: MatchFact): number | null {
  const value = readRecord(fact?.valueJson);
  const ml = readNumberValue(value?.ml);
  if (ml !== null) return ml;
  const liter = readNumberValue(value?.liter ?? value?.liters ?? value?.l);
  if (liter !== null) return liter * 1000;
  const oz = readNumberValue(value?.oz);
  if (oz !== null) return oz * COARSE_ML_PER_US_FLUID_OUNCE;
  return null;
}

function capacityInternalConflictReason(fact: MatchFact | null): string | null {
  if (isReviewedCapacitySupplierPair(fact)) return null;
  const value = readRecord(fact?.valueJson);
  const ml = readNumberValue(value?.ml);
  const oz = readNumberValue(value?.oz);
  if (ml !== null && oz !== null && Math.abs(ml - oz * COARSE_ML_PER_US_FLUID_OUNCE) > 15) {
    return "capacity has an internal ml/oz pair conflict beyond reviewed tolerance; resolve valueJson unit evidence before reviewed alias equivalence or fallback.";
  }
  return null;
}

function isReviewedCapacitySupplierPair(fact: MatchFact | null): boolean {
  const value = readRecord(fact?.valueJson);
  const reviewedBucket = readTextValue(value?.reviewedBucket);
  return Boolean(
    value?.equivalenceBasis === "supplier-declared-pair" &&
      readTextValue(value?.reviewedCaseId) &&
      reviewedBucket &&
      reviewedBucket === normalizedValue(fact),
  );
}

function readCount(fact: MatchFact | null): { count: number; unitKind: string | null } | null {
  const value = readRecord(fact?.valueJson);
  const count = readNumberValue(value?.count ?? fact?.numericValue);
  if (count === null) return null;
  const rawKind = value?.unitKind ?? value?.countUnit ?? value?.quantityKind;
  const unitKind = readTextValue(rawKind);
  return {
    count,
    unitKind: unitKind ? unitKind.toLowerCase() : null,
  };
}

function orderedCountInternalConflictReason(fact: MatchFact | null): string | null {
  const value = readRecord(fact?.valueJson);
  const valueJsonCount = readNumberValue(value?.count);
  const numericCount = readNumberValue(fact?.numericValue);
  if (valueJsonCount !== null && numericCount !== null && !approximatelyEqual(valueJsonCount, numericCount)) {
    return "ordered quantity/page-count has internal valueJson.count versus numericValue conflict; resolve the structured count evidence before exact or nearest fallback matching.";
  }
  return null;
}

function readApparelOrFootwearSize(fact: MatchFact | null): { system: string; token: string } | null {
  const value = readRecord(fact?.valueJson);
  const system = readTextValue(value?.system ?? value?.sizeSystem);
  const token = readTextValue(value?.token ?? value?.sizeToken);
  if (!system || !token) return null;
  return { system, token };
}

const QUALITY_METRIC_VALUE_KEYS = new Map<string, readonly string[]>([
  ["substrateweightgsm", ["gsm", "substrateWeightGsm", "weightGsm"]],
  ["thicknessmm", ["thicknessMm", "mm", "thickness"]],
  ["depthmm", ["depthMm", "mm", "depth"]],
  ["canvasthicknesstype", ["thicknessMm", "depthMm"]],
]);

function readQualityMetricValue(field: string, fact: MatchFact | null): number | null {
  const value = readRecord(fact?.valueJson);
  const keys = QUALITY_METRIC_VALUE_KEYS.get(field);
  if (keys) {
    for (const key of keys) {
      const metric = readNumberValue(value?.[key]);
      if (metric !== null) return metric;
    }
  }
  return readNumberValue(fact?.numericValue);
}

function qualityMetricInternalConflictReason(field: string, fact: MatchFact | null): string | null {
  const structured = readQualityMetricStructuredValue(field, fact);
  const numeric = readNumberValue(fact?.numericValue);
  if (structured !== null && numeric !== null && !approximatelyEqual(structured, numeric)) {
    return "GSM/stock-weight/thickness valueJson field-specific numeric evidence conflicts with numericValue; resolve the internal valueJson/numericValue mismatch before exact-only quality matching.";
  }
  return null;
}

function readQualityMetricStructuredValue(field: string, fact: MatchFact | null): number | null {
  const value = readRecord(fact?.valueJson);
  const keys = QUALITY_METRIC_VALUE_KEYS.get(field);
  if (!keys) return null;
  for (const key of keys) {
    const metric = readNumberValue(value?.[key]);
    if (metric !== null) return metric;
  }
  return null;
}

const DEVICE_COMPATIBILITY_IDENTITY_GROUPS = [
  {
    valueKeys: ["brand", "manufacturer"],
    compatibilityKeys: ["brand", "manufacturer"],
  },
  {
    valueKeys: ["model", "deviceModel", "device"],
    compatibilityKeys: ["model", "deviceModel"],
  },
  {
    valueKeys: ["system", "platform"],
    compatibilityKeys: ["system", "platform"],
  },
  {
    valueKeys: ["generation", "family"],
    compatibilityKeys: ["generation", "family"],
  },
] as const satisfies readonly {
  valueKeys: readonly string[];
  compatibilityKeys: readonly string[];
}[];

function readCompatibilityIdentityGroup(
  value: Record<string, unknown> | null,
  compatibility: Record<string, unknown> | null,
  group: (typeof DEVICE_COMPATIBILITY_IDENTITY_GROUPS)[number]
): string | null {
  for (const key of group.valueKeys) {
    const part = readTextValue(value?.[key]);
    if (part) return part;
  }
  for (const key of group.compatibilityKeys) {
    const part = readTextValue(compatibility?.[key]);
    if (part) return part;
  }
  return null;
}

function readDeviceCompatibilityIdentity(fact: MatchFact | null): string | null {
  const value = readRecord(fact?.valueJson);
  const compatibility = readRecord(value?.compatibility);
  const parts = DEVICE_COMPATIBILITY_IDENTITY_GROUPS.map(group =>
    readCompatibilityIdentityGroup(value, compatibility, group)
  )
    .filter((part): part is string => Boolean(part))
    .map(normalizeKey);
  return parts.length > 0 ? parts.join(":") : null;
}

function readStandard(
  fact: MatchFact | null,
  inspectionCache?: MatchFactInspectionCache,
): string | null {
  if (!fact) return null;
  if (inspectionCache) {
    return inspectMatchFact(fact, inspectionCache).standard;
  }
  return readStandardUncached(fact);
}

function readStandardUncached(fact: MatchFact): string | null {
  const value = readRecord(fact?.valueJson);
  const standard = readTextValue(value?.standard);
  if (standard) return standard.toLowerCase();
  const normalized = normalizedValue(fact);
  if (!normalized) return null;
  for (const token of ["a4", "a5", "letter", "legal", "tabloid", "ledger"]) {
    if (normalized.toLowerCase().includes(`paper:${token}`)) return token;
  }
  return null;
}

type StructuredColorMeta = {
  kind?: string;
  owner?: string;
  raw?: string;
  displayColor?: string;
  hex?: string;
  swatchHexes: string[];
  /** A supplier's option-bound swatch image: a textured chip, not a solid color. */
  hasSwatchImage: boolean;
};

const UNSUPPORTED_PERCEPTUAL_COLOR_DESCRIPTOR =
  /\b(?:clear|transparent|translucent|gradient|multi[\s-]?colou?rs?(?:ed)?|rainbow|camo(?:uflage)?|tie[\s-]?dye|marble|glitter|holographic|iridescent|pattern(?:ed)?|stripe(?:d)?|speckle(?:d)?|ombr[eé]|two[\s-]?tone|metallic|chrome|brushed|matte|gloss(?:y)?|satin|wood(?:en)?|wood[\s-]?grain|oak|walnut|maple|birch|mahogany|beech|steel|alumini?um|acrylic|glass|ceramic|bamboo|cork|leather)\b/i;

const COMPOSITE_PERCEPTUAL_COLOR_DESCRIPTOR =
  /\b(?:multi[\s-]?colou?rs?(?:ed)?|rainbow|camo(?:uflage)?|tie[\s-]?dye|marble|pattern(?:ed)?|stripe(?:d)?|speckle(?:d)?|ombr[eé]|two[\s-]?tone)\b/i;

const TRANSPARENT_PERCEPTUAL_COLOR_DESCRIPTOR =
  /\b(?:clear|transparent|translucent)\b/i;

function readColorMeta(fact: MatchFact | null): StructuredColorMeta | null {
  const value = readRecord(fact?.valueJson);
  const colorMeta = readRecord(value?.colorMeta);
  if (!colorMeta) return null;
  return {
    kind: readTextValue(colorMeta.kind) ?? undefined,
    owner: readTextValue(colorMeta.owner) ?? undefined,
    raw: readTextValue(colorMeta.raw) ?? undefined,
    displayColor: readTextValue(colorMeta.displayColor) ?? undefined,
    hex: readTextValue(colorMeta.hex) ?? undefined,
    swatchHexes: readColorSwatchHexes(colorMeta.swatchHexes),
    hasSwatchImage: readRecord(colorMeta.swatchImage) !== null,
  };
}

function unsupportedPerceptualColorDescriptor(
  fact: MatchFact | null,
  meta: StructuredColorMeta
): string | null {
  const label =
    readTextValue(meta.displayColor) ??
    readTextValue(meta.raw) ??
    normalizedValue(fact) ??
    "color option";
  const evidence = [meta.displayColor, meta.raw, normalizedValue(fact)]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" ");
  return meta.swatchHexes.length > 1 ||
    UNSUPPORTED_PERCEPTUAL_COLOR_DESCRIPTOR.test(evidence) ||
    /[/+&]/.test(evidence)
    ? `Color option ${label}`
    : null;
}

function compositePerceptualColorDescriptor(
  fact: MatchFact | null,
  meta: StructuredColorMeta
): string | null {
  const label =
    readTextValue(meta.displayColor) ??
    readTextValue(meta.raw) ??
    normalizedValue(fact) ??
    "color option";
  const evidence = [meta.displayColor, meta.raw, normalizedValue(fact)]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" ");
  return meta.swatchHexes.length > 1 ||
    COMPOSITE_PERCEPTUAL_COLOR_DESCRIPTOR.test(evidence) ||
    /[/+&]/.test(evidence)
    ? `Color option ${label}`
    : null;
}

function transparentPerceptualColorDescriptor(
  fact: MatchFact | null,
  meta: StructuredColorMeta
): string | null {
  const label =
    readTextValue(meta.displayColor) ??
    readTextValue(meta.raw) ??
    normalizedValue(fact) ??
    "color option";
  const evidence = [meta.displayColor, meta.raw, normalizedValue(fact)]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" ");
  return TRANSPARENT_PERCEPTUAL_COLOR_DESCRIPTOR.test(evidence)
    ? `Color option ${label}`
    : null;
}

function isKnownColorOwner(
  owner: string | undefined
): owner is SelectedSourceColorSwatch["owner"] {
  return (
    owner === "base-product" ||
    owner === "frame-or-hardware" ||
    owner === "print-substrate"
  );
}

function withheldColorFact(
  reason: SelectedSourcePerceptualColorWithholdReason
): SelectedSourcePerceptualColorFactInspection {
  return { eligible: false, reason, swatch: null };
}

function isColorMeasurement(
  field: string,
  source: MatchFact | null,
  target: MatchFact | null,
  inspectionCache?: MatchFactInspectionCache,
): boolean {
  return (
    field === "color" ||
    hasColorMeta(source, inspectionCache) ||
    hasColorMeta(target, inspectionCache)
  );
}

function hasColorMeta(
  fact: MatchFact | null,
  inspectionCache?: MatchFactInspectionCache,
): boolean {
  if (!fact) return false;
  if (inspectionCache) {
    return inspectMatchFact(fact, inspectionCache).hasColorMeta;
  }
  return hasColorMetaUncached(fact);
}

function hasColorMetaUncached(fact: MatchFact): boolean {
  return Boolean(readRecord(readRecord(fact.valueJson)?.colorMeta));
}

function inspectMatchFact(
  fact: MatchFact,
  inspectionCache?: MatchFactInspectionCache,
): MatchFactInspection {
  const cached = inspectionCache?.get(fact);
  if (cached) return cached;

  const value = normalizedValue(fact) ?? "";
  const field = normalizeKey(fact.field);
  const originScope = normalizeKey(fact.originScope);
  const inspection: MatchFactInspection = {
    capacityMl: readCapacityMlUncached(fact),
    dimensions: readDimensionsUncached(fact),
    hasColorMeta: hasColorMetaUncached(fact),
    isSourceLocal:
      value.startsWith("source-local:") ||
      ALWAYS_SOURCE_LOCAL_FACT_FIELDS.has(field) ||
      originScope === "sourcelocal" ||
      originScope === "metadata",
    normalizationStatusKey: normalizeKey(fact.normalizationStatus),
    stableValueJsonText: readStableText(fact.valueJson),
    standard: readStandardUncached(fact),
    stateKey: normalizeKey(fact.state),
  };
  inspectionCache?.set(fact, inspection);
  return inspection;
}

function normalizedValue(fact: MatchFact | null | undefined): string | null {
  return typeof fact?.normalizedValue === "string" ? fact.normalizedValue : null;
}

function normalizeField(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeKey(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return readUnknownRecord(value);
}

function isSelectedSourceTextSeed(value: unknown): value is string {
  return typeof value === "string";
}

function isSelectedSourceNumberSeed(value: unknown): value is number | string {
  return typeof value === "number" || typeof value === "string";
}

function readTextValue(value: unknown): string | null {
  if (!isSelectedSourceTextSeed(value)) return null;
  const text: string = value;
  return text.trim() ? text : null;
}

function readNumberValue(value: unknown): number | null {
  if (!isSelectedSourceNumberSeed(value)) return null;
  const seed: number | string = value;
  if (typeof seed === "number") return Number.isFinite(seed) ? seed : null;
  if (!seed.trim()) return null;
  const numeric = Number(seed);
  return Number.isFinite(numeric) ? numeric : null;
}

function approximatelyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) <= 0.5;
}

function readStableText(value: unknown): string {
  return JSON.stringify(value ?? "").toLowerCase();
}
