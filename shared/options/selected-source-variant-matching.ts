export * from "./selected-source-variant-matching/types";
export * from "./selected-source-variant-matching/policies";
export * from "./selected-source-variant-matching/scope";
export * from "./selected-source-variant-matching/ranking";
export * from "./selected-source-variant-matching/profile-scope";
export {
  buildSelectedSourceVariantFactsSignature,
  buildSelectedSourceVariantSemanticFactsSignature,
  MAX_SELECTED_SOURCE_PROFILE_BYTES_PER_PROFILE,
  MAX_SELECTED_SOURCE_PROFILE_ROWS_PER_PROFILE,
  expandSelectedSourceVariantProfileFactQueryFields,
  selectedSourcePolicyFieldForProfileField,
  selectedSourceProfileFactsForPolicyFields,
  selectedSourceProfileValueRowBudgetBytes,
  selectedSourceProfileValueRowToFact,
} from "./selected-source-variant-matching/facts";
export {
  addStructuredVariantSpecFactsByProfileId,
  accumulateSelectedSourceStructuredFallback,
  applySelectedSourceStructuredFallbackAccumulator,
  createSelectedSourceStructuredFallbackAccumulator,
  isSelectedSourceStructuredFallbackCompletionFact,
  prepareSelectedSourceSupplierVariantIds,
  readSelectedSourceStructuredProductConsumerIndex,
  SelectedSourceEvidenceBudgetExceededError,
  selectedSourceProfilesNeedStructuredVariantFacts,
  selectedSourcePolicyNeedsStructuredVariantFacts,
  selectedSourceStructuredFallbackCompletionFact,
  selectedSourceStructuredFallbackDecisions,
  selectedSourceStructuredVariantFactFields,
  SELECTED_SOURCE_STRUCTURED_FALLBACK_COMPLETE_FIELD_PREFIX,
  type SelectedSourceStructuredFallbackAccumulator,
  type SelectedSourceStructuredVariantFactField,
  type SelectedSourceStructuredVariantFactInput,
} from "./selected-source-variant-matching/structured-facts";
export {
  materializeSelectedSourceVariantMatchCandidates,
  resolveSelectedSourceVariantRowMatches,
  type SelectedSourceVariantEvaluationCache,
} from "./selected-source-variant-matching/materialization";

export {
  canonicalizeSelectedSourceProfileFacts,
  createSelectedSourceTargetVariantEvaluator,
  type SelectedSourceTargetVariantEvaluation,
  type SelectedSourceTargetVariantEvaluationInput,
  type SelectedSourceTargetVariantEvaluator,
} from "./selected-source-variant-matching/comparison";
