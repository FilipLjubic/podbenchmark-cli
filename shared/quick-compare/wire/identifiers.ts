export const QUICK_COMPARE_WIRE_PROTOCOL_VERSION = 1 as const;

// Each envelope's version is stated once; its representation name follows from it.
// Price-bearing envelopes require an independent nullable production component.
// Closest size and count distances travel as log ratios since full v9,
// bootstrap v10, market v8, bootstrap-market v9 and selected-source v8.
// Prerendered country comparisons name their option and each offer's claim
// eligibility and item count since prerendered v10.
export const QUICK_COMPARE_PRERENDERED_COMPARISON_SCHEMA_VERSION = 10;
export const QUICK_COMPARE_FULL_COMPARISON_VERSION = 9 as const;
export const QUICK_COMPARE_PICKER_BOOTSTRAP_SCHEMA_VERSION = 10 as const;
export const QUICK_COMPARE_PICKER_REVISION_SCHEMA_VERSION = 1 as const;
const MARKET_PATCH_NUMBER = 8 as const;
const BOOTSTRAP_MARKET_NUMBER = 9 as const;
export const QUICK_COMPARE_SELECTED_SOURCE_VERSION = 8 as const;
export const QUICK_COMPARE_FULFILLMENT_FACTS_VERSION = 1 as const;

export const QUICK_COMPARE_FULL_COMPARISON_REPRESENTATION =
  `quick-compare-full-v${QUICK_COMPARE_FULL_COMPARISON_VERSION}` as const;
export const QUICK_COMPARE_PICKER_BOOTSTRAP_REPRESENTATION =
  `quick-compare-picker-bootstrap-v${QUICK_COMPARE_PICKER_BOOTSTRAP_SCHEMA_VERSION}` as const;
export const QUICK_COMPARE_PICKER_REVISION_REPRESENTATION =
  `quick-compare-picker-revision-v${QUICK_COMPARE_PICKER_REVISION_SCHEMA_VERSION}` as const;
export const QUICK_COMPARE_MARKET_PATCH_REPRESENTATION =
  `market-v${MARKET_PATCH_NUMBER}` as const;
export const QUICK_COMPARE_MARKET_PATCH_VERSION =
  `quick-compare-picker-market-v${MARKET_PATCH_NUMBER}` as const;
export const QUICK_COMPARE_BOOTSTRAP_MARKET_REPRESENTATION =
  `bootstrap-market-v${BOOTSTRAP_MARKET_NUMBER}` as const;
export const QUICK_COMPARE_SELECTED_SOURCE_REPRESENTATION =
  `quick-compare-selected-source-v${QUICK_COMPARE_SELECTED_SOURCE_VERSION}` as const;
export const QUICK_COMPARE_FULFILLMENT_FACTS_REPRESENTATION =
  `quick-compare-fulfillment-facts-v${QUICK_COMPARE_FULFILLMENT_FACTS_VERSION}` as const;

export const QUICK_COMPARE_WIRE_REPRESENTATIONS = [
  QUICK_COMPARE_FULL_COMPARISON_REPRESENTATION,
  QUICK_COMPARE_PICKER_BOOTSTRAP_REPRESENTATION,
  QUICK_COMPARE_PICKER_REVISION_REPRESENTATION,
  QUICK_COMPARE_MARKET_PATCH_REPRESENTATION,
  QUICK_COMPARE_BOOTSTRAP_MARKET_REPRESENTATION,
  QUICK_COMPARE_SELECTED_SOURCE_REPRESENTATION,
  QUICK_COMPARE_FULFILLMENT_FACTS_REPRESENTATION,
] as const;

export type QuickCompareWireRepresentation =
  (typeof QUICK_COMPARE_WIRE_REPRESENTATIONS)[number];

/** The format every picker definition revision is written in: version, then a 16-hex hash. */
export const QUICK_COMPARE_PICKER_DEFINITION_REVISION_VERSION =
  "quick-compare-picker-definition-v1";
export const QUICK_COMPARE_PICKER_DEFINITION_REVISION_PATTERN = new RegExp(
  `^${QUICK_COMPARE_PICKER_DEFINITION_REVISION_VERSION}:[a-f0-9]{16}$`
);

export const QUICK_COMPARE_PICKER_SELECTION_AUTHORITY_VERSION =
  "quick-compare-picker-selection-v1" as const;

export const QUICK_COMPARE_WIRE_CONTRACT_NAMES = [
  "full-comparison",
  "picker-bootstrap",
  "picker-revision",
  "market-patch",
  "selected-source",
  "fulfillment-facts",
  "destination-quote",
  "resolved-destination-offer",
  "resolved-comparison-offer",
] as const;

export type QuickCompareWireContractName =
  (typeof QUICK_COMPARE_WIRE_CONTRACT_NAMES)[number];
