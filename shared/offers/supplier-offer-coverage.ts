export const SUPPLIER_OFFER_COVERAGE_STATUSES = [
  "active",
  "confirmed-unavailable",
  "missing",
  "unknown",
] as const;

export type SupplierOfferCoverageStatus =
  (typeof SUPPLIER_OFFER_COVERAGE_STATUSES)[number];

export const SUPPLIER_OFFER_COVERAGE_AUTHORITIES = [
  "authoritative",
  "observed",
  "derived",
  "non-authoritative",
] as const;

export type SupplierOfferCoverageAuthority =
  (typeof SUPPLIER_OFFER_COVERAGE_AUTHORITIES)[number];

export const SUPPLIER_OFFER_COVERAGE_SCOPES = [
  "complete",
  "partial",
  "sample",
  "failed",
  "stale",
  "cache-miss",
  "backfill",
] as const;

export type SupplierOfferCoverageScope =
  (typeof SUPPLIER_OFFER_COVERAGE_SCOPES)[number];

export const SUPPLIER_OFFER_COVERAGE_FRESHNESS = [
  "current",
  "stale",
  "unknown",
] as const;

export type SupplierOfferCoverageFreshness =
  (typeof SUPPLIER_OFFER_COVERAGE_FRESHNESS)[number];

export const SUPPLIER_OFFER_COVERAGE_SOURCES = [
  "variant-pipeline",
  "catalog-lifecycle",
  "migration-backfill",
] as const;

export type SupplierOfferCoverageSource =
  (typeof SUPPLIER_OFFER_COVERAGE_SOURCES)[number];

export const SUPPLIER_OFFER_COVERAGE_REASON_CODES = [
  "offers-observed",
  "supplier-confirmed-unavailable",
  "authoritative-catalog-missing",
  "product-retired",
  "zero-usable-offers",
  "partial-provider-scope",
  "sample-scope",
  "run-failed",
  "stale-source",
  "cache-miss",
  "invalid-source-payload",
  "run-interrupted",
  "backfill-active-variants",
  "backfill-zero-variants",
  "backfill-lifecycle",
] as const;

export type SupplierOfferCoverageReasonCode =
  (typeof SUPPLIER_OFFER_COVERAGE_REASON_CODES)[number];

export type SupplierOfferCoverageEvidence = {
  status: SupplierOfferCoverageStatus;
  authority: SupplierOfferCoverageAuthority;
  scope: SupplierOfferCoverageScope;
  freshness: SupplierOfferCoverageFreshness;
  reasonCode: SupplierOfferCoverageReasonCode;
  variantCount: number | null;
};

export type SupplierOfferCoverageSnapshot = SupplierOfferCoverageEvidence & {
  supplierId: string;
  productId: string;
  runId: string | null;
  jobId: string | null;
  observedAt: Date | string;
  sourceObservedAt: Date | string | null;
  expiresAt: Date | string | null;
};

type VariantOfferCoverageUnknownReason = Extract<
  SupplierOfferCoverageReasonCode,
  | "zero-usable-offers"
  | "partial-provider-scope"
  | "sample-scope"
  | "run-failed"
  | "stale-source"
  | "cache-miss"
  | "invalid-source-payload"
  | "run-interrupted"
  | "backfill-zero-variants"
>;

export type VariantOfferCoverageInput = {
  variantCount: number;
  scope: SupplierOfferCoverageScope;
  freshness?: SupplierOfferCoverageFreshness;
  zeroResult?: "supplier-confirmed-unavailable" | "unknown";
  unknownReason?: VariantOfferCoverageUnknownReason;
};

/**
 * Converts a variant-pipeline result into coverage evidence. Positive rows are
 * observable in any run scope. A zero result proves unavailability only when
 * the caller explicitly supplies complete, current, supplier-confirmed proof.
 */
export function deriveVariantOfferCoverage(
  input: VariantOfferCoverageInput
): SupplierOfferCoverageEvidence {
  if (!Number.isInteger(input.variantCount) || input.variantCount < 0) {
    throw new RangeError("Supplier offer variantCount must be a non-negative integer.");
  }

  const freshness = input.freshness ?? "current";
  if (input.variantCount > 0) {
    return {
      status: "active",
      authority: "observed",
      scope: input.scope,
      freshness,
      reasonCode: "offers-observed",
      variantCount: input.variantCount,
    };
  }

  if (input.zeroResult === "supplier-confirmed-unavailable") {
    if (input.scope !== "complete" || freshness !== "current") {
      throw new Error(
        "Confirmed unavailability requires complete, current supplier evidence."
      );
    }
    return {
      status: "confirmed-unavailable",
      authority: "authoritative",
      scope: "complete",
      freshness: "current",
      reasonCode: "supplier-confirmed-unavailable",
      variantCount: 0,
    };
  }

  return {
    status: "unknown",
    authority: input.scope === "backfill" ? "derived" : "non-authoritative",
    scope: input.scope,
    freshness,
    reasonCode: input.unknownReason ?? defaultUnknownReason(input.scope),
    variantCount: 0,
  };
}

export function authoritativeMissingOfferCoverage(): SupplierOfferCoverageEvidence {
  return {
    status: "missing",
    authority: "authoritative",
    scope: "complete",
    freshness: "current",
    reasonCode: "authoritative-catalog-missing",
    variantCount: null,
  };
}

export function authoritativeRetiredOfferCoverage(): SupplierOfferCoverageEvidence {
  return {
    status: "confirmed-unavailable",
    authority: "authoritative",
    scope: "complete",
    freshness: "current",
    reasonCode: "product-retired",
    variantCount: 0,
  };
}

function defaultUnknownReason(
  scope: SupplierOfferCoverageScope
): VariantOfferCoverageUnknownReason {
  switch (scope) {
    case "partial":
      return "partial-provider-scope";
    case "sample":
      return "sample-scope";
    case "failed":
      return "run-failed";
    case "stale":
      return "stale-source";
    case "cache-miss":
      return "cache-miss";
    case "backfill":
      return "backfill-zero-variants";
    case "complete":
      return "zero-usable-offers";
  }
}

/**
 * Current coverage is an effective projection, not merely the newest attempt.
 * Unknown or stale observations stay in history. Stale evidence never advances
 * the current projection, and unknown evidence cannot displace a prior positive
 * or authoritative absence observation.
 */
export function shouldReplaceCurrentOfferCoverage(
  current: Pick<SupplierOfferCoverageEvidence, "status" | "freshness"> | null,
  incoming: Pick<SupplierOfferCoverageEvidence, "status" | "freshness">
): boolean {
  if (incoming.freshness !== "current") return false;
  if (!current) return true;
  return incoming.status !== "unknown" || current.status === "unknown";
}
