import type { QuickComparePricingTierKey } from "../quick-compare/contract";
import type { PurchaseBasis } from "../quick-compare/cheapest-claim";
import type { Destination } from "../kernel/enums";
import type { Currency } from "../market/fx/types";
import type { RepresentativeOptionStatus } from "../options/representative-option";
import type { PriceAuthority } from "../pricing/authority";
import type { SupplierDutyEstimateProjection } from "../pricing/duty";
import { isConditionalSupplierPricingContext } from "../pricing/pricing-context";
import type { SupplierPricingContext } from "../pricing/required-charges";
import type {
  DestinationQuoteProvenance,
  DestinationQuoteSource,
} from "../offers/destination-quote-state";

import type { z } from "zod";
import type { PricingTierKey } from "../pricing/types";
import type { supplierPriceAnalysisOptionsSchema } from "./options-schema";

export type SupplierPriceAnalysisOptions = z.input<
  typeof supplierPriceAnalysisOptionsSchema
>;
export type SupplierPriceAnalysisSettings = z.output<
  typeof supplierPriceAnalysisOptionsSchema
>;

/** A tie within this amount of the market currency counts as "close". */
export const DEFAULT_SUPPLIER_PRICE_TOLERANCE = {
  kind: "currency",
  amount: 1,
} as const;

/** Options with every default applied; the analysis reads only this shape. */
export function resolveSupplierPriceAnalysisSettings(
  options: SupplierPriceAnalysisOptions
): SupplierPriceAnalysisSettings {
  const base: PricingTierKey = "base";
  return {
    supplierId: options.supplierId?.trim(),
    competitorId: options.competitorId?.trim() ?? null,
    selectedSupplierTier: options.selectedSupplierTier ?? base,
    selectedProductDiscountPercent: options.selectedProductDiscountPercent ?? 0,
    competitorTier: options.competitorTier ?? base,
    categorySlug: options.categorySlug?.trim() ?? null,
    search: options.search?.trim() ?? "",
    tolerance: options.tolerance ?? DEFAULT_SUPPLIER_PRICE_TOLERANCE,
    pageSize: options.pageSize ?? 10,
    cheapestOffset: options.cheapestOffset ?? 0,
    cheaperElsewhereOffset: options.cheaperElsewhereOffset ?? 0,
  };
}

export type SupplierPriceAnalysisCategory = {
  id: string;
  slug: string;
  name: string;
  parentId: string | null;
};

/** A single coherent, currently quoted, exact/equivalent Quick Compare offer. */
export type SupplierPriceAnalysisOffer = {
  supplierId: string;
  productId: string;
  variantId: string;
  variantProfileId: string;
  provider: { id: string; name: string } | null;
  optionFit: "exact" | "equivalent";
  /** How many items this price buys; a winner needs the same count on both sides. */
  purchaseBasis: PurchaseBasis;
  /** False when the price is for a decoration other than the standard print. */
  pricesStandardDecoration: boolean;
  requestedTier: QuickComparePricingTierKey;
  appliedTier: QuickComparePricingTierKey;
  tierLabel: string | null;
  usesBaseTierFallback: boolean;
  productPrice: number;
  shippingPrice: number;
  /** Separate from the product + shipping comparison amount; null is unknown. */
  dutyPrice?: number | null;
  /** Bounded duty when the exact amount is null; also separate from the comparison amount. */
  dutyEstimate?: SupplierDutyEstimateProjection | null;
  deliveredTotal: number;
  /** The supplier's delivery estimate for this offer, in days. */
  deliveryDaysMin: number | null;
  deliveryDaysMax: number | null;
  /** Where the offer is produced, e.g. “GB”; absent in older snapshots. */
  fulfillmentRegion?: string | null;
  priceAuthority: PriceAuthority | null;
  quoteSource: DestinationQuoteSource;
  quoteProvenance: DestinationQuoteProvenance | null;
  shippingPriceSource: string | null;
  checkedAt: string | null;
  sourceUrl: string;
  /**
   * The design basis this offer's price holds for, kept so the price is never
   * read without it. Present means the price is conditional.
   */
  pricingContext?: SupplierPricingContext;
};

/**
 * A conditional price states a basis (an existing supplier design) that the
 * win/loss counts, gaps, medians and pair tables cannot repeat. Those
 * comparisons leave it out rather than present it as a plain delivered price.
 */
export function isConditionalPriceOffer(
  offer: Pick<SupplierPriceAnalysisOffer, "pricingContext">
): boolean {
  return isConditionalSupplierPricingContext(offer.pricingContext);
}

type SupplierPriceAnalysisReference = {
  optionKey: string;
  label: string;
  values: { field: string; normalizedValue: string; label: string }[];
  policyId: string;
  policyVersion: string;
  inputFingerprint: string;
};

export type SupplierPriceAnalysisEvidence =
  | {
      status: "excluded";
      reason: "no-other-exact-supplier" | "no-shared-reference";
      representativeStatus: RepresentativeOptionStatus | null;
    }
  | {
      status: "resolved";
      reference: SupplierPriceAnalysisReference;
      offersByTier: Record<
        QuickComparePricingTierKey,
        SupplierPriceAnalysisOffer[]
      >;
    };

export type SupplierPriceAnalysisProduct = {
  canonicalId: string;
  name: string;
  image: string;
  /** Existing public comparison route, or null when no navigable category exists. */
  href: string | null;
  /** All assigned categories and ancestors, unique within this product. */
  categorySlugs: string[];
  mappedSupplierIds: string[];
  evidence: SupplierPriceAnalysisEvidence;
};

/**
 * Build/research input, not a persistent quote or an HTTP response cache.
 * One database snapshot supplies every tier, filter, category and product page.
 */
export type SupplierPriceAnalysisCohort = {
  schemaVersion: 4;
  id: string;
  readAt: string;
  /** Null prepares all suppliers once; a value restricts catalog discovery. */
  supplierId: string | null;
  destination: Destination;
  currency: Currency;
  suppliers: { id: string; name: string; logo: string | null }[];
  categories: SupplierPriceAnalysisCategory[];
  products: SupplierPriceAnalysisProduct[];
};

export type SupplierPriceComparison = {
  canonicalId: string;
  name: string;
  image: string;
  href: string | null;
  categorySlugs: string[];
  reference: SupplierPriceAnalysisReference;
  selectedOffer: SupplierPriceAnalysisOffer;
  competitorOffer: SupplierPriceAnalysisOffer;
  comparableSupplierIds: string[];
  outcome: "win" | "tie" | "loss";
  absoluteGap: number;
  /** (S - C) / C * 100; null when C is zero. */
  premiumOverCompetitorPercent: number | null;
  /** S - min(S, C); pair/all-covered scope comes from result.context. */
  premiumOverLowest: number;
  premiumOverLowestPercent: number | null;
  withinTolerance: boolean;
};

export type SupplierPriceSummary = {
  comparedProductCount: number;
  outrightWinCount: number;
  tiedCheapestCount: number;
  lossCount: number;
  exactCheapestCount: number;
  nearCheapestLossCount: number;
  overToleranceLossCount: number;
  atOrWithinToleranceCount: number;
  exactCheapestShare: number | null;
  medianWinningGap: number | null;
  medianLosingGap: number | null;
  medianLossPremiumOverCompetitorPercent: number | null;
};

export const SUPPLIER_PRICE_CATEGORY_MINIMUM_PRODUCTS = 5;
