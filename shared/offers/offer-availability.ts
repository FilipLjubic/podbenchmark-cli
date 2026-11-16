import type { DestinationQuoteState } from "./destination-quote-state";
import type { SupplierOfferCoverageEvidence } from "./supplier-offer-coverage";

export type OfferAvailability =
  | { state: "available"; reason: "quote" | "coverage" }
  | { state: "retired"; reason: "retired" }
  | { state: "unavailable"; reason: "quote" | "coverage" }
  | {
      state: "unknown";
      reason: "missing" | "superseded" | "unobserved";
    };

/**
 * Exact usable quotes take precedence over older product-wide observations.
 * Coverage is read by its last observed status. Freshness only tells the
 * scraper what to refresh; an old observation never hides or relabels an offer.
 */
export function deriveOfferAvailability(
  lifecycle: string | null,
  coverage: Pick<SupplierOfferCoverageEvidence, "status"> | null,
  quote: DestinationQuoteState | null
): OfferAvailability {
  if (lifecycle === "retired") return { state: "retired", reason: "retired" };
  if (lifecycle === "superseded")
    return { state: "unknown", reason: "superseded" };
  if (lifecycle === "missing") return { state: "unknown", reason: "missing" };
  if (quote === "quoted") return { state: "available", reason: "quote" };
  if (quote === "confirmed-unavailable")
    return { state: "unavailable", reason: "quote" };
  if (coverage?.status === "active")
    return { state: "available", reason: "coverage" };
  if (coverage?.status === "confirmed-unavailable")
    return { state: "unavailable", reason: "coverage" };
  if (coverage?.status === "missing")
    return { state: "unknown", reason: "missing" };
  return { state: "unknown", reason: "unobserved" };
}
