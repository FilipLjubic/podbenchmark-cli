import { normalizeMaterialToken } from "../sizing/material-token";
import { readUnknownRecord } from "../schemas/record";
import {
  JsonValueSchema,
  type JsonTraversalValue,
} from "../schemas/json.ts";

import {
  productSpecsSchema,
  type ProductSpecs,
} from "../schemas/product-data";
import { resolveSelectedProfileFact } from "./selected-profile-facts";
import {
  componentFactKey,
  findCompatibleComponentFact,
  getComponentFacts,
  isKnownComponentRole,
} from "../catalog/component-specs";
import type { SelectedSourceVariantProfileFact } from "./selected-source-variant-matching";
import type {
  ComponentFactField,
  ComponentRole,
} from "../schemas/product-data";
import { getProfileFactCardinalityPolicy } from "./profile-fact-cardinality";
import {
  PRINT_DECORATION_FACT_FIELD,
  printDecorationSurfaceForCategory,
} from "../catalog/print-decoration";

export const OFFER_SEMANTIC_BANDS = [
  "canonical-fit",
  "compatible-fit",
  "fallback-fit",
  "reject",
] as const;

export type OfferSemanticBand = (typeof OFFER_SEMANTIC_BANDS)[number];

type OfferSemanticEvidence =
  | "structured-complete"
  | "structured-partial"
  | "mapping-only";

export type OfferSemanticSourceKind =
  | "exact-mapping"
  | "closest-mapping"
  | "canonical-alternative";

export type OfferSemanticReason = {
  code:
    | "structured-specs-match"
    | "identity-alias-match"
    | "critical-field-mismatch"
    | "hard-field-mismatch"
    | "missing-product-critical-field"
    | "missing-selected-profile-critical-field"
    | "conflicting-selected-profile-critical-field"
    | "missing-canonical-critical-evidence"
    | "canonical-specs-invalid"
    | "product-specs-invalid"
    | "product-spec-type-unknown"
    | "runtime-semantic-policy-incomplete"
    | "canonical-alternative";
  field?: string;
  componentRole?: ComponentRole;
  canonicalValue?: string;
  productValue?: string;
};

export type OfferSemanticFitness = {
  band: OfferSemanticBand;
  evidence: OfferSemanticEvidence;
  sourceKind: OfferSemanticSourceKind;
  comparedFields: string[];
  missingFields: string[];
  mismatchedFields: string[];
  reasons: OfferSemanticReason[];
};

type SemanticFieldPolicy = {
  critical: readonly string[];
  hardGates: readonly string[];
  runtimeReady?: boolean;
};

const BASE_SEMANTIC_FIELD_POLICIES: Record<
  ProductSpecs["type"],
  SemanticFieldPolicy
> = {
  apparel: {
    critical: ["fabricBlendCategory", "fit"],
    hardGates: [],
  },
  drinkware: {
    critical: ["material", "shape", "capacity"],
    hardGates: ["shape"],
  },
  "wall-art": {
    critical: [],
    hardGates: [],
  },
  "home-decor": {
    critical: ["material", "fillIncluded"],
    hardGates: [],
  },
  accessories: {
    critical: ["material", "baseMetal", "plating"],
    hardGates: [],
  },
  stationery: {
    critical: ["material", "paperType", "paperWeightGsm"],
    hardGates: [],
  },
  "phone-cases": {
    critical: ["protection", "caseType", "material"],
    hardGates: [],
  },
  bags: {
    critical: ["material", "closure"],
    hardGates: [],
  },
  headwear: {
    critical: ["style", "structured"],
    hardGates: [],
  },
  "pet-products": {
    critical: ["material"],
    hardGates: [],
  },
  unknown: {
    critical: [],
    hardGates: [],
  },
};

/**
 * Returns only selected-profile fields that can affect this canonical's
 * semantic fitness. Product-invariant facts already arrive in Product.specs;
 * querying the global union for every category only retransmits unused facts.
 */
export function getOfferSemanticProfileFactFields(input: {
  canonicalSpecs: unknown;
  canonicalIdentity?: {
    audienceAgeGroup?: string | null;
    audienceGenderFit?: string | null;
  };
  /** Apparel offers also carry the print decoration they are ranked by. */
  categorySlug?: string | null;
}): string[] {
  const decorationFields = printDecorationSurfaceForCategory(input.categorySlug)
    ? [PRINT_DECORATION_FACT_FIELD]
    : [];
  const canonicalResult = productSpecsSchema.safeParse(input.canonicalSpecs);
  if (!canonicalResult.success) return decorationFields;

  const canonicalSpecs = canonicalResult.data;
  const policy = getSemanticFieldPolicy(canonicalSpecs);
  const candidates = [
    ...policy.critical.filter(
      field => readSpecField(canonicalSpecs, field) !== undefined,
    ),
    ...(canonicalAudienceConstraint("audienceAgeGroup", input.canonicalIdentity?.audienceAgeGroup)
      ? ["audienceAgeGroup"]
      : []),
    ...(canonicalAudienceConstraint("audienceGenderFit", input.canonicalIdentity?.audienceGenderFit)
      ? ["audienceGenderFit"]
      : []),
    ...decorationFields,
  ];

  return [...new Set(candidates)]
    .filter(
      field =>
        getProfileFactCardinalityPolicy(field).cardinality ===
        "profile-scoped",
    )
    .sort();
}

export function deriveOfferSemanticFitness(input: {
  canonicalSpecs: unknown;
  productSpecs: unknown;
  sourceKind: OfferSemanticSourceKind;
  canonicalIdentity?: {
    brand: string | null;
    model: string | null;
    aliases?: readonly string[];
    audienceAgeGroup?: string | null;
    audienceGenderFit?: string | null;
  };
  productName?: string | null;
  selectedProfileFacts?: readonly SelectedSourceVariantProfileFact[];
}): OfferSemanticFitness {
  const canonicalResult = productSpecsSchema.safeParse(input.canonicalSpecs);
  if (!canonicalResult.success) {
    return mappingOnlyFitness(input.sourceKind, "canonical-specs-invalid");
  }

  const productResult = productSpecsSchema.safeParse(input.productSpecs);
  if (!productResult.success) {
    return mappingOnlyFitness(input.sourceKind, "product-specs-invalid");
  }

  const canonicalSpecs = canonicalResult.data;
  const productSpecs = productResult.data;
  if (input.sourceKind === "canonical-alternative") {
    // The row belongs to a different canonical. Comparing its product specs
    // against the source canonical would turn intentional substitute
    // differences into false hard rejects. The CanonicalAlternative relation
    // remains the authority until the alternative canonical is loaded here.
    return {
      band: "fallback-fit",
      evidence: "mapping-only",
      sourceKind: input.sourceKind,
      comparedFields: [],
      missingFields: [],
      mismatchedFields: [],
      reasons: [{ code: "canonical-alternative" }],
    };
  }
  if (productSpecs.type === "unknown" && canonicalSpecs.type !== "unknown") {
    return {
      ...mappingOnlyFitness(input.sourceKind, "product-spec-type-unknown"),
      evidence: "structured-partial",
    };
  }

  if (canonicalSpecs.type !== productSpecs.type) {
    return {
      band: "reject",
      evidence: "structured-complete",
      sourceKind: input.sourceKind,
      comparedFields: ["type"],
      missingFields: [],
      mismatchedFields: ["type"],
      reasons: [
        {
          code: "hard-field-mismatch",
          field: "type",
          canonicalValue: canonicalSpecs.type,
          productValue: productSpecs.type,
        },
      ],
    };
  }

  const policy = getSemanticFieldPolicy(canonicalSpecs);
  const canonicalCriticalFields = policy.critical.filter(
    field => readSpecField(canonicalSpecs, field) !== undefined
  );
  const comparedFields: string[] = ["type"];
  const missingFields: string[] = [];
  const mismatchedFields: string[] = [];
  const reasons: OfferSemanticReason[] = [];
  let hasHardMismatch = false;

  const identityComparison = compareIdentitySemanticFields({
    canonicalIdentity: input.canonicalIdentity,
    productName: input.productName,
    selectedProfileFacts: input.selectedProfileFacts,
    sourceKind: input.sourceKind,
    productSpecs,
  });
  comparedFields.push(...identityComparison.comparedFields);
  missingFields.push(...identityComparison.missingFields);
  mismatchedFields.push(...identityComparison.mismatchedFields);
  reasons.push(...identityComparison.reasons);
  hasHardMismatch ||= identityComparison.hasHardMismatch;

  const criticalComparison = compareCriticalSemanticFields({
    canonicalSpecs,
    productSpecs,
    selectedProfileFacts: input.selectedProfileFacts,
    sourceKind: input.sourceKind,
    canonicalCriticalFields,
    policy,
  });
  comparedFields.push(...criticalComparison.comparedFields);
  missingFields.push(...criticalComparison.missingFields);
  mismatchedFields.push(...criticalComparison.mismatchedFields);
  reasons.push(...criticalComparison.reasons);
  hasHardMismatch ||= criticalComparison.hasHardMismatch;

  if (canonicalCriticalFields.length === 0) {
    reasons.push({ code: "missing-canonical-critical-evidence" });
  }

  const runtimePolicyReady = isRuntimeSemanticPolicyReady({
    type: canonicalSpecs.type,
    hasBrandedIdentity:
      Boolean(input.canonicalIdentity?.brand) &&
      Boolean(input.canonicalIdentity?.model),
    missingFields,
    mismatchedFields,
    fieldPolicyReady: policy.runtimeReady !== false,
  });
  if (!runtimePolicyReady) {
    reasons.push({ code: "runtime-semantic-policy-incomplete" });
  }

  if (hasHardMismatch) {
    return {
      band: "reject",
      evidence: "structured-complete",
      sourceKind: input.sourceKind,
      comparedFields,
      missingFields,
      mismatchedFields,
      reasons,
    };
  }

  const evidence =
    canonicalCriticalFields.length > 0 &&
    missingFields.length === 0 &&
    mismatchedFields.length === 0 &&
    runtimePolicyReady
      ? "structured-complete"
      : "structured-partial";
  const band = resolveStructuredBand({
    sourceKind: input.sourceKind,
  });

  if (mismatchedFields.length === 0) {
    reasons.push({ code: "structured-specs-match" });
  }

  return {
    band,
    evidence,
    sourceKind: input.sourceKind,
    comparedFields,
    missingFields,
    mismatchedFields,
    reasons,
  };
}

type SemanticComparisonOutcome = {
  comparedFields: string[];
  missingFields: string[];
  mismatchedFields: string[];
  reasons: OfferSemanticReason[];
  hasHardMismatch: boolean;
};

function createSemanticComparisonOutcome(): SemanticComparisonOutcome {
  return {
    comparedFields: [],
    missingFields: [],
    mismatchedFields: [],
    reasons: [],
    hasHardMismatch: false,
  };
}

type SemanticIdentityField = {
  field: string;
  value: string | null;
  resolved: ReturnType<typeof resolveSelectedSemanticField> | null;
  aliasMatch: boolean;
};

/** Canonical class scope is separate from equality between two selected profiles. */
function canonicalAudienceConstraint(field: "audienceAgeGroup" | "audienceGenderFit", value: string | null | undefined): string | null {
  if (!value || value === "not_applicable" || (field === "audienceAgeGroup" && value === "all_ages")) return null;
  return value;
}

function compareIdentityField(input: {
  identityField: SemanticIdentityField;
  productName: string | null | undefined;
  selectedProfileFacts: readonly SelectedSourceVariantProfileFact[] | undefined;
  sourceKind: OfferSemanticSourceKind;
  productSpecs: ProductSpecs;
  outcome: SemanticComparisonOutcome;
}): void {
  const { identityField, outcome } = input;
  if (!identityField.value) return;
  const resolved =
    identityField.resolved ??
    resolveSelectedSemanticField({
      field: identityField.field,
      productSpecs: input.productSpecs,
      selectedProfileFacts: input.selectedProfileFacts,
    });
  if (identityField.aliasMatch) {
    outcome.comparedFields.push(identityField.field);
    outcome.reasons.push({
      code: "identity-alias-match",
      field: identityField.field,
      canonicalValue: identityField.value,
      productValue:
        resolved.value === undefined
          ? input.productName ?? undefined
          : serializeSemanticValue(resolved.value),
    });
    return;
  }
  if (resolved.value === undefined) {
    outcome.missingFields.push(identityField.field);
    outcome.reasons.push({
      code: missingSemanticFieldReason(resolved.state),
      field: identityField.field,
      canonicalValue: identityField.value,
    });
    return;
  }
  outcome.comparedFields.push(identityField.field);
  if (
    identityValuesEqual(identityField.field, identityField.value, resolved.value)
  ) {
    return;
  }
  outcome.mismatchedFields.push(identityField.field);
  const hardIdentityMismatch =
    input.sourceKind === "exact-mapping" ||
    identityField.field === "audienceAgeGroup" ||
    identityField.field === "audienceGenderFit";
  outcome.hasHardMismatch ||= hardIdentityMismatch;
  outcome.reasons.push({
    code: hardIdentityMismatch
      ? "hard-field-mismatch"
      : "critical-field-mismatch",
    field: identityField.field,
    canonicalValue: identityField.value,
    productValue: serializeSemanticValue(resolved.value),
  });
}

function compareIdentitySemanticFields(input: {
  canonicalIdentity:
    | {
        brand: string | null;
        model: string | null;
        aliases?: readonly string[];
        audienceAgeGroup?: string | null;
        audienceGenderFit?: string | null;
      }
    | undefined;
  productName: string | null | undefined;
  selectedProfileFacts: readonly SelectedSourceVariantProfileFact[] | undefined;
  sourceKind: OfferSemanticSourceKind;
  productSpecs: ProductSpecs;
}): SemanticComparisonOutcome {
  const outcome = createSemanticComparisonOutcome();
  const resolvedBrand = resolveSelectedSemanticField({
    field: "brand",
    productSpecs: input.productSpecs,
    selectedProfileFacts: input.selectedProfileFacts,
  });
  const resolvedModel = resolveSelectedSemanticField({
    field: "model",
    productSpecs: input.productSpecs,
    selectedProfileFacts: input.selectedProfileFacts,
  });
  const canonicalAliases = input.canonicalIdentity?.aliases ?? [];
  const resolvedBrandValue = readSemanticText(resolvedBrand.value);
  const brandAliasMatch =
    resolvedBrandValue !== null &&
    canonicalIdentityAliasMatchesBrand(canonicalAliases, resolvedBrandValue);
  const modelAliasMatch =
    Boolean(input.canonicalIdentity?.model) &&
    canonicalIdentityAliasMatchesModel({
      aliases: canonicalAliases,
      productModel: readSemanticText(resolvedModel.value),
      productName: input.productName ?? null,
    });

  const identityFields: SemanticIdentityField[] = [
    {
      field: "brand",
      value: input.canonicalIdentity?.brand ?? null,
      resolved: resolvedBrand,
      aliasMatch: brandAliasMatch,
    },
    {
      field: "model",
      value: input.canonicalIdentity?.model ?? null,
      resolved: resolvedModel,
      aliasMatch: modelAliasMatch,
    },
    {
      field: "audienceAgeGroup",
      value: canonicalAudienceConstraint("audienceAgeGroup", input.canonicalIdentity?.audienceAgeGroup),
      resolved: null,
      aliasMatch: false,
    },
    {
      field: "audienceGenderFit",
      value: canonicalAudienceConstraint("audienceGenderFit", input.canonicalIdentity?.audienceGenderFit),
      resolved: null,
      aliasMatch: false,
    },
  ];
  for (const identityField of identityFields) {
    compareIdentityField({
      identityField,
      productName: input.productName,
      selectedProfileFacts: input.selectedProfileFacts,
      sourceKind: input.sourceKind,
      productSpecs: input.productSpecs,
      outcome,
    });
  }
  return outcome;
}

function compareCriticalSemanticFields(input: {
  canonicalSpecs: ProductSpecs;
  productSpecs: ProductSpecs;
  selectedProfileFacts: readonly SelectedSourceVariantProfileFact[] | undefined;
  sourceKind: OfferSemanticSourceKind;
  canonicalCriticalFields: readonly string[];
  policy: SemanticFieldPolicy;
}): SemanticComparisonOutcome {
  const outcome = createSemanticComparisonOutcome();
  for (const field of input.canonicalCriticalFields) {
    const scopedComparison = compareComponentScopedField({
      field,
      canonicalSpecs: input.canonicalSpecs,
      productSpecs: input.productSpecs,
      hardGate: input.policy.hardGates.includes(field),
    });
    if (scopedComparison.handled) {
      outcome.comparedFields.push(...scopedComparison.comparedFields);
      outcome.missingFields.push(...scopedComparison.missingFields);
      outcome.mismatchedFields.push(...scopedComparison.mismatchedFields);
      outcome.reasons.push(...scopedComparison.reasons);
      outcome.hasHardMismatch ||= scopedComparison.hasHardMismatch;
      continue;
    }

    const canonicalValue = readSpecField(input.canonicalSpecs, field);
    const resolved = resolveSelectedSemanticField({
      field,
      productSpecs: input.productSpecs,
      selectedProfileFacts: input.selectedProfileFacts,
    });
    if (resolved.value === undefined) {
      outcome.missingFields.push(field);
      outcome.reasons.push({
        code: missingSemanticFieldReason(resolved.state),
        field,
        canonicalValue: serializeSemanticValue(canonicalValue),
      });
      continue;
    }

    outcome.comparedFields.push(field);
    if (semanticValuesEqual(field, canonicalValue, resolved.value)) {
      continue;
    }

    outcome.mismatchedFields.push(field);
    const hardMismatch =
      input.policy.hardGates.includes(field) &&
      !(input.sourceKind === "closest-mapping" && field === "shape");
    outcome.hasHardMismatch ||= hardMismatch;
    outcome.reasons.push({
      code: hardMismatch
        ? "hard-field-mismatch"
        : "critical-field-mismatch",
      field,
      canonicalValue: serializeSemanticValue(canonicalValue),
      productValue: serializeSemanticValue(resolved.value),
    });
  }
  return outcome;
}

type ComponentFieldComparison = {
  handled: boolean;
  comparedFields: string[];
  missingFields: string[];
  mismatchedFields: string[];
  reasons: OfferSemanticReason[];
  hasHardMismatch: boolean;
};

function compareComponentScopedField(input: {
  field: string;
  canonicalSpecs: ProductSpecs;
  productSpecs: ProductSpecs;
  hardGate: boolean;
}): ComponentFieldComparison {
  const empty = (): ComponentFieldComparison => ({
    handled: false,
    comparedFields: [],
    missingFields: [],
    mismatchedFields: [],
    reasons: [],
    hasHardMismatch: false,
  });
  if (!isComponentFactField(input.field)) return empty();

  const canonicalFacts = getComponentFacts(input.canonicalSpecs, input.field)
    .filter((fact) => isKnownComponentRole(fact.componentRole));
  if (canonicalFacts.length === 0) return empty();

  const productFacts = getComponentFacts(input.productSpecs, input.field);
  const result = empty();
  result.handled = true;

  for (const canonicalFact of canonicalFacts) {
    const key = componentFactKey(canonicalFact);
    const productFact = findCompatibleComponentFact(
      productFacts,
      canonicalFact,
    );
    if (!productFact) {
      result.missingFields.push(key);
      result.reasons.push({
        code: "missing-product-critical-field",
        field: input.field,
        componentRole: canonicalFact.componentRole,
        canonicalValue: serializeSemanticValue(canonicalFact.value),
      });
      continue;
    }

    result.comparedFields.push(key);
    if (
      semanticValuesEqual(input.field, canonicalFact.value, productFact.value)
    ) {
      continue;
    }

    result.mismatchedFields.push(key);
    result.hasHardMismatch ||= input.hardGate;
    result.reasons.push({
      code: input.hardGate
        ? "hard-field-mismatch"
        : "critical-field-mismatch",
      field: input.field,
      componentRole: canonicalFact.componentRole,
      canonicalValue: serializeSemanticValue(canonicalFact.value),
      productValue: serializeSemanticValue(productFact.value),
    });
  }

  return result;
}

function isComponentFactField(field: string): field is ComponentFactField {
  return (
    field === "material" ||
    field === "construction" ||
    field === "finish" ||
    field === "thicknessMm" ||
    field === "weightGsm"
  );
}

function mappingOnlyFitness(
  sourceKind: OfferSemanticSourceKind,
  code: Extract<
    OfferSemanticReason["code"],
    | "canonical-specs-invalid"
    | "product-specs-invalid"
    | "product-spec-type-unknown"
  >
): OfferSemanticFitness {
  return {
    band:
      sourceKind === "exact-mapping"
        ? "canonical-fit"
        : sourceKind === "closest-mapping"
          ? "compatible-fit"
          : "fallback-fit",
    evidence: "mapping-only",
    sourceKind,
    comparedFields: [],
    missingFields: [],
    mismatchedFields: [],
    reasons: [{ code }],
  };
}

function resolveStructuredBand(input: {
  sourceKind: OfferSemanticSourceKind;
}): OfferSemanticBand {
  if (input.sourceKind === "canonical-alternative") {
    return "fallback-fit";
  }
  if (input.sourceKind === "exact-mapping") {
    // A non-gating mismatch may be a variant-sensitive product-level fact
    // (for example, a multi-capacity mug). Keep the reviewed identity band but
    // mark the evidence partial so the selector falls back to reviewed order.
    return "canonical-fit";
  }
  return "compatible-fit";
}

function getSemanticFieldPolicy(
  canonicalSpecs: ProductSpecs
): SemanticFieldPolicy {
  if (canonicalSpecs.type !== "wall-art") {
    return BASE_SEMANTIC_FIELD_POLICIES[canonicalSpecs.type];
  }

  const material = normalizeSemanticValue(
    "material",
    readSpecField(canonicalSpecs, "material")
  );
  if (material === "canvas") {
    return {
      // A stretched-canvas support frame is not the same concept as the
      // decorative frame used by poster products. Until those facts have
      // separate fields, comparing frameIncluded here creates false rejects.
      critical: [
        "material",
        "finish",
        "edgeTreatment",
        "archivalGrade",
        "wrapDepthMm",
      ],
      hardGates: ["material"],
      runtimeReady: false,
    };
  }

  return {
    critical: [
      "material",
      "frameIncluded",
      "paperClass",
      "finish",
      "archivalGrade",
      "substrateWeightGsm",
    ],
    hardGates: ["material", "frameIncluded"],
  };
}

function isSemanticText(value: unknown): value is string {
  return typeof value === "string";
}

function readSemanticText(value: unknown): string | null {
  if (!isSemanticText(value)) return null;
  const text: string = value;
  return text.trim() ? text : null;
}

/** Decode a fact or spec value into the JSON traversal contract. */
function readSemanticValue(value: unknown): JsonTraversalValue | undefined {
  if (value === undefined) return undefined;
  const parsed = JsonValueSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

function readSpecField(specs: ProductSpecs, field: string): JsonTraversalValue | undefined {
  return readSemanticValue(
    Object.entries(specs).find(([key]) => key === field)?.[1]
  );
}

function resolveSelectedSemanticField(input: {
  field: string;
  productSpecs: ProductSpecs;
  selectedProfileFacts: readonly SelectedSourceVariantProfileFact[] | undefined;
}): {
  value: JsonTraversalValue | undefined;
  state:
    | "resolved"
    | "product-invariant"
    | "missing"
    | "incomplete"
    | "conflicting";
} {
  const resolved = resolveSelectedProfileFact({
    field: input.field,
    productValue: readSpecField(input.productSpecs, input.field),
    facts: input.selectedProfileFacts,
  });
  return { value: readSemanticValue(resolved.value), state: resolved.state };
}

function missingSemanticFieldReason(
  state: ReturnType<typeof resolveSelectedSemanticField>["state"]
): Extract<
  OfferSemanticReason["code"],
  | "missing-product-critical-field"
  | "missing-selected-profile-critical-field"
  | "conflicting-selected-profile-critical-field"
> {
  if (state === "conflicting") {
    return "conflicting-selected-profile-critical-field";
  }
  if (state === "missing" || state === "incomplete") {
    return "missing-selected-profile-critical-field";
  }
  return "missing-product-critical-field";
}

function semanticValuesEqual(
  field: string,
  left: JsonTraversalValue | undefined,
  right: JsonTraversalValue | undefined
): boolean {
  const normalizedLeft = normalizeSemanticValue(field, left);
  const normalizedRight = normalizeSemanticValue(field, right);
  return normalizedLeft !== null && normalizedLeft === normalizedRight;
}

function soleToken(tokens: readonly string[]): string | null {
  return tokens.length === 1 ? (tokens[0] ?? null) : null;
}

function identityValuesEqual(
  field: string,
  left: JsonTraversalValue | undefined,
  right: JsonTraversalValue | undefined
): boolean {
  const leftText = readSemanticText(left);
  const rightText = readSemanticText(right);
  if (!leftText || !rightText) return false;
  const normalizedLeft = normalizeIdentityValue(field, leftText);
  const normalizedRight = normalizeIdentityValue(field, rightText);
  if (!normalizedLeft || !normalizedRight) return false;
  if (normalizedLeft === normalizedRight) return true;
  if (field === "brand") {
    const shorter =
      normalizedLeft.length <= normalizedRight.length
        ? normalizedLeft
        : normalizedRight;
    const longer = shorter === normalizedLeft ? normalizedRight : normalizedLeft;
    return shorter.length >= 6 && longer.startsWith(shorter);
  }
  if (field !== "model") return false;

  const shorter =
    normalizedLeft.length <= normalizedRight.length
      ? normalizedLeft
      : normalizedRight;
  const longer = shorter === normalizedLeft ? normalizedRight : normalizedLeft;
  if (
    shorter.length >= 3 &&
    longer.length - shorter.length <= 3 &&
    longer.endsWith(shorter)
  ) {
    return true;
  }

  const leftTokens = identityTokens(leftText);
  const rightTokens = identityTokens(rightText);
  const onlyLeftToken = soleToken(leftTokens);
  if (onlyLeftToken !== null) {
    const normalizedToken = normalizeIdentityValue("model", onlyLeftToken);
    return (
      normalizedToken.length >= 3 &&
      rightTokens.some(
        rightToken =>
          normalizeIdentityValue("model", rightToken) === normalizedToken
      )
    );
  }
  const onlyRightToken = soleToken(rightTokens);
  if (onlyRightToken !== null) {
    const normalizedToken = normalizeIdentityValue("model", onlyRightToken);
    return (
      normalizedToken.length >= 3 &&
      leftTokens.some(
        leftToken =>
          normalizeIdentityValue("model", leftToken) === normalizedToken
      )
    );
  }
  return false;
}

function normalizeIdentityValue(field: string, value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/\bcolou?rs?\b/g, "color")
    .replace(
      field === "brand"
        ? /\b(?:and|apparel|company|co)\b/g
        : /$^/,
      ""
    )
    .replace(/[^a-z0-9]/g, "");
  if (field === "brand" && normalized.endsWith("company")) {
    return normalized.slice(0, -"company".length);
  }
  return normalized;
}

function identityTokens(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function canonicalIdentityAliasMatchesBrand(
  aliases: readonly string[],
  productBrand: string
): boolean {
  const normalizedBrand = normalizeIdentityValue("brand", productBrand);
  if (normalizedBrand.length < 3) return false;

  return aliases.some(alias => {
    const normalizedAlias = normalizeIdentityValue("brand", alias);
    return (
      normalizedAlias === normalizedBrand ||
      normalizedAlias.startsWith(normalizedBrand)
    );
  });
}

function canonicalIdentityAliasMatchesModel(input: {
  aliases: readonly string[];
  productModel: string | null;
  productName: string | null;
}): boolean {
  const normalizedProductName = input.productName
    ? normalizeIdentityValue("model", input.productName)
    : null;

  return input.aliases.some(alias => {
    if (
      normalizedProductName &&
      normalizeIdentityValue("model", alias) === normalizedProductName
    ) {
      return true;
    }
    if (!input.productModel) return false;
    return identityTokens(alias).some(token =>
      identityValuesEqual("model", token, input.productModel)
    );
  });
}

export function parseCanonicalIdentityAliases(data: unknown): string[] {
  const record = readUnknownRecord(data);
  if (!record) return [];
  const aliases = record.aliases;
  if (!Array.isArray(aliases)) return [];

  const values = new Set<string>();
  for (const alias of aliases) {
    const text = readSemanticText(alias);
    if (text) values.add(text.trim());
  }
  return [...values];
}

function isRuntimeSemanticPolicyReady(input: {
  type: ProductSpecs["type"];
  hasBrandedIdentity: boolean;
  missingFields: readonly string[];
  mismatchedFields: readonly string[];
  fieldPolicyReady: boolean;
}): boolean {
  if (input.missingFields.length > 0 || input.mismatchedFields.length > 0) {
    return false;
  }
  if (input.hasBrandedIdentity) return true;
  if (!input.fieldPolicyReady) return false;
  return (
    input.type === "wall-art" ||
    input.type === "drinkware" ||
    input.type === "stationery"
  );
}

function normalizeSemanticValue(field: string, value: JsonTraversalValue | undefined): string | null {
  if (typeof value === "boolean" || typeof value === "number") {
    return String(value);
  }
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase().replace(/[_\s]+/g, "-");
  if (!normalized) return null;
  if (field === "capacity") {
    const capacity = normalized
      .replace(/^capacity:/, "")
      .match(/^(\d+(?:\.\d+)?)-?(oz|ml|l)$/);
    if (capacity) {
      return `capacity:${Number(capacity[1])}${capacity[2]}`;
    }
  }
  if (field === "material") {
    const material = normalizeMaterialToken(value);
    return material === "poster" ? "paper" : material;
  }
  if (field === "shape" && normalized === "cup") {
    return "mug";
  }
  return normalized;
}

function serializeSemanticValue(value: JsonTraversalValue | undefined): string | undefined {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    const serialized = String(value).trim();
    return serialized || undefined;
  }
  return undefined;
}
