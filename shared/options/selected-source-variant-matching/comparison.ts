import { isSupplierUnspecifiedColorIdentity } from "../../suppliers/supplier-color-identity";
import { readPickerValueFamily } from "../picker-value-families";
import { compareUtf8Bytes } from "../../kernel/canonical-order";
import { readUnknownRecord } from "../../schemas/record";
import { isNonBlankString, readNonBlankString } from "../../kernel/text";
import {
  createSelectedSourceMeasurementMatchEvaluator,
  evaluateSelectedSourceMeasurementMatch,
  wallArtNearestSize,
  type SelectedSourceMeasurementMatchEvaluator,
} from "../selected-source-measurement-policy";
import {
  isStructuredApparelPickerCategory,
  WALL_ART_PICKER_CATEGORIES,
} from "../variant-picker-policy";
import {
  isAbsentColorChoice,
  isTShirtPickerProfileEvidenceReady,
  isFixedSizeHeadwearPickerEvidenceReady,
  NO_BLANK_COLOR_OPTION_KIND,
  readValidatedSupplierProductSize,
  readValidatedSupplierUnspecifiedColor,
  readRecordConflictPresence,
  type VariantPickerProfileEvidence,
  type VariantPickerProfileOwner,
} from "../variant-picker-profile-evidence";
import {
  assertSelectedSourceVariantFactsSignatureValid,
  buildSelectedSourceVariantFactsSignature,
  createSelectedSourceFactSignatureCache,
  selectedSourceVariantFactSignature,
  factState,
  inferFactState,
  normalizeCanonicalJsonText,
  normalizedFactValue,
  normalizedNumericFactValue,
} from "./facts";
import type {
  SelectedSourceDistanceFallbackFactor,
  SelectedSourceVariantFactState,
  SelectedSourceVariantFallbackFactor,
  SelectedSourceVariantFallbackStrategy,
  SelectedSourceVariantFieldComparison,
  SelectedSourceVariantFieldComparisonState,
  SelectedSourceVariantFieldPolicy,
  SelectedSourceVariantMatchClassification,
  SelectedSourceVariantMatchingPolicy,
  SelectedSourceVariantProfileFact,
  SelectedSourceVariantProfileInput,
  SelectedSourceTargetVariantInput,
} from "./types";

export type SelectedSourceTargetVariantEvaluationInput = {
  sourceProfile: SelectedSourceVariantProfileInput;
  target: SelectedSourceTargetVariantInput;
  policy: SelectedSourceVariantMatchingPolicy;
};

export type SelectedSourceTargetVariantEvaluation = {
  classification: SelectedSourceVariantMatchClassification;
  fallbackDistance: number | null;
  matchedFields: string[];
  fieldComparisons: SelectedSourceVariantFieldComparison[];
  disclosureReasons: string[];
};

export type SelectedSourceTargetVariantEvaluator = ((
  input: SelectedSourceTargetVariantEvaluationInput
) => SelectedSourceTargetVariantEvaluation) & {
  /**
   * Present only for evaluators that can prove two fact snapshots are
   * interchangeable. The identity is local to this evaluator instance.
   */
  getEquivalentFactsIdentity?: (
    facts: readonly SelectedSourceVariantProfileFact[],
    owner: VariantPickerProfileOwner
  ) => number;
};

type SelectedSourceFactLookup = Map<
  string,
  SelectedSourceVariantProfileFact
>;

type SelectedSourceFactLookupCache = WeakMap<
  readonly SelectedSourceVariantProfileFact[],
  SelectedSourceFactLookup
>;

type SelectedSourceFactIdentity = {
  signature: string;
  id: number;
};

type SelectedSourceFactSignature = (
  fact: SelectedSourceVariantProfileFact
) => string;

type SelectedSourceFactsIdentityCache = WeakMap<
  readonly SelectedSourceVariantProfileFact[],
  Map<string, number>
>;

type SelectedSourceEvaluationCache = WeakMap<
  SelectedSourceVariantMatchingPolicy,
  Map<string, SelectedSourceTargetVariantEvaluation>
>;

// Bound retained comparison details, not the number of candidates evaluated.
// Profile-scope selection visits many distinct pairs with little cache reuse.
const MAX_CACHED_VARIANT_EVALUATIONS = 256;

export function evaluateSelectedSourceTargetVariant(
  input: SelectedSourceTargetVariantEvaluationInput
): SelectedSourceTargetVariantEvaluation {
  return evaluateSelectedSourceTargetVariantWithFactLookupCache(input);
}

export function createSelectedSourceTargetVariantEvaluator(options: {
  cacheEquivalentFacts?: boolean;
} = {}): SelectedSourceTargetVariantEvaluator {
  const factLookupCache: SelectedSourceFactLookupCache = new WeakMap();
  // Facts and their nested JSON stay immutable for this evaluator's lifetime,
  // so one canonical render per fact object serves every profile snapshot.
  const factSignatureCache = createSelectedSourceFactSignatureCache();
  const factIdentityCache = new WeakMap<SelectedSourceVariantProfileFact, SelectedSourceFactIdentity>();
  const factIdentityBySignature = new Map<string, SelectedSourceFactIdentity>();
  const factsIdentityCache: SelectedSourceFactsIdentityCache = new WeakMap();
  const factsIdentityBySignature = new Map<string, number>();
  const evaluationCache: SelectedSourceEvaluationCache = new WeakMap();
  const evaluateMeasurement = createSelectedSourceMeasurementMatchEvaluator();
  const fieldComparisonMemo: SelectedSourceFieldComparisonMemo = {
    byPolicy: new WeakMap(),
    factId: fact => getFactIdentity(fact).id,
  };
  let nextFactsIdentity = 1;
  let nextFactIdentity = 1;

  // Facts and their nested JSON remain immutable for this evaluator's lifetime.
  // Retain one canonical string even when different objects carry equal facts.
  const getFactIdentity = (fact: SelectedSourceVariantProfileFact): SelectedSourceFactIdentity => {
    const cached = factIdentityCache.get(fact);
    if (cached) return cached;
    const signature = selectedSourceVariantFactSignature(fact, factSignatureCache);
    let entry = factIdentityBySignature.get(signature);
    if (!entry) {
      entry = { signature, id: nextFactIdentity };
      nextFactIdentity += 1;
      factIdentityBySignature.set(signature, entry);
    }
    factIdentityCache.set(fact, entry);
    return entry;
  };
  const getFactSignature: SelectedSourceFactSignature = fact => getFactIdentity(fact).signature;

  const getEquivalentFactsIdentity = (
    facts: readonly SelectedSourceVariantProfileFact[],
    owner: VariantPickerProfileOwner
  ): number => {
    // Product IDs never contain NUL (boundedSelectedSourceIdentifiers), so this
    // key is as unambiguous as the JSON pair it replaces, at a fraction of the cost.
    const ownerKey = `${owner.productId}\u0000${owner.supplierId ?? "\u0001"}`;
    const identities = factsIdentityCache.get(facts) ?? new Map<string, number>();
    const cached = identities.get(ownerKey);
    if (cached !== undefined) return cached;

    // Singleton caches cannot prove aggregate bounds or cross-fact sharing.
    // Validate before installing any identity for this profile snapshot.
    assertSelectedSourceVariantFactsSignatureValid(facts, factSignatureCache);
    const factIds = facts.map(fact => getFactIdentity(fact).id).sort((left, right) => left - right);
    const signature = JSON.stringify([ownerKey, factIds]);
    let identity = factsIdentityBySignature.get(signature);
    if (identity === undefined) {
      identity = nextFactsIdentity;
      nextFactsIdentity += 1;
      factsIdentityBySignature.set(signature, identity);
    }
    identities.set(ownerKey, identity);
    factsIdentityCache.set(facts, identities);
    return identity;
  };

  const evaluate: SelectedSourceTargetVariantEvaluator = input => {
    if (!options.cacheEquivalentFacts) {
      return evaluateSelectedSourceTargetVariantWithFactLookupCache(
        input,
        factLookupCache,
        evaluateMeasurement,
        getFactSignature,
        fieldComparisonMemo
      );
    }

    const sourceIdentity = getEquivalentFactsIdentity(
      input.sourceProfile.facts,
      input.sourceProfile
    );
    const targetIdentity = getEquivalentFactsIdentity(
      input.target.facts,
      input.target
    );
    const policyEvaluations =
      evaluationCache.get(input.policy) ?? new Map();
    evaluationCache.set(input.policy, policyEvaluations);
    const pairKey = `${sourceIdentity}:${targetIdentity}`;
    const cached = policyEvaluations.get(pairKey);
    if (cached) return cached;

    const evaluation = evaluateSelectedSourceTargetVariantWithFactLookupCache(
      input,
      factLookupCache,
      evaluateMeasurement,
      getFactSignature,
      fieldComparisonMemo
    );
    if (policyEvaluations.size >= MAX_CACHED_VARIANT_EVALUATIONS) {
      const oldestKey = policyEvaluations.keys().next().value;
      if (oldestKey !== undefined) policyEvaluations.delete(oldestKey);
    }
    policyEvaluations.set(pairKey, evaluation);
    return evaluation;
  };

  return options.cacheEquivalentFacts
    ? Object.assign(evaluate, { getEquivalentFactsIdentity })
    : evaluate;
}

function evaluateSelectedSourceTargetVariantWithFactLookupCache(
  input: SelectedSourceTargetVariantEvaluationInput,
  factLookupCache?: SelectedSourceFactLookupCache,
  evaluateMeasurement: SelectedSourceMeasurementMatchEvaluator =
    evaluateSelectedSourceMeasurementMatch,
  getFactSignature?: SelectedSourceFactSignature,
  fieldComparisonMemo?: SelectedSourceFieldComparisonMemo
): SelectedSourceTargetVariantEvaluation {
  const sourceFacts = cachedFactsByField(
    input.sourceProfile.facts,
    factLookupCache,
    getFactSignature
  );
  const targetFacts = cachedFactsByField(input.target.facts, factLookupCache, getFactSignature);
  const memoByField = fieldComparisonMemo
    ? fieldComparisonMemoForPolicy(fieldComparisonMemo, input.policy)
    : null;
  const fieldComparisons = input.policy.fields.map(fieldPolicy => {
    const comparisonInput: SelectedSourceFieldComparisonInput = {
      fieldPolicy,
      sourceFact: sourceFacts.get(fieldPolicy.field) ?? null,
      targetFact: targetFacts.get(fieldPolicy.field) ?? null,
      categorySlug: input.policy.categorySlugs[0] ?? null,
      sourceOwner: input.sourceProfile,
      targetOwner: input.target,
    };
    if (!memoByField || !fieldComparisonMemo) return compareSelectedSourceField(comparisonInput, evaluateMeasurement);
    const key = fieldComparisonMemoKey(comparisonInput, fieldComparisonMemo.factId);
    const cached = memoByField.get(key);
    if (cached) return cached;
    const comparison = compareSelectedSourceField(comparisonInput, evaluateMeasurement);
    memoByField.set(key, comparison);
    return comparison;
  });

  const classification = classifyFieldComparisons(fieldComparisons);
  const fallbackComparisons = fieldComparisons.filter(
    comparison => comparison.state === "fallback"
  );
  // Retain the legacy scalar only for a single field-local factor. Multiple
  // fallback domains have incompatible units and must never be summed.
  const onlyFallbackFactor = fallbackComparisons[0]?.fallbackFactor;
  const fallbackDistance =
    fallbackComparisons.length === 1
      ? ((onlyFallbackFactor && "value" in onlyFallbackFactor
          ? onlyFallbackFactor.value
          : null) ??
        fallbackComparisons[0]?.fallbackDistance ??
        null)
      : null;

  return {
    classification,
    fallbackDistance,
    matchedFields: fieldComparisons
      .filter(comparison =>
        ["matched", "equivalent", "defaulted", "fallback"].includes(
          comparison.state
        )
      )
      .map(comparison => comparison.field),
    fieldComparisons,
    disclosureReasons: buildDisclosureReasons(classification, fieldComparisons),
  };
}

/**
 * One field's comparison depends only on its policy, the two facts and, for
 * owner-scoped evidence (reviewed supplier sizes and unspecified colors,
 * product-origin headwear sizes), the facts' owners. Thousands of candidate
 * variants share a few hundred distinct facts per field, so each pair is
 * compared once per evaluator. Facts are immutable for its lifetime.
 */
type SelectedSourceFieldComparisonMemo = {
  byPolicy: WeakMap<SelectedSourceVariantMatchingPolicy, Map<string, SelectedSourceVariantFieldComparison>>;
  /** The evaluator's small integer identity of a fact's canonical signature. */
  factId: (fact: SelectedSourceVariantProfileFact) => number;
};

function fieldComparisonMemoForPolicy(
  memo: SelectedSourceFieldComparisonMemo,
  policy: SelectedSourceVariantMatchingPolicy
): Map<string, SelectedSourceVariantFieldComparison> {
  let byKey = memo.byPolicy.get(policy);
  if (!byKey) {
    byKey = new Map();
    memo.byPolicy.set(policy, byKey);
  }
  return byKey;
}

function isOwnerScopedFact(fact: SelectedSourceVariantProfileFact | null): boolean {
  if (!fact) return false;
  return (fact.normalizedValue ?? "").startsWith("supplier-") ||
    (fact.field === "size" && fact.originScope === "product");
}

function fieldComparisonMemoKey(
  input: SelectedSourceFieldComparisonInput,
  factId: (fact: SelectedSourceVariantProfileFact) => number
): string {
  const ownerScoped = isOwnerScopedFact(input.sourceFact) || isOwnerScopedFact(input.targetFact);
  return [
    input.fieldPolicy.field,
    input.sourceFact ? factId(input.sourceFact) : "",
    input.targetFact ? factId(input.targetFact) : "",
    ownerScoped
      ? `${input.sourceOwner.supplierId ?? ""}\u0001${input.sourceOwner.productId}\u0001${input.targetOwner.supplierId ?? ""}\u0001${input.targetOwner.productId}`
      : "",
  ].join("\u0000");
}

function cachedFactsByField(
  facts: readonly SelectedSourceVariantProfileFact[],
  cache?: SelectedSourceFactLookupCache,
  getFactSignature?: SelectedSourceFactSignature
): SelectedSourceFactLookup {
  const cached = cache?.get(facts);
  if (cached) return cached;

  const lookup = factsByFieldWithSignature(facts, getFactSignature);
  cache?.set(facts, lookup);
  return lookup;
}

type SelectedSourceFieldComparisonInput = {
  fieldPolicy: SelectedSourceVariantFieldPolicy;
  sourceFact: SelectedSourceVariantProfileFact | null;
  targetFact: SelectedSourceVariantProfileFact | null;
  categorySlug: string | null;
  sourceOwner: VariantPickerProfileOwner;
  targetOwner: VariantPickerProfileOwner;
};

type SelectedSourceFieldComparisonContext = {
  sourceFactState: SelectedSourceVariantFactState | "missing";
  targetFactState: SelectedSourceVariantFactState | "missing";
  sourceValue: string | null;
  targetValue: string | null;
};

function compareDefaultableSelectedSourceField(
  input: SelectedSourceFieldComparisonInput,
  context: SelectedSourceFieldComparisonContext
): SelectedSourceVariantFieldComparison | null {
  if (input.fieldPolicy.role !== "defaultable" || input.fieldPolicy.field === "trimConfiguration") return null;
  if (
    context.sourceFactState !== "missing" &&
    context.sourceFactState !== "absent"
  ) {
    return null;
  }

  if (context.targetFactState === "missing") {
    return buildFieldComparison({
      input,
      state: "ignored",
      ...context,
      message: `${input.fieldPolicy.field} is defaultable, but neither side expresses it.`,
    });
  }

  if (context.targetFactState === "unnormalized") {
    return buildFieldComparison({
      input,
      state: "unnormalized",
      ...context,
      message: `${input.fieldPolicy.field} is defaultable, but target evidence is not normalized.`,
    });
  }

  if (
    context.sourceFactState === "absent" ||
    context.targetFactState === "absent"
  ) {
    return buildFieldComparison({
      input,
      state: "absent",
      ...context,
      message: `${input.fieldPolicy.field} is documented as absent for one side and cannot be defaulted into a match.`,
    });
  }

  if (Array.isArray(input.fieldPolicy.defaultValue) && input.fieldPolicy.defaultValue.length === 0) {
    return buildFieldComparison({
      input,
      state: "missing",
      ...context,
      message: `${input.fieldPolicy.field} is unknown on the selected source; no default value is approved.`,
    });
  }

  if (
    !targetMatchesDefaultablePolicyValue(input.fieldPolicy, context.targetValue)
  ) {
    return buildFieldComparison({
      input,
      state: "different",
      ...context,
      message: `${input.fieldPolicy.field} target value ${context.targetValue ?? "(missing)"} does not match policy default ${formatDefaultablePolicyValue(input.fieldPolicy)}; selected-source matching must not invent this assumption.`,
    });
  }

  return buildFieldComparison({
    input,
    state: "defaulted",
    ...context,
    message: `${input.fieldPolicy.field} was safely defaulted by policy.`,
  });
}

/**
 * A field the picker does not offer. Which supplier supplied the reference
 * profile must not decide it, so the source's value is never read: a target
 * that states the standard version matches, one that says nothing is not held
 * to it, and any other value is a different purchase.
 */
function compareStandardOnlySelectedSourceField(
  input: SelectedSourceFieldComparisonInput,
  context: SelectedSourceFieldComparisonContext
): SelectedSourceVariantFieldComparison | null {
  if (!input.fieldPolicy.standardOnly) return null;
  const field = input.fieldPolicy.field;
  if (context.targetFactState === "missing" || context.targetFactState === "absent") {
    return buildFieldComparison({
      input,
      state: "ignored",
      ...context,
      message: `${field} is not offered as a choice and this supplier does not state it.`,
    });
  }
  if (context.targetFactState === "unnormalized" || isConflictSelectedSourceFact(input.targetFact)) {
    return buildFieldComparison({
      input,
      state: "unnormalized",
      ...context,
      message: unnormalizedSelectedSourceFactMessage(input),
    });
  }
  return targetMatchesDefaultablePolicyValue(input.fieldPolicy, context.targetValue)
    ? buildFieldComparison({
        input,
        state: "matched",
        ...context,
        message: `${field} is not offered as a choice; this is the standard version.`,
      })
    : buildFieldComparison({
        input,
        state: "different",
        ...context,
        message: `${field} is not offered as a choice and ${context.targetValue ?? "(missing)"} is not the standard version ${formatDefaultablePolicyValue(input.fieldPolicy)}.`,
      });
}

function compareSupplierUnspecifiedColor(input: SelectedSourceFieldComparisonInput, context: SelectedSourceFieldComparisonContext): SelectedSourceVariantFieldComparison | null {
  if (input.fieldPolicy.field !== "color") return null;
  const sourceReserved = isSupplierUnspecifiedColorIdentity(input.sourceFact?.normalizedValue);
  const targetReserved = isSupplierUnspecifiedColorIdentity(input.targetFact?.normalizedValue);
  if (!sourceReserved && !targetReserved) return null;
  const source = input.sourceFact ? readValidatedSupplierUnspecifiedColor(pickerEvidence(input.sourceFact), input.sourceOwner) : null;
  const target = input.targetFact ? readValidatedSupplierUnspecifiedColor(pickerEvidence(input.targetFact), input.targetOwner) : null;
  if ((sourceReserved && !source) || (targetReserved && !target)) return buildFieldComparison({ input, ...context, state: "unnormalized", message: "Unspecified-color identity does not validate against its source product and provenance." });
  return buildFieldComparison({ input, ...context, state: source && source === target ? "matched" : "different", message: source && source === target ? "Same supplier product's fixed source color configuration; its physical hue is unspecified." : "Unspecified color has no cross-product or named-color equivalence and cannot default." });
}

/**
 * A wall-art source that proves it has no blank-color choice states nothing to
 * match when the target states no color at all. Apparel keeps its blank base
 * color, so this stays wall-art only, and any target color fact — stale,
 * conflicting, frame-owned, or absent — remains the target's statement.
 */
function isAbsentWallArtColorChoice(
  input: SelectedSourceFieldComparisonInput,
  context: SelectedSourceFieldComparisonContext
): boolean {
  if (input.fieldPolicy.field !== "color") return false;
  if (!input.categorySlug || !WALL_ART_CATEGORY_SET.has(input.categorySlug)) return false;
  if (input.targetFact !== null || context.targetFactState !== "missing") return false;
  if (context.sourceFactState !== "ready") return false;
  const fact = input.sourceFact;
  if (!fact || !isAbsentColorChoice(fact)) return false;
  if (fact.originScope !== "variant" || fact.normalizationStatus !== "exact") return false;
  if (isConflictSelectedSourceFact(fact)) return false;
  const valueJson = readUnknownRecord(fact.valueJson);
  const colorMeta = readUnknownRecord(valueJson?.colorMeta);
  return (
    !readRecordConflictPresence(valueJson) &&
    !readRecordConflictPresence(colorMeta) &&
    colorMeta?.kind === NO_BLANK_COLOR_OPTION_KIND &&
    colorMeta.owner === "base-product"
  );
}

/** Only genuinely missing trim on both sides is ignorable; other conditional fields retain their existing contract. */
function ignoreUnexpressedConditionalField(input: SelectedSourceFieldComparisonInput, context: SelectedSourceFieldComparisonContext): boolean {
  if (input.fieldPolicy.role !== "conditional") return false;
  if (input.fieldPolicy.field === "trimConfiguration") return input.sourceFact === null && input.targetFact === null;
  if (isAbsentWallArtColorChoice(input, context)) return true;
  return context.sourceFactState === "missing" || context.sourceFactState === "absent";
}

function comparePreMeasurementSelectedSourceField(
  input: SelectedSourceFieldComparisonInput,
  context: SelectedSourceFieldComparisonContext
): SelectedSourceVariantFieldComparison | null {
  if (input.fieldPolicy.role === "unsupported") {
    return buildFieldComparison({
      input,
      state: "unsupported",
      ...context,
      message: `${input.fieldPolicy.field} is outside the selected-source matching policy.`,
    });
  }

  const standardOnly = compareStandardOnlySelectedSourceField(input, context);
  if (standardOnly) return standardOnly;

  if ([input.sourceFact, input.targetFact].some(isConflictSelectedSourceFact)) {
    return buildFieldComparison({
      input,
      state: "unnormalized",
      ...context,
      message: unnormalizedSelectedSourceFactMessage(input),
    });
  }

  const sourceIdentity = compareSupplierUnspecifiedColor(input, context);
  if (sourceIdentity) return sourceIdentity;

  if (
    input.fieldPolicy.role === "cosmetic" &&
    (context.sourceFactState === "missing" ||
      context.targetFactState === "missing")
  ) {
    return buildFieldComparison({
      input,
      state: "ignored",
      ...context,
      message: `${input.fieldPolicy.field} is context-only for selected-source matching and is not expressed on both sides.`,
    });
  }

  if (ignoreUnexpressedConditionalField(input, context)) {
    return buildFieldComparison({
      input,
      state: "ignored",
      ...context,
      message: `${input.fieldPolicy.field} is conditional and is not expressed by the selected source option.`,
    });
  }

  const defaultableComparison = compareDefaultableSelectedSourceField(
    input,
    context
  );
  if (defaultableComparison) return defaultableComparison;

  if (
    input.fieldPolicy.field === "color" &&
    context.sourceFactState === "ready" &&
    context.targetFactState === "absent" &&
    isReviewedUnavailableColorAxisFact(input.targetFact)
  ) {
    return buildFieldComparison({
      input,
      state: "defaulted",
      ...context,
      message:
        "Color is not selectable for this supplier, so the product remains comparable without claiming a color match.",
    });
  }

  if (
    context.sourceFactState === "missing" ||
    context.targetFactState === "missing"
  ) {
    return buildFieldComparison({
      input,
      state: "missing",
      ...context,
      message: `${input.fieldPolicy.field} is missing from profile facts.`,
    });
  }

  if (
    context.sourceFactState === "unnormalized" ||
    context.targetFactState === "unnormalized"
  ) {
    return buildFieldComparison({
      input,
      state: "unnormalized",
      ...context,
      message: unnormalizedSelectedSourceFactMessage(input),
    });
  }

  if (
    context.sourceFactState === "absent" ||
    context.targetFactState === "absent"
  ) {
    return buildFieldComparison({
      input,
      state: "absent",
      ...context,
      message: `${input.fieldPolicy.field} is documented as absent for one side.`,
    });
  }

  return null;
}

/**
 * A field the picker offers by family: members of one family are the same pick
 * (matched, so none is preferred over another), members of two families differ.
 * Values outside every family fall through to the ordinary comparison.
 */
function compareSelectedSourceValueFamily(
  input: SelectedSourceFieldComparisonInput,
  context: SelectedSourceFieldComparisonContext
): SelectedSourceVariantFieldComparison | null {
  if (!input.fieldPolicy.valueFamily) return null;
  const field = input.fieldPolicy.field;
  const sourceFamily = readPickerValueFamily(field, context.sourceValue);
  const targetFamily = readPickerValueFamily(field, context.targetValue);
  if (!sourceFamily || !targetFamily) return null;
  return buildFieldComparison({
    input,
    state: sourceFamily === targetFamily ? "matched" : "different",
    ...context,
    message:
      sourceFamily === targetFamily
        ? `${field} is in the picked ${sourceFamily} family.`
        : `${field} is ${targetFamily}, not the picked ${sourceFamily}.`,
  });
}

function compareSelectedSourceField(
  input: SelectedSourceFieldComparisonInput,
  evaluateMeasurement: SelectedSourceMeasurementMatchEvaluator
): SelectedSourceVariantFieldComparison {
  const context: SelectedSourceFieldComparisonContext = {
    sourceFactState: selectedSourceFactState(
      input,
      input.sourceFact,
      input.sourceOwner
    ),
    targetFactState: selectedSourceFactState(
      input,
      input.targetFact,
      input.targetOwner
    ),
    sourceValue: normalizedFactValue(input.sourceFact),
    targetValue: normalizedFactValue(input.targetFact),
  };

  const preMeasurement = comparePreMeasurementSelectedSourceField(
    input,
    context
  );
  if (preMeasurement) return preMeasurement;

  const familyComparison = compareSelectedSourceValueFamily(input, context);
  if (familyComparison) return familyComparison;

  const supplierSizeComparison = compareSupplierProductSizes(input, context);
  if (supplierSizeComparison) return supplierSizeComparison;

  const policyComparison = compareStructuredMeasurementPolicy(
    input,
    context,
    evaluateMeasurement
  );
  if (policyComparison) {
    return policyComparison;
  }

  if (
    context.sourceValue &&
    context.targetValue &&
    context.sourceValue === context.targetValue
  ) {
    const state = rawValuesAreEquivalent(input.sourceFact, input.targetFact)
      ? "matched"
      : "equivalent";

    return buildFieldComparison({
      input,
      state,
      ...context,
      message:
        state === "matched"
          ? `${input.fieldPolicy.field} matches exactly.`
          : `${input.fieldPolicy.field} uses normalized equivalent values.`,
    });
  }

  const fallbackStrategy = input.fieldPolicy.fallback ?? "none";
  if (
    isTransposedWallArtFallback({
      strategy: fallbackStrategy,
      sourceValue: context.sourceValue,
      targetValue: context.targetValue,
    })
  ) {
    return buildFieldComparison({
      input,
      state: "different",
      ...context,
      message: `${input.fieldPolicy.field} has transposed wall-art dimensions; orientation/aspect differs and nearest fallback is blocked until reviewed.`,
    });
  }

  const blockedFallbackReason = weakWallArtNormalizedTokenFallbackReason({
    strategy: fallbackStrategy,
    sourceFact: input.sourceFact,
    targetFact: input.targetFact,
    sourceValue: context.sourceValue,
    targetValue: context.targetValue,
  });
  if (blockedFallbackReason) {
    return buildFieldComparison({
      input,
      state: "unnormalized",
      ...context,
      message: blockedFallbackReason,
    });
  }

  const fallbackFactor = computeFallbackFactor({
    strategy: fallbackStrategy,
    sourceValue: context.sourceValue,
    targetValue: context.targetValue,
  });
  if (fallbackFactor !== null) {
    return buildFieldComparison({
      input,
      state: "fallback",
      ...context,
      fallbackDistance: fallbackFactor.value,
      fallbackFactor,
      message: `${input.fieldPolicy.field} uses the nearest policy-approved fallback value.`,
    });
  }

  return buildFieldComparison({
    input,
    state: "different",
    ...context,
    message: `${input.fieldPolicy.field} differs and is not fallback-compatible.`,
  });
}

function isReviewedUnavailableColorAxisFact(
  fact: SelectedSourceVariantProfileFact | null
): boolean {
  if (
    fact?.field !== "color" ||
    fact.state !== "absent" ||
    fact.originScope !== "product" ||
    fact.normalizationStatus !== "absent" ||
    fact.source !== "reviewed-profile-fact-outcome" ||
    !fact.evidencePath?.trim() ||
    fact.confidence !== 1 ||
    isConflictSelectedSourceFact(fact)
  ) {
    return false;
  }

  return isReviewedUnavailableColorAxisEvidence(fact.valueJson);
}

type ReviewedUnavailableColorAxisEvidence = {
  absent: true;
  outcomeId: string;
  evidenceState: "unavailable";
  evidenceRoute: string;
  reason: string;
  reviewedAt: string;
};

function isReviewedUnavailableColorAxisEvidence(
  value: unknown
): value is ReviewedUnavailableColorAxisEvidence {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "absent" in value &&
    value.absent === true &&
    "evidenceState" in value &&
    value.evidenceState === "unavailable" &&
    "outcomeId" in value &&
    isNonBlankString(value.outcomeId) &&
    "evidenceRoute" in value &&
    isNonBlankString(value.evidenceRoute) &&
    "reason" in value &&
    isNonBlankString(value.reason) &&
    "reviewedAt" in value &&
    isNonBlankString(value.reviewedAt)
  );
}

function pickerEvidence(
  fact: SelectedSourceVariantProfileFact
): VariantPickerProfileEvidence {
  return {
    field: fact.field,
    normalizedValue: fact.normalizedValue,
    originScope: fact.originScope ?? null,
    normalizationStatus: fact.normalizationStatus ?? null,
    valueJson: fact.valueJson,
    source: fact.source,
    evidencePath: fact.evidencePath,
  };
}

function selectedSourceFactState(
  input: {
    categorySlug: string | null;
    fieldPolicy: SelectedSourceVariantFieldPolicy;
  },
  fact: SelectedSourceVariantProfileFact | null,
  owner: VariantPickerProfileOwner
): SelectedSourceVariantFactState | "missing" {
  const state = factState(fact);
  if (state !== "ready" || !fact) return state;
  if (input.fieldPolicy.field === "trimConfiguration" && (fact.originScope !== "variant" || fact.normalizationStatus !== "exact" || readRecordConflictPresence(readUnknownRecord(fact.valueJson)))) return "unnormalized";
  if (isWallArtPrintSurfaceColor(input, fact)) return "missing";
  const evidence = pickerEvidence(fact);
  if (
    isFixedSizeHeadwearPickerEvidenceReady(evidence, owner, input.categorySlug)
  ) {
    return "ready";
  }
  if (
    input.fieldPolicy.field === "size" &&
    fact.normalizedValue?.startsWith("supplier-size:")
  ) {
    return isTShirtPickerProfileEvidenceReady(evidence, owner)
      ? "ready"
      : "unnormalized";
  }
  if (
    !isStructuredApparelPickerCategory(input.categorySlug) ||
    (input.fieldPolicy.field !== "size" && input.fieldPolicy.field !== "color")
  ) {
    return state;
  }

  if (isTShirtPickerProfileEvidenceReady(evidence, owner)) return "ready";
  if (fact.originScope !== "variant" || fact.normalizationStatus !== "exact") {
    return "unnormalized";
  }
  // Exact variant colors retain their existing structured measurement checks.
  return input.fieldPolicy.field === "color" ? "ready" : "unnormalized";
}

const WALL_ART_CATEGORY_SET: ReadonlySet<string> = new Set(
  WALL_ART_PICKER_CATEGORIES
);

/**
 * Wall art's selectable color is the frame or presentation color. A color
 * owned by the print surface (white poster paper) is product context, so it
 * neither expresses the conditional color field nor stands in for a frame
 * color on the other side.
 */
function isWallArtPrintSurfaceColor(
  input: { categorySlug: string | null; fieldPolicy: SelectedSourceVariantFieldPolicy },
  fact: SelectedSourceVariantProfileFact
): boolean {
  if (input.fieldPolicy.field !== "color") return false;
  if (!input.categorySlug || !WALL_ART_CATEGORY_SET.has(input.categorySlug))
    return false;
  const colorMeta = readUnknownRecord(readUnknownRecord(fact.valueJson)?.colorMeta);
  return colorMeta?.owner === "print-substrate";
}

function compareSupplierProductSizes(
  input: SelectedSourceFieldComparisonInput,
  context: SelectedSourceFieldComparisonContext
): SelectedSourceVariantFieldComparison | null {
  if (input.fieldPolicy.field !== "size") return null;
  const source = input.sourceFact && readValidatedSupplierProductSize(
    pickerEvidence(input.sourceFact),
    input.sourceOwner
  );
  const target = input.targetFact && readValidatedSupplierProductSize(
    pickerEvidence(input.targetFact),
    input.targetOwner
  );
  if (!source && !target) return null;
  const sameSelector = Boolean(
    source && target && source.identity === target.identity &&
      input.sourceOwner.productId === input.targetOwner.productId &&
      input.sourceOwner.supplierId === input.targetOwner.supplierId
  );
  return buildFieldComparison({
    input,
    ...context,
    state: sameSelector ? "matched" : "different",
    message: sameSelector
      ? "Size matches the same reviewed supplier product selector."
      : "Supplier product size selectors do not establish shared fit or nearest-size equivalence.",
  });
}

function hasStructuredMeasurementFacts(
  input: SelectedSourceFieldComparisonInput
): boolean {
  return (
    input.sourceFact?.valueJson !== undefined ||
    input.targetFact?.valueJson !== undefined ||
    input.sourceFact?.numericValue !== undefined ||
    input.targetFact?.numericValue !== undefined
  );
}

function needsMeasurementPolicyForNormalizedOnlyFacts(
  input: SelectedSourceFieldComparisonInput,
  context: SelectedSourceFieldComparisonContext
): boolean {
  return (
    input.fieldPolicy.field === "color" ||
    isCapacityLikeSizeComparison(input, context) ||
    isApparelLikeSizeComparison(input, context) ||
    isSourceLocalNormalizedValueComparison(context) ||
    isSourceLocalOriginScopeComparison(input)
  );
}

function compareStructuredMeasurementPolicy(
  input: SelectedSourceFieldComparisonInput,
  context: SelectedSourceFieldComparisonContext,
  evaluateMeasurement: SelectedSourceMeasurementMatchEvaluator
): SelectedSourceVariantFieldComparison | null {
  const sourceAxisKey =
    input.fieldPolicy.sourceAxisKey ??
    input.sourceFact?.sourceAxisKey ??
    input.targetFact?.sourceAxisKey ??
    null;
  if (
    !hasStructuredMeasurementFacts(input) &&
    !sourceAxisKey &&
    !needsMeasurementPolicyForNormalizedOnlyFacts(input, context)
  ) {
    return null;
  }

  const result = evaluateMeasurement({
    categorySlug: input.categorySlug,
    field: input.fieldPolicy.field,
    sourceAxisKey,
    source: input.sourceFact,
    target: input.targetFact,
  });

  if (
    result.classification === "fallback" &&
    !isDelegatedMeasurementFallbackAllowed(input.fieldPolicy, result.policyId)
  ) {
    return buildFieldComparison({
      input,
      state: "different",
      sourceFactState: context.sourceFactState,
      targetFactState: context.targetFactState,
      sourceValue: context.sourceValue,
      targetValue: context.targetValue,
      message: `${input.fieldPolicy.field} has a #105 ${result.policyId} nearest fallback candidate, but selected-source fallback strategy ${input.fieldPolicy.fallback ?? "none"} disallows fallback for this policy/domain.`,
    });
  }

  return buildFieldComparison({
    input,
    state: fieldComparisonStateFromMeasurementClassification(
      result.classification
    ),
    sourceFactState: context.sourceFactState,
    targetFactState: context.targetFactState,
    sourceValue: context.sourceValue,
    targetValue: context.targetValue,
    fallbackDistance: result.fallbackDistance,
    fallbackFactor: result.fallbackFactor,
    message: result.disclosureReason,
  });
}

function isDelegatedMeasurementFallbackAllowed(
  fieldPolicy: SelectedSourceVariantFieldPolicy,
  policyId: string
): boolean {
  switch (fieldPolicy.fallback ?? "none") {
    case "wall-art-size-nearest":
      return policyId === "wall-art-2d-size";
    case "ordered-count-nearest":
      return policyId === "ordered-quantity-and-page-count";
    case "color-family-nearest":
      return policyId === "color-option-kind-owner";
    case "none":
      return false;
  }
}

function isSourceLocalNormalizedValueComparison(context: {
  sourceValue: string | null;
  targetValue: string | null;
}): boolean {
  return Boolean(
    context.sourceValue?.startsWith("source-local:") ||
      context.targetValue?.startsWith("source-local:")
  );
}

function isSourceLocalOriginScopeComparison(input: {
  sourceFact: SelectedSourceVariantProfileFact | null;
  targetFact: SelectedSourceVariantProfileFact | null;
}): boolean {
  return [input.sourceFact?.originScope, input.targetFact?.originScope].some(
    originScope => {
      const normalized = normalizeSourceLocalScopeValue(originScope);
      return normalized === "metadata" || normalized === "sourcelocal";
    }
  );
}

function normalizeSourceLocalScopeValue(
  value: string | null | undefined
): string | null {
  const normalized = readNonBlankString(value);
  return normalized ? normalized.toLowerCase().replace(/[^a-z0-9]+/g, "") : null;
}

function isCapacityLikeSizeComparison(
  input: {
    fieldPolicy: SelectedSourceVariantFieldPolicy;
    categorySlug: string | null;
  },
  context: {
    sourceValue: string | null;
    targetValue: string | null;
  }
): boolean {
  if (input.fieldPolicy.field === "capacity") return true;
  if (input.fieldPolicy.field !== "size") return false;
  return Boolean(
    context.sourceValue?.startsWith("capacity:") ||
      context.targetValue?.startsWith("capacity:") ||
      input.categorySlug?.includes("mug") ||
      input.categorySlug?.includes("bottle") ||
      input.categorySlug?.includes("drinkware")
  );
}

function isApparelLikeSizeComparison(
  input: {
    fieldPolicy: SelectedSourceVariantFieldPolicy;
    categorySlug: string | null;
  },
  context: {
    sourceValue: string | null;
    targetValue: string | null;
  }
): boolean {
  if (input.fieldPolicy.field !== "size") return false;
  const categorySlug = input.categorySlug?.toLowerCase() ?? "";
  return Boolean(
    context.sourceValue?.startsWith("apparel:") ||
      context.targetValue?.startsWith("apparel:") ||
      ["shirt", "hoodie", "apparel", "shoe", "sock"].some(term =>
        categorySlug.includes(term)
      )
  );
}

function targetMatchesDefaultablePolicyValue(
  fieldPolicy: SelectedSourceVariantFieldPolicy,
  targetValue: string | null
): boolean {
  const policyDefault = fieldPolicy.defaultValue;
  if (policyDefault === undefined || policyDefault === null) {
    return true;
  }

  const values = isPolicyDefaultValueList(policyDefault)
    ? policyDefault
    : [policyDefault];
  return targetValue !== null && values.includes(targetValue);
}

function isPolicyDefaultValueList(
  value: string | readonly string[]
): value is readonly string[] {
  return Array.isArray(value);
}

function formatDefaultablePolicyValue(
  fieldPolicy: SelectedSourceVariantFieldPolicy
): string {
  const policyDefault = fieldPolicy.defaultValue;
  if (policyDefault === undefined || policyDefault === null) {
    return "(any policy-approved value)";
  }
  return isPolicyDefaultValueList(policyDefault)
    ? policyDefault.join(" or ")
    : policyDefault;
}

function fieldComparisonStateFromMeasurementClassification(
  classification: SelectedSourceVariantMatchClassification
): SelectedSourceVariantFieldComparisonState {
  switch (classification) {
    case "exact":
      return "matched";
    case "equivalent":
      return "equivalent";
    case "defaulted":
      return "defaulted";
    case "fallback":
      return "fallback";
    case "not-comparable":
      return "different";
    case "normalization-needed":
      return "unnormalized";
  }
}

function buildFieldComparison(input: {
  input: {
    fieldPolicy: SelectedSourceVariantFieldPolicy;
  };
  state: SelectedSourceVariantFieldComparisonState;
  sourceFactState: SelectedSourceVariantFactState | "missing";
  targetFactState: SelectedSourceVariantFactState | "missing";
  sourceValue: string | null;
  targetValue: string | null;
  fallbackDistance?: number | null;
  fallbackFactor?: SelectedSourceVariantFallbackFactor | null;
  message: string;
}): SelectedSourceVariantFieldComparison {
  return {
    field: input.input.fieldPolicy.field,
    role: input.input.fieldPolicy.role,
    state: input.state,
    sourceValue: input.sourceValue,
    targetValue: input.targetValue,
    sourceFactState: input.sourceFactState,
    targetFactState: input.targetFactState,
    fallbackDistance: input.fallbackDistance ?? null,
    fallbackFactor: input.fallbackFactor ?? null,
    message: input.message,
  };
}

function classifyFieldComparisons(
  comparisons: readonly SelectedSourceVariantFieldComparison[]
): SelectedSourceVariantMatchClassification {
  const hardComparisons = comparisons.filter(
    comparison =>
      comparison.role === "required" ||
      comparison.role === "conditional" ||
      comparison.role === "defaultable"
  );

  if (
    hardComparisons.some(comparison =>
      ["missing", "unnormalized"].includes(comparison.state)
    )
  ) {
    return "normalization-needed";
  }

  if (
    hardComparisons.some(comparison =>
      ["absent", "different"].includes(comparison.state)
    )
  ) {
    return "not-comparable";
  }

  if (hardComparisons.some(comparison => comparison.state === "fallback")) {
    return "fallback";
  }

  if (hardComparisons.some(comparison => comparison.state === "defaulted")) {
    return "defaulted";
  }

  if (hardComparisons.some(comparison => comparison.state === "equivalent")) {
    return "equivalent";
  }

  return "exact";
}

function buildDisclosureReasons(
  classification: SelectedSourceVariantMatchClassification,
  comparisons: readonly SelectedSourceVariantFieldComparison[]
): string[] {
  const notableComparisons = comparisons.filter(comparison =>
    [
      "equivalent",
      "defaulted",
      "fallback",
      "different",
      "missing",
      "unnormalized",
      "absent",
    ].includes(comparison.state)
  );

  if (notableComparisons.length === 0) {
    return ["All required selected-source fields match."];
  }

  return [
    selectedSourceClassificationSummary(classification),
    ...notableComparisons.map(comparison => comparison.message),
  ];
}

function selectedSourceClassificationSummary(
  classification: SelectedSourceVariantMatchClassification
): string {
  switch (classification) {
    case "exact":
      return "All required selected-source fields match.";
    case "equivalent":
      return "Required fields match through normalized equivalent values.";
    case "defaulted":
      return "One or more options were safely defaulted by policy.";
    case "fallback":
      return "The exact option is unavailable; a policy-approved fallback was selected.";
    case "not-comparable":
      return "Required selected-source fields are materially different or absent.";
    case "normalization-needed":
      return "Profile facts need normalization before this row can be classified safely.";
  }
}


function factsByField(
  facts: readonly SelectedSourceVariantProfileFact[]
): Map<string, SelectedSourceVariantProfileFact> {
  return factsByFieldWithSignature(facts);
}

function factsByFieldWithSignature(
  facts: readonly SelectedSourceVariantProfileFact[],
  getFactSignature?: SelectedSourceFactSignature
): SelectedSourceFactLookup {
  const lookup = new Map<string, SelectedSourceVariantProfileFact>();

  for (const fact of sortFactsBySignature(facts, getFactSignature)) {
    const existing = lookup.get(fact.field);
    lookup.set(
      fact.field,
      existing ? mergeDuplicateSelectedSourceFact(existing, fact) : fact
    );
  }

  return lookup;
}

export function canonicalizeSelectedSourceProfileFacts(
  facts: readonly SelectedSourceVariantProfileFact[]
): SelectedSourceVariantProfileFact[] {
  return sortFactsBySignature([...factsByField(facts).values()]);
}

/**
 * Orders facts by their canonical signature, computing each signature once.
 * A comparator that rebuilt both signatures per comparison spent most of a
 * Quick Compare scope read on canonical JSON (#481).
 */
function sortFactsBySignature(
  facts: readonly SelectedSourceVariantProfileFact[],
  getFactSignature: SelectedSourceFactSignature = fact => buildSelectedSourceVariantFactsSignature([fact])
): SelectedSourceVariantProfileFact[] {
  return facts
    .map(fact => ({
      fact,
      signature: getFactSignature(fact),
    }))
    .sort((left, right) => compareUtf8Bytes(left.signature, right.signature))
    .map(entry => entry.fact);
}

function mergeDuplicateSelectedSourceFact(
  existing: SelectedSourceVariantProfileFact,
  next: SelectedSourceVariantProfileFact
): SelectedSourceVariantProfileFact {
  if (isConflictSelectedSourceFact(existing)) {
    return existing;
  }

  if (!areDuplicateSelectedSourceFactsCompatible(existing, next)) {
    return buildDuplicateSelectedSourceFieldConflict(existing, next);
  }

  return {
    ...existing,
    rawValue: existing.rawValue ?? next.rawValue,
    originScope: existing.originScope ?? next.originScope,
    normalizationStatus:
      existing.normalizationStatus ?? next.normalizationStatus,
    sourceAxisKey: existing.sourceAxisKey ?? next.sourceAxisKey,
    valueJson: existing.valueJson ?? next.valueJson,
    numericValue: existing.numericValue ?? next.numericValue,
    source: existing.source ?? next.source,
    evidencePath: existing.evidencePath ?? next.evidencePath,
    confidence: existing.confidence ?? next.confidence,
  };
}

function areDuplicateSelectedSourceFactsCompatible(
  left: SelectedSourceVariantProfileFact,
  right: SelectedSourceVariantProfileFact
): boolean {
  if (isConflictSelectedSourceFact(left) || isConflictSelectedSourceFact(right)) {
    return false;
  }

  const leftState = factState(left);
  const rightState = factState(right);
  if (leftState !== "ready" || rightState !== "ready") {
    return false;
  }

  const leftValue = normalizedFactValue(left);
  const rightValue = normalizedFactValue(right);
  if (leftValue && rightValue && leftValue !== rightValue) {
    return false;
  }

  const leftNumeric = normalizedNumericFactValue(left.numericValue);
  const rightNumeric = normalizedNumericFactValue(right.numericValue);
  if (leftNumeric && rightNumeric && leftNumeric !== rightNumeric) {
    return false;
  }

  if (left.field === "pageCount" && right.field === "pageCount") {
    return Boolean(leftValue && rightValue && leftNumeric && rightNumeric);
  }

  if (left.valueJson !== undefined && right.valueJson !== undefined) {
    return normalizeCanonicalJsonText(left.valueJson) === normalizeCanonicalJsonText(right.valueJson);
  }

  return true;
}

function buildDuplicateSelectedSourceFieldConflict(
  left: SelectedSourceVariantProfileFact,
  right: SelectedSourceVariantProfileFact
): SelectedSourceVariantProfileFact {
  return {
    field: left.field,
    normalizedValue: null,
    rawValue: "duplicate/conflicting selected-source profile facts",
    state: "unnormalized",
    originScope: left.originScope ?? right.originScope ?? "variant",
    normalizationStatus: "conflict",
    sourceAxisKey: left.sourceAxisKey ?? right.sourceAxisKey ?? null,
    valueJson: {
      conflict: "duplicate selected-source facts for the same field disagree",
      facts: [selectedSourceFactConflictSummary(left), selectedSourceFactConflictSummary(right)],
    },
    numericValue: null,
    source: left.source ?? right.source ?? null,
    evidencePath: left.evidencePath ?? right.evidencePath ?? null,
    confidence: left.confidence ?? right.confidence ?? null,
  };
}

function selectedSourceFactConflictSummary(
  fact: SelectedSourceVariantProfileFact
) {
  return {
    field: fact.field,
    normalizedValue: readNonBlankString(fact.normalizedValue),
    rawValue: readNonBlankString(fact.rawValue),
    state: fact.state ?? inferFactState(fact),
    normalizationStatus: readNonBlankString(fact.normalizationStatus),
    sourceAxisKey: readNonBlankString(fact.sourceAxisKey),
    numericValue: fact.numericValue ?? null,
    source: readNonBlankString(fact.source),
    evidencePath: readNonBlankString(fact.evidencePath),
    confidence: fact.confidence ?? null,
    valueJson: fact.valueJson ?? null,
  };
}

function isConflictSelectedSourceFact(
  fact: SelectedSourceVariantProfileFact | null
): boolean {
  if (!fact) return false;
  return (
    readNonBlankString(fact.normalizationStatus)?.toLowerCase() === "conflict" ||
    normalizeCanonicalJsonText(fact.valueJson ?? "").toLowerCase().includes("conflict")
  );
}

function unnormalizedSelectedSourceFactMessage(input: {
  fieldPolicy: SelectedSourceVariantFieldPolicy;
  sourceFact: SelectedSourceVariantProfileFact | null;
  targetFact: SelectedSourceVariantProfileFact | null;
  categorySlug?: string | null;
}): string {
  const conflictFact = [input.sourceFact, input.targetFact].find(
    isConflictSelectedSourceFact
  );
  if (conflictFact) {
    const conflictText = normalizeCanonicalJsonText(conflictFact.valueJson ?? "").toLowerCase();
    const duplicatePrefix = conflictText.includes("duplicate")
      ? "duplicate/conflicting"
      : "conflicting";
    return `${input.fieldPolicy.field} has ${duplicatePrefix} profile facts; normalization-needed before selected-source matching.`;
  }

  if (
    isStructuredApparelPickerCategory(input.categorySlug) &&
    (input.fieldPolicy.field === "size" || input.fieldPolicy.field === "color")
  ) {
    return `${input.fieldPolicy.field} lacks exact variant-scoped structured T-shirt picker evidence.`;
  }

  return `${input.fieldPolicy.field} exists but is not normalized.`;
}

function rawValuesAreEquivalent(
  sourceFact: SelectedSourceVariantProfileFact | null,
  targetFact: SelectedSourceVariantProfileFact | null
): boolean {
  const sourceRaw = readNonBlankString(sourceFact?.rawValue);
  const targetRaw = readNonBlankString(targetFact?.rawValue);

  if (!sourceRaw || !targetRaw) {
    return true;
  }

  return sourceRaw.toLowerCase() === targetRaw.toLowerCase();
}

function weakWallArtNormalizedTokenFallbackReason(input: {
  strategy: SelectedSourceVariantFallbackStrategy;
  sourceFact: SelectedSourceVariantProfileFact | null;
  targetFact: SelectedSourceVariantProfileFact | null;
  sourceValue: string | null;
  targetValue: string | null;
}): string | null {
  if (input.strategy !== "wall-art-size-nearest") return null;
  if (!parseWallArtDimension(input.sourceValue) || !parseWallArtDimension(input.targetValue)) {
    return null;
  }

  if (
    hasStructuredWallArtDimensions(input.sourceFact) &&
    hasStructuredWallArtDimensions(input.targetFact)
  ) {
    return null;
  }

  const weakSides: string[] = [];
  for (const [side, fact] of [
    ["source", input.sourceFact],
    ["target", input.targetFact],
  ] as const) {
    const status = readNonBlankString(fact?.normalizationStatus)?.toLowerCase();
    if (
      status === null ||
      status === undefined ||
      status === "exact" ||
      status === "legacy-derived"
    ) {
      continue;
    }
    weakSides.push(`${side} normalizationStatus=${status}`);
  }

  if (weakSides.length === 0) return null;

  return `wall-art nearest fallback requires structured VariantProfileValue.valueJson widthMm/heightMm or trusted normalized-token evidence (normalizationStatus=exact or legacy-derived); ${weakSides.join(" and ")} needs normalization before closest fallback can run.`;
}

function hasStructuredWallArtDimensions(
  fact: SelectedSourceVariantProfileFact | null
): boolean {
  const record = readUnknownRecord(fact?.valueJson);
  return (
    record !== null &&
    isFiniteNumberLike(record.widthMm) &&
    isFiniteNumberLike(record.heightMm)
  );
}

function isFiniteNumberLike(value: unknown): value is number | string {
  return (
    (typeof value === "number" && Number.isFinite(value)) ||
    (typeof value === "string" &&
      value.trim() !== "" &&
      Number.isFinite(Number(value)))
  );
}

function computeFallbackFactor(input: {
  strategy: SelectedSourceVariantFallbackStrategy;
  sourceValue: string | null;
  targetValue: string | null;
}): SelectedSourceDistanceFallbackFactor | null {
  if (input.strategy !== "wall-art-size-nearest") {
    return null;
  }

  const sourceDimensions = parseWallArtDimension(input.sourceValue);
  const targetDimensions = parseWallArtDimension(input.targetValue);
  if (
    !sourceDimensions ||
    !targetDimensions ||
    sourceDimensions.widthTenthsMm <= 0 ||
    sourceDimensions.heightTenthsMm <= 0 ||
    targetDimensions.widthTenthsMm <= 0 ||
    targetDimensions.heightTenthsMm <= 0 ||
    wallArtTokenOrientation(sourceDimensions) !== wallArtTokenOrientation(targetDimensions)
  ) {
    return null;
  }

  const nearest = wallArtNearestSize(
    { widthMm: sourceDimensions.widthTenthsMm, heightMm: sourceDimensions.heightTenthsMm },
    { widthMm: targetDimensions.widthTenthsMm, heightMm: targetDimensions.heightTenthsMm }
  );
  if (nearest.kind !== "nearest") {
    return null;
  }

  return {
    kind: "wall-art-size",
    unit: "log-ratio",
    value: nearest.distance,
  };
}

function wallArtTokenOrientation(dimensions: {
  widthTenthsMm: number;
  heightTenthsMm: number;
}): "square" | "landscape" | "portrait" {
  if (Math.abs(dimensions.widthTenthsMm - dimensions.heightTenthsMm) <= 5) return "square";
  return dimensions.widthTenthsMm > dimensions.heightTenthsMm ? "landscape" : "portrait";
}

function isTransposedWallArtFallback(input: {
  strategy: SelectedSourceVariantFallbackStrategy;
  sourceValue: string | null;
  targetValue: string | null;
}): boolean {
  if (input.strategy !== "wall-art-size-nearest") {
    return false;
  }
  const sourceDimensions = parseWallArtDimension(input.sourceValue);
  const targetDimensions = parseWallArtDimension(input.targetValue);
  if (!sourceDimensions || !targetDimensions) {
    return false;
  }
  return sourceDimensions.widthTenthsMm !== sourceDimensions.heightTenthsMm &&
    sourceDimensions.widthTenthsMm === targetDimensions.heightTenthsMm &&
    sourceDimensions.heightTenthsMm === targetDimensions.widthTenthsMm;
}

function parseWallArtDimension(
  normalizedValue: string | null
): { widthTenthsMm: number; heightTenthsMm: number } | null {
  const match = /^wall-art:dim:(\d+)x(\d+)$/.exec(normalizedValue ?? "");
  if (!match) {
    return null;
  }

  return {
    widthTenthsMm: Number(match[1]),
    heightTenthsMm: Number(match[2]),
  };
}
