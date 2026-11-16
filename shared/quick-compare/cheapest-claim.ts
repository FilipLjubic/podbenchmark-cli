/**
 * The one rule for whether a comparison may name a cheapest supplier.
 *
 * Quick Compare's presenter, the supplier price analysis and every other
 * surface that says "cheapest", "lowest" or "wins" decide through this module,
 * never from their own minimum. Prices stay visible whatever the answer; only
 * the winner wording depends on it.
 */
import type { OptionFit } from "../offers/comparison-offer";
import type { QuickCompareRow } from "./contract";

/** How many items one price buys: a plain offer, a stated count, or an unknown count. */
export type PurchaseBasis =
  | { kind: "plain-offer" }
  | { kind: "stated-count"; count: number }
  | { kind: "unavailable" };

export function purchaseBasisOf(
  row: Pick<QuickCompareRow, "pricedBasis">
): PurchaseBasis {
  const quantity = row.pricedBasis?.quantity;
  if (!quantity) return { kind: "plain-offer" };
  return quantity.state === "count"
    ? { kind: "stated-count", count: quantity.count }
    : { kind: "unavailable" };
}

export function purchaseBasesShareCount(
  left: PurchaseBasis,
  right: PurchaseBasis
): boolean {
  if (left.kind === "unavailable" || right.kind === "unavailable")
    return left.kind === right.kind;
  if (left.kind === "plain-offer" && right.kind === "plain-offer") return true;
  if (left.kind === "stated-count" && right.kind === "stated-count")
    return left.count === right.count;
  // Plain single-offer products retain comparison with an explicit count of one.
  return (
    (left.kind === "stated-count"
      ? left.count
      : right.kind === "stated-count"
        ? right.count
        : null) === 1
  );
}

/** A back print or embroidery price is for a decoration other than the standard print. */
export function hasPrintDecorationFallback(optionFit: OptionFit): boolean {
  return optionFit.differences.some(
    difference => difference.fallbackFactor?.kind === "print-decoration"
  );
}

export type CheapestClaimOffer = {
  /** Delivered total (product + shipping); null when unknown. */
  total: number | null;
  currency: string | null;
  purchase: PurchaseBasis;
  /** False when the price is for a decoration other than the standard print. */
  pricesStandardDecoration: boolean;
  /** A listing the catalog maps closest never sets a cheapest claim. */
  isClosestMapped: boolean;
};

export type CheapestClaim = {
  canCompareTotals: boolean;
  canHighlightCheapest: boolean;
  /** Offers that may take part in a cheapest claim. */
  comparableCount: number;
  lowestTotal: number | null;
  /** In input order. */
  offers: readonly {
    /** Priced for the same count of items as every other priced offer it is compared with. */
    sharesPurchaseCount: boolean;
    /** Priced, standard, exact and sharing a count: may take part in the claim. */
    comparable: boolean;
    /** The comparison may name a winner and this offer holds the lowest total. */
    isCheapest: boolean;
  }[];
};

/**
 * A price for a known bundle never competes with a price for a different or
 * unstated count; a back print or embroidery keeps its price on screen but
 * never competes with front prints. Two or more comparable offers in one
 * currency, with no conditional price among them, may name a winner.
 */
export function resolveCheapestClaim(
  offers: readonly CheapestClaimOffer[],
  options: { hasConditionalPrice: boolean }
): CheapestClaim {
  const sharing = sharedPurchaseCounts(offers);
  const comparable = offers.map(
    (offer, index) =>
      offer.total !== null &&
      offer.purchase.kind !== "unavailable" &&
      offer.pricesStandardDecoration &&
      !offer.isClosestMapped &&
      sharing[index] === true
  );
  const comparableOffers = offers.filter((_, index) => comparable[index]);
  const currencies = new Set(
    comparableOffers.flatMap(offer =>
      offer.currency === null ? [] : [offer.currency]
    )
  );
  const canCompareTotals = currencies.size <= 1 && !options.hasConditionalPrice;
  const canHighlightCheapest = canCompareTotals && comparableOffers.length >= 2;
  const totals = comparableOffers.flatMap(offer =>
    offer.total === null ? [] : [offer.total]
  );
  const lowestTotal = canHighlightCheapest ? Math.min(...totals) : null;
  return {
    canCompareTotals,
    canHighlightCheapest,
    comparableCount: comparableOffers.length,
    lowestTotal,
    offers: offers.map((offer, index) => ({
      sharesPurchaseCount: sharing[index] === true,
      comparable: comparable[index] === true,
      isCheapest:
        canHighlightCheapest &&
        comparable[index] === true &&
        offer.total === lowestTotal,
    })),
  };
}

function sharedPurchaseCounts(
  offers: readonly CheapestClaimOffer[]
): boolean[] {
  const priced = offers.filter(offer => offer.total !== null);
  const singleOffers = priced.filter(
    offer =>
      offer.purchase.kind !== "stated-count" || offer.purchase.count === 1
  );
  const singleBasis = singleOffers[0]?.purchase;
  const singleOffersShareBasis =
    singleBasis !== undefined &&
    singleOffers.every(offer =>
      purchaseBasesShareCount(singleBasis, offer.purchase)
    );
  return offers.map(offer => {
    if (offer.total === null) return true;
    return offer.purchase.kind !== "stated-count" || offer.purchase.count === 1
      ? singleOffersShareBasis
      : priced.every(other =>
          purchaseBasesShareCount(offer.purchase, other.purchase)
        );
  });
}
