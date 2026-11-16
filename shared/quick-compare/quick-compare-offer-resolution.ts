import type { PriceAuthority } from "../pricing/authority";
import { compareNullableNumbers, compareUtf8Bytes } from "../kernel/canonical-order";
import type {
  DestinationOffer,
  OptionFit,
  OptionFitKind,
  RequestedOption,
  ResolvedComparisonOffer,
  ResolutionDecidingFactor,
} from "../offers/comparison-offer";
import type { DestinationQuoteOutcome } from "../offers/destination-quote-state";
import type {
  OfferSemanticBand,
  OfferSemanticFitness,
} from "../options/offer-semantic-fitness";
import { compareSelectedSourceVariantOptionFit } from "../options/selected-source-variant-matching";

const OPTION_FIT_PRIORITY: Record<OptionFitKind, number> = {
  exact: 0,
  equivalent: 1,
  defaulted: 2,
  closest: 3,
  unresolved: 4,
  incompatible: 5,
};

/** UI provenance only; it never participates in offer identity or ranking. */
export type QuickCompareSelectionIntent = "none" | "implicit" | "explicit";

/** The only same-supplier winner selector. */
export function resolveComparisonOffer(input: {
  readonly requestedOption: RequestedOption;
  readonly offers: readonly DestinationOffer[];
}): ResolvedComparisonOffer {
  const orderedOffers = [...input.offers].sort(compareDestinationOffers);
  const selectedOffer = orderedOffers[0] ?? null;
  return {
    requestedOption: input.requestedOption,
    selectedOffer,
    orderedOffers,
    decidingFactor: resolveDecidingFactor(selectedOffer, orderedOffers[1] ?? null),
  };
}

/** Policy order: option fit, current P+S quote, comparison price, delivery, identity. */
function compareDestinationOffers(
  left: DestinationOffer,
  right: DestinationOffer
): number {
  const fitTierDifference =
    OPTION_FIT_PRIORITY[left.optionFit.kind] -
    OPTION_FIT_PRIORITY[right.optionFit.kind];
  if (fitTierDifference !== 0) return fitTierDifference;

  const fitFactorDifference = compareSelectedSourceVariantOptionFit(
    left.optionFit.optionComparisons ?? left.optionFit.differences,
    right.optionFit.optionComparisons ?? right.optionFit.differences
  );
  if (fitFactorDifference !== 0) return fitFactorDifference;

  const currentQuoteDifference =
    currentComparableQuotePriority(left) -
    currentComparableQuotePriority(right);
  if (currentQuoteDifference !== 0) return currentQuoteDifference;

  if (
    hasCurrentComparableQuote(left) &&
    hasCurrentComparableQuote(right) &&
    left.price.deliveredTotal !== right.price.deliveredTotal
  ) {
    return left.price.deliveredTotal - right.price.deliveredTotal;
  }

  const deliveryDifference = compareNullableNumbers(
    left.delivery.daysMax,
    right.delivery.daysMax
  );
  if (deliveryDifference !== 0) return deliveryDifference;

  return compareUtf8Bytes(left.offerId, right.offerId);
}

/** Only current quoted totals may make cheapest/lowest/from claims. */
export function hasCurrentComparableQuote(
  offer: DestinationOffer
): offer is DestinationOffer & {
  readonly price: DestinationOffer["price"] & {
    readonly deliveredTotal: number;
  };
} {
  return offer.price.deliveredTotal !== null && offer.quote.state === "quoted";
}

export function canSetCurrentComparisonPriceClaim(
  requestedOption: RequestedOption,
  offer: DestinationOffer
): boolean {
  if (!hasCurrentComparableQuote(offer)) return false;
  return (
    requestedOption.kind === "summary" ||
    offer.optionFit.kind === "exact" ||
    offer.optionFit.kind === "equivalent" ||
    offer.optionFit.kind === "defaulted" ||
    offer.optionFit.kind === "closest"
  );
}

function currentComparableQuotePriority(offer: DestinationOffer): number {
  return hasCurrentComparableQuote(offer) ? 0 : 1;
}

function resolveDecidingFactor(
  selected: DestinationOffer | null,
  runnerUp: DestinationOffer | null
): ResolutionDecidingFactor {
  if (!selected) return "none";
  if (!runnerUp) return "only-offer";
  if (selected.optionFit.kind !== runnerUp.optionFit.kind) return "option-fit";
  if (
    compareSelectedSourceVariantOptionFit(
      selected.optionFit.optionComparisons ?? selected.optionFit.differences,
      runnerUp.optionFit.optionComparisons ?? runnerUp.optionFit.differences
    ) !== 0
  ) {
    return "option-fit-factor";
  }
  if (
    hasCurrentComparableQuote(selected) !==
    hasCurrentComparableQuote(runnerUp)
  ) {
    return "current-comparable-quote";
  }
  if (
    hasCurrentComparableQuote(selected) &&
    hasCurrentComparableQuote(runnerUp) &&
    selected.price.deliveredTotal !== runnerUp.price.deliveredTotal
  ) {
    return "comparison-price";
  }
  if (selected.delivery.daysMax !== runnerUp.delivery.daysMax) {
    return "delivery-estimate";
  }
  return "offer-id";
}

type QuickCompareDecisionOptionFit =
  | "summary"
  | "exact"
  | "equivalent"
  | "defaulted"
  | "fallback"
  | "unavailable";

type QuickCompareOfferDecisionRejectionCode =
  | "semantic-reject"
  | "quote-not-quoted"
  | "incomplete-active-tier-quote"
  | "selected-option-unavailable"
  | "substituted-option-suppressed";

export type QuickCompareOfferDecision = {
  id: string;
  stableKey: string;
  fallbackStableKey: string;
  eligible: boolean;
  rejectionCodes: QuickCompareOfferDecisionRejectionCode[];
  semanticBand: OfferSemanticBand;
  semanticEvidence: OfferSemanticFitness["evidence"];
  semanticReasons: OfferSemanticFitness["reasons"];
  optionFit: QuickCompareDecisionOptionFit;
  selectionIntent: QuickCompareSelectionIntent;
  quoteState: DestinationQuoteOutcome["state"];
  quoteReasonCode: DestinationQuoteOutcome["reasonCode"];
  quoteSource: DestinationQuoteOutcome["source"];
  quoteProvenance?: DestinationQuoteOutcome["provenance"];
  quoteObservedAt?: string | null;
  hasCompleteActiveTierQuote: boolean;
  priceAuthority: PriceAuthority | null;
  totalPrice: number | null;
  deliveryDaysMax: number | null;
  shippingType: string | null;
  shippingPriceSource: string | null;
  providerScore: number | null;
};

type QuickCompareOfferResolutionDecision = QuickCompareOfferDecision & {
  order: number;
  alignment: OptionFit;
  deliveredTotal: number | null;
};

export type QuickCompareOfferResolutionResult = {
  selectedId: string | null;
  mode: "alignment-first" | "none";
  confidence: "high" | "medium" | "low" | "none";
  reasonCodes: string[];
  decisions: QuickCompareOfferResolutionDecision[];
};

