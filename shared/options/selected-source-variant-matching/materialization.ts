import { compareNullableNumbers, compareUtf8Bytes } from "../../kernel/canonical-order.ts";
import { createSelectedSourceTargetVariantEvaluator } from "./comparison";
import type { evaluateSelectedSourceTargetVariant } from "./comparison";
import {
  buildSelectedSourceVariantFactsSignature,
  createSelectedSourceFactSignatureCache,
} from "./facts";
import { compareSelectedSourceVariantOptionFit } from "./ranking";
import type {
  MaterializedSelectedSourceVariantMatchCandidate,
  SelectedSourceTargetVariantInput,
  SelectedSourceVariantLookupSource,
  SelectedSourceVariantMatchClassification,
  SelectedSourceVariantMatchingPolicy,
  SelectedSourceVariantMaterializationExpectation,
  SelectedSourceVariantProfileInput,
  SelectedSourceVariantRowMatch,
  SelectedSourceVariantVisibleRow,
} from "./types";

type CandidateWithSortMetrics = MaterializedSelectedSourceVariantMatchCandidate & {
  targetVariantRank: number | null;
};

type TargetEvaluationCacheEntry = {
  targetFactsSignature: string;
  evaluation: ReturnType<typeof evaluateSelectedSourceTargetVariant>;
};

export type SelectedSourceVariantEvaluationCache = Map<
  string,
  TargetEvaluationCacheEntry
>;

const MATCH_CLASSIFICATION_PRIORITY: Record<
  SelectedSourceVariantMatchClassification,
  number
> = {
  exact: 0,
  equivalent: 1,
  defaulted: 2,
  fallback: 3,
  "normalization-needed": 4,
  "not-comparable": 5,
};

export function materializeSelectedSourceVariantMatchCandidates(input: {
  sourceProfile: SelectedSourceVariantProfileInput;
  targetVariants: readonly SelectedSourceTargetVariantInput[];
  policy: SelectedSourceVariantMatchingPolicy;
  materializedAt?: string;
  evaluationCache?: SelectedSourceVariantEvaluationCache;
}): MaterializedSelectedSourceVariantMatchCandidate[] {
  const materializedAt = input.materializedAt ?? new Date().toISOString();
  const evaluateTargetVariant = createSelectedSourceTargetVariantEvaluator();
  // Facts stay immutable for this call: render each fact once, and evaluate
  // each distinct target fact set once. Thousands of candidate variants share
  // a few hundred fact sets across products; only the reviewed supplier-product
  // size rule also reads the target's owner, so those keep their product.
  const signatureCache = createSelectedSourceFactSignatureCache();
  const evaluationByTargetFacts = new Map<string, TargetEvaluationCacheEntry>();
  const sourceFactsSignature = buildSelectedSourceVariantFactsSignature(
    input.sourceProfile.facts,
    signatureCache
  );
  const targetEvaluationByProfileId = new Map<
    string,
    TargetEvaluationCacheEntry
  >();

  const targetVariantsByProduct = new Map<
    string,
    SelectedSourceTargetVariantInput[]
  >();
  for (const target of input.targetVariants) {
    const existing = targetVariantsByProduct.get(target.productId) ?? [];
    existing.push(target);
    targetVariantsByProduct.set(target.productId, existing);
  }

  const rankedCandidates: MaterializedSelectedSourceVariantMatchCandidate[] = [];
  const targetProductGroups = [...targetVariantsByProduct.values()].sort(
    (left, right) =>
      compareUtf8Bytes(left[0]?.supplierId ?? "", right[0]?.supplierId ?? "") ||
      compareUtf8Bytes(left[0]?.productId ?? "", right[0]?.productId ?? "")
  );

  for (const productTargets of targetProductGroups) {
    const productCandidates = productTargets.map(target => {
      const cachedEvaluation = targetEvaluationByProfileId.get(
        target.variantProfileId
      );
      let targetEvaluation = cachedEvaluation;
      if (!targetEvaluation) {
        const sharedEvaluationCacheKey = selectedSourceEvaluationCacheKey({
          sourceFactsSignature,
          targetVariantProfileId: target.variantProfileId,
        });
        targetEvaluation = input.evaluationCache?.get(sharedEvaluationCacheKey);
        if (!targetEvaluation) {
          const targetFactsSignature = buildSelectedSourceVariantFactsSignature(
            target.facts,
            signatureCache
          );
          const factsKey = hasOwnerScopedSize(target)
            ? `${target.supplierId}\u0000${target.productId}\u0000${targetFactsSignature}`
            : `\u0000\u0000${targetFactsSignature}`;
          targetEvaluation = evaluationByTargetFacts.get(factsKey);
          if (!targetEvaluation) {
            targetEvaluation = {
              targetFactsSignature,
              evaluation: evaluateTargetVariant({
                sourceProfile: input.sourceProfile,
                target,
                policy: input.policy,
              }),
            };
            evaluationByTargetFacts.set(factsKey, targetEvaluation);
          }
          input.evaluationCache?.set(sharedEvaluationCacheKey, targetEvaluation);
        }
        targetEvaluationByProfileId.set(target.variantProfileId, targetEvaluation);
      }
      const { targetFactsSignature, evaluation } = targetEvaluation;

      return {
        sourceVariantProfileId: input.sourceProfile.variantProfileId,
        sourceProductId: input.sourceProfile.productId,
        sourceSupplierId: input.sourceProfile.supplierId,
        targetProductId: target.productId,
        targetSupplierId: target.supplierId,
        targetVariantId: target.variantId,
        targetVariantProfileId: target.variantProfileId,
        policyId: input.policy.id,
        policyVersion: input.policy.version,
        sourceFactsSignature,
        targetFactsSignature,
        classification: evaluation.classification,
        rank: 0,
        qualityRank: MATCH_CLASSIFICATION_PRIORITY[evaluation.classification],
        fallbackDistance: evaluation.fallbackDistance,
        matchedFields: evaluation.matchedFields,
        fieldComparisons: evaluation.fieldComparisons,
        disclosureReasons: evaluation.disclosureReasons,
        materializedAt,
        targetVariantRank: target.variantRank ?? null,
      } satisfies CandidateWithSortMetrics;
    });
    productCandidates.sort(compareMaterializedCandidateSortMetrics);
    productCandidates.forEach((candidate, index) => {
      const { targetVariantRank, ...materializedCandidate } = candidate;
      void targetVariantRank;
      rankedCandidates.push({
        ...materializedCandidate,
        rank: index + 1,
      });
    });
  }

  return rankedCandidates;
}

/** Reviewed supplier-product sizes compare the target's own product with the source's. */
function hasOwnerScopedSize(target: SelectedSourceTargetVariantInput): boolean {
  return target.facts.some(
    fact => fact.field === "size" && (fact.normalizedValue ?? "").startsWith("supplier-size:")
  );
}

function selectedSourceEvaluationCacheKey(input: {
  sourceFactsSignature: string;
  targetVariantProfileId: string;
}): string {
  return [input.sourceFactsSignature, input.targetVariantProfileId].join("\u0000");
}

export function resolveSelectedSourceVariantRowMatches(input: {
  source: SelectedSourceVariantLookupSource;
  visibleRows: readonly SelectedSourceVariantVisibleRow[];
  candidates: readonly MaterializedSelectedSourceVariantMatchCandidate[];
  expectedMaterialization: SelectedSourceVariantMaterializationExpectation;
  missingCandidateOutcome?: "materialization-missing" | "no-compatible-option";
}): SelectedSourceVariantRowMatch[] {
  const lookup = buildSelectedSourceVariantCandidateLookup(input.candidates);
  const expectedMaterialization = {
    ...input.expectedMaterialization,
    sourceFactsSignature:
      input.expectedMaterialization.sourceFactsSignature ??
      input.source.factsSignature ??
      undefined,
  } satisfies SelectedSourceVariantMaterializationExpectation;

  return input.visibleRows.map(row => {
    if (
      row.productId === input.source.productId &&
      row.supplierId === input.source.supplierId
    ) {
      return {
        productId: row.productId,
        supplierId: row.supplierId,
        surfaceKind: row.surfaceKind,
        matchKind: row.matchKind,
        classification: "exact",
        materializationStatus: "source-self",
        selectedVariantId: input.source.variantId ?? null,
        selectedVariantProfileId: input.source.variantProfileId,
        candidate: null,
        fieldComparisons: [],
        disclosureReasons: ["Selected source row."],
      } satisfies SelectedSourceVariantRowMatch;
    }

    const rowCandidates = lookup.get(
      selectedSourceVariantCandidateLookupKey({
        sourceVariantProfileId: input.source.variantProfileId,
        targetProductId: row.productId,
        targetSupplierId: row.supplierId,
      })
    );

    if (!rowCandidates || rowCandidates.length === 0) {
      if (input.missingCandidateOutcome === "no-compatible-option") {
        return buildNoCompatibleOptionRow(row);
      }
      return buildMaterializationBlockedRow({
        row,
        materializationStatus: "missing",
        reason:
          "No selected-source candidate exists for this visible row.",
      });
    }

    const freshCandidates = rowCandidates.filter(candidate =>
      isCandidateFresh(candidate, expectedMaterialization)
    );

    const candidate = [...freshCandidates].sort(compareMaterializedCandidates)[0];
    if (!candidate) {
      return buildMaterializationBlockedRow({
        row,
        materializationStatus: "stale",
        reason:
          "Selected-source candidate materialization is stale for the current policy or profile facts.",
      });
    }

    return {
      productId: row.productId,
      supplierId: row.supplierId,
      surfaceKind: row.surfaceKind,
      matchKind: row.matchKind,
      classification: candidate.classification,
      materializationStatus: "ready",
      selectedVariantId: candidate.targetVariantId,
      selectedVariantProfileId: candidate.targetVariantProfileId,
      candidate,
      fieldComparisons: candidate.fieldComparisons,
      disclosureReasons: candidate.disclosureReasons,
    } satisfies SelectedSourceVariantRowMatch;
  });
}

function buildNoCompatibleOptionRow(
  row: SelectedSourceVariantVisibleRow
): SelectedSourceVariantRowMatch {
  return {
    productId: row.productId,
    supplierId: row.supplierId,
    surfaceKind: row.surfaceKind,
    matchKind: row.matchKind,
    classification: "not-comparable",
    materializationStatus: "ready",
    selectedVariantId: null,
    selectedVariantProfileId: null,
    candidate: null,
    fieldComparisons: [],
    disclosureReasons: [
      "No compatible selected option is available for this visible row.",
    ],
  };
}

function compareMaterializedCandidateSortMetrics(
  left: CandidateWithSortMetrics,
  right: CandidateWithSortMetrics
): number {
  return (
    left.qualityRank - right.qualityRank ||
    compareSelectedSourceVariantOptionFit(
      left.fieldComparisons,
      right.fieldComparisons
    ) ||
    compareNullableNumbers(left.targetVariantRank, right.targetVariantRank) ||
    compareUtf8Bytes(left.targetVariantId, right.targetVariantId) ||
    compareUtf8Bytes(left.targetVariantProfileId, right.targetVariantProfileId)
  );
}

function compareMaterializedCandidates(
  left: MaterializedSelectedSourceVariantMatchCandidate,
  right: MaterializedSelectedSourceVariantMatchCandidate
): number {
  return (
    compareUtf8Bytes(left.sourceVariantProfileId, right.sourceVariantProfileId) ||
    compareUtf8Bytes(left.targetSupplierId, right.targetSupplierId) ||
    compareUtf8Bytes(left.targetProductId, right.targetProductId) ||
    left.rank - right.rank ||
    left.qualityRank - right.qualityRank ||
    compareSelectedSourceVariantOptionFit(
      left.fieldComparisons,
      right.fieldComparisons
    ) ||
    compareUtf8Bytes(left.targetVariantId, right.targetVariantId) ||
    compareUtf8Bytes(left.targetVariantProfileId, right.targetVariantProfileId)
  );
}

function buildSelectedSourceVariantCandidateLookup(
  candidates: readonly MaterializedSelectedSourceVariantMatchCandidate[]
): Map<string, MaterializedSelectedSourceVariantMatchCandidate[]> {
  const lookup = new Map<string, MaterializedSelectedSourceVariantMatchCandidate[]>();

  for (const candidate of candidates) {
    const key = selectedSourceVariantCandidateLookupKey(candidate);
    const existing = lookup.get(key) ?? [];
    existing.push(candidate);
    lookup.set(key, existing);
  }

  for (const [key, keyCandidates] of lookup.entries()) {
    lookup.set(key, [...keyCandidates].sort(compareMaterializedCandidates));
  }

  return lookup;
}

function selectedSourceVariantCandidateLookupKey(input: {
  sourceVariantProfileId: string;
  targetProductId: string;
  targetSupplierId: string;
}): string {
  return [
    input.sourceVariantProfileId,
    input.targetSupplierId,
    input.targetProductId,
  ].join("\u0000");
}

function isCandidateFresh(
  candidate: MaterializedSelectedSourceVariantMatchCandidate,
  expected: SelectedSourceVariantMaterializationExpectation
): boolean {
  if (
    candidate.policyId !== expected.policyId ||
    candidate.policyVersion !== expected.policyVersion
  ) {
    return false;
  }

  if (
    expected.sourceFactsSignature &&
    candidate.sourceFactsSignature !== expected.sourceFactsSignature
  ) {
    return false;
  }

  const expectedTargetSignature = getExpectedTargetFactsSignature(
    expected.targetFactsSignatures,
    candidate.targetVariantProfileId
  );

  return !(
    expectedTargetSignature &&
    candidate.targetFactsSignature !== expectedTargetSignature
  );
}

function getExpectedTargetFactsSignature(
  signatures:
    | ReadonlyMap<string, string>
    | Readonly<Record<string, string>>
    | undefined,
  variantProfileId: string
): string | null {
  if (!signatures) return null;
  if (isReadonlyStringMap(signatures)) {
    return signatures.get(variantProfileId) ?? null;
  }
  return signatures[variantProfileId] ?? null;
}

function isReadonlyStringMap(
  value: ReadonlyMap<string, string> | Readonly<Record<string, string>>
): value is ReadonlyMap<string, string> {
  return typeof value.get === "function";
}

function buildMaterializationBlockedRow(input: {
  row: SelectedSourceVariantVisibleRow;
  materializationStatus: "missing" | "stale";
  reason: string;
}): SelectedSourceVariantRowMatch {
  return {
    productId: input.row.productId,
    supplierId: input.row.supplierId,
    surfaceKind: input.row.surfaceKind,
    matchKind: input.row.matchKind,
    classification: "normalization-needed",
    materializationStatus: input.materializationStatus,
    selectedVariantId: null,
    selectedVariantProfileId: null,
    candidate: null,
    fieldComparisons: [],
    disclosureReasons: [input.reason],
  };
}
