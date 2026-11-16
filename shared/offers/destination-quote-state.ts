import { deriveOfferAvailability } from "./offer-availability";
import type { PriceAuthority } from "../pricing/authority";

export const DESTINATION_QUOTE_STATES = [
  "quoted",
  "confirmed-unavailable",
  "incomplete",
  "unsupported",
  "error",
  "unknown",
  "stale",
] as const;

export type DestinationQuoteState =
  (typeof DESTINATION_QUOTE_STATES)[number];

export const DESTINATION_QUOTE_ATTEMPT_OUTCOMES = [
  "quoted",
  "confirmed-unavailable",
  "incomplete",
  "unsupported",
  "error",
] as const;

export type DestinationQuoteAttemptOutcome =
  (typeof DESTINATION_QUOTE_ATTEMPT_OUTCOMES)[number];

export const DESTINATION_QUOTE_PROVENANCES = [
  "direct-api",
  "catalog-api",
  "catalog-table",
  "scraped-page",
  "derived-model",
  "fallback-estimate",
  "legacy-summary",
] as const;

export type DestinationQuoteProvenance =
  (typeof DESTINATION_QUOTE_PROVENANCES)[number];

export const DESTINATION_QUOTE_REASON_CODES = [
  "direct-quote",
  "destination-fallback-estimate",
  "product-inactive",
  "pricing-incomplete",
  "destination-quote-missing",
  "not-attempted",
  "base-price-missing",
  "shipping-price-missing",
  "currency-missing",
  "suspicious-shipping",
  "source-marked-stale",
  "source-expired",
  "supplier-confirmed-unavailable",
  "destination-unsupported",
  "variant-unavailable",
  "request-failed",
  "request-timeout",
  "rate-limited",
  "authentication-failed",
  "malformed-response",
] as const;

export type DestinationQuoteReasonCode =
  (typeof DESTINATION_QUOTE_REASON_CODES)[number];

export type DestinationQuoteSource =
  | "product-summary"
  | "product-variant"
  | "destination-fallback"
  | "quote-attempt"
  | "product-lifecycle"
  | "product-pricing";

/**
 * Normalized read-model outcome for one product, destination, and selected
 * option context. `unknown` is deliberately distinct from a supplier-confirmed
 * absence so missing rows never silently become "unavailable".
 */
export type DestinationQuoteOutcome = {
  state: DestinationQuoteState;
  reasonCode: DestinationQuoteReasonCode;
  source: DestinationQuoteSource;
  observedAt: string | null;
  authority: PriceAuthority | null;
  /** Always present for persisted evidence; optional on legacy in-memory fixtures. */
  provenance?: DestinationQuoteProvenance | null;
  requestedDestination: string;
  sourceDestination: string | null;
};

export type DestinationQuoteAttemptEvidence = {
  id: string;
  outcome: DestinationQuoteAttemptOutcome;
  reasonCode: DestinationQuoteReasonCode;
  provenance: DestinationQuoteProvenance;
  priceAuthority: PriceAuthority | null;
  destination: string;
  attemptedAt: string;
  observedAt: string | null;
  expiresAt: string | null;
};

type DeriveDestinationQuoteOutcomeInput = {
  lifecycleStatus: string;
  pricingComplete: boolean;
  requestedDestination: string;
  sourceDestination: string | null;
  isDestinationFallback: boolean;
  hasQuoteRow: boolean;
  basePrice: number | null;
  shippingPrice: number | null;
  currency: string | null;
  observedAt: string | null;
  authority: PriceAuthority | null;
  source?: Extract<DestinationQuoteSource, "product-summary" | "product-variant">;
  suspiciousShipping?: boolean;
};

export function deriveDestinationQuoteOutcome(
  input: DeriveDestinationQuoteOutcomeInput
): DestinationQuoteOutcome {
  const base = {
    observedAt: input.observedAt,
    authority: input.authority,
    provenance: null,
    requestedDestination: input.requestedDestination,
    sourceDestination: input.sourceDestination,
  };

  if (deriveOfferAvailability(input.lifecycleStatus, null, null).reason === "retired") {
    return {
      ...base,
      state: "confirmed-unavailable",
      reasonCode: "product-inactive",
      source: "product-lifecycle",
    };
  }

  if (input.lifecycleStatus !== "active") return {
    ...base, state: "unknown", reasonCode: "product-inactive", source: "product-lifecycle",
  };

  if (!input.hasQuoteRow) {
    return input.pricingComplete
      ? {
          ...base,
          state: "unknown",
          reasonCode: "destination-quote-missing",
          source: "product-pricing",
        }
      : {
          ...base,
          state: "incomplete",
          reasonCode: "pricing-incomplete",
          source: "product-pricing",
        };
  }

  if (input.basePrice === null) {
    return {
      ...base,
      state: "incomplete",
      reasonCode: "base-price-missing",
      source: input.source ?? "product-summary",
      provenance: "legacy-summary",
    };
  }

  if (input.suspiciousShipping) {
    return {
      ...base,
      state: "incomplete",
      reasonCode: "suspicious-shipping",
      source: input.source ?? "product-summary",
      provenance: "legacy-summary",
    };
  }

  if (input.shippingPrice === null) {
    return {
      ...base,
      state: "incomplete",
      reasonCode: "shipping-price-missing",
      source: input.source ?? "product-summary",
      provenance: "legacy-summary",
    };
  }

  if (input.currency === null) {
    return {
      ...base,
      state: "incomplete",
      reasonCode: "currency-missing",
      source: input.source ?? "product-summary",
      provenance: "legacy-summary",
    };
  }

  if (input.isDestinationFallback) {
    return {
      ...base,
      state: "quoted",
      reasonCode: "destination-fallback-estimate",
      source: "destination-fallback",
      provenance: "fallback-estimate",
    };
  }

  return {
    ...base,
    state: "quoted",
    reasonCode: "direct-quote",
    source: input.source ?? "product-summary",
    provenance: "legacy-summary",
  };
}

/**
 * Converts the latest persisted attempt for an exact quote context into the
 * supplier-neutral outcome consumed by runtime selection. Observation and
 * optional expiry timestamps are provenance only; time does not rewrite the
 * supplier outcome.
 */
export function deriveDestinationQuoteOutcomeFromAttempt(input: {
  attempt: DestinationQuoteAttemptEvidence | null;
  requestedDestination: string;
}): DestinationQuoteOutcome {
  const attempt = input.attempt;
  if (!attempt) {
    return {
      state: "unknown",
      reasonCode: "not-attempted",
      source: "quote-attempt",
      observedAt: null,
      authority: null,
      provenance: null,
      requestedDestination: input.requestedDestination,
      sourceDestination: null,
    };
  }

  const observedAt = attempt.observedAt ?? attempt.attemptedAt;
  return {
    state: attempt.outcome,
    reasonCode: attempt.reasonCode,
    source: "quote-attempt",
    observedAt,
    authority: attempt.priceAuthority,
    provenance: attempt.provenance,
    requestedDestination: input.requestedDestination,
    sourceDestination: attempt.destination,
  };
}
