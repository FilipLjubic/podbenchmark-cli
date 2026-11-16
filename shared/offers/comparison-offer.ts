import type { PricingTierKey } from "../pricing/types";
import type { ProductionEstimate } from "./production-estimate";
import type { SupplierDutyEstimateProjection } from "../pricing/duty";

import type { OfferTaxTreatment } from "../pricing/tax-treatment";
import type { PriceAuthority } from "../pricing/authority";
import type { SupplierPricingContext } from "../pricing/required-charges";
import type { DestinationQuoteOutcome } from "./destination-quote-state";
import type { ShippingType } from "../kernel/enums";
import type { Currency } from "../market/fx/types";
import type {
  SelectedSourceVariantFallbackFactor,
  SelectedSourceVariantFieldFit,
} from "../options/selected-source-variant-matching";

export const OPTION_FIT_KINDS = [
  "exact",
  "equivalent",
  "defaulted",
  "closest",
  "unresolved",
  "incompatible",
] as const;

export type OptionFitKind = (typeof OPTION_FIT_KINDS)[number];

export type RequestedOption =
  | { readonly kind: "summary" }
  | { readonly kind: "selected"; readonly optionKey: string };

export type OptionFit = {
  readonly kind: OptionFitKind;
  readonly differences: readonly SelectedSourceVariantFieldFit[];
  readonly optionComparisons?: readonly SelectedSourceVariantFieldFit[];
  readonly fallbackFactors?: readonly SelectedSourceVariantFallbackFactor[];
  readonly unknownFields: readonly string[];
  readonly reasonCodes: readonly string[];
};

export type DestinationOfferAvailability =
  | "available"
  | "stale"
  | "unavailable"
  | "unknown";

/** One coherent provider/variant/profile quote with no presentation metadata. */
export type DestinationOffer = {
  readonly offerId: string;
  readonly supplierId: string;
  readonly productId: string;
  readonly provider: {
    readonly id: string;
    readonly name: string;
    readonly score: number | null;
  } | null;
  readonly variantId: string | null;
  readonly selectedProfileId: string | null;
  /** Where this offer ships from: a country code or "EU"; null when unknown. */
  readonly fulfillmentRegion?: string | null;
  /** Countries that may ship it when no origin is stored; its receipt's route reads them. */
  readonly candidateOrigins?: readonly string[];
  readonly optionFit: OptionFit;
  readonly quote: DestinationQuoteOutcome;
  readonly availability: DestinationOfferAvailability;
  readonly price: {
    readonly currency: Currency | null;
    /**
     * The currency the supplier priced this offer in. It stays the original
     * across every conversion to `currency`; null means the offer never said.
     */
    readonly sourceCurrency?: Currency | null;
    /** Pricing context requested by the caller. */
    readonly tierKey: PricingTierKey;
    /** Concrete tier that supplied `product`, after an allowed fallback. */
    readonly appliedTierKey: PricingTierKey | null;
    readonly tierLabel: string | null;
    readonly usesBaseTierFallback: boolean;
    readonly product: number | null;
    readonly shipping: number | null;
    readonly duty: number | null;
    readonly dutyOutcome?: "charged" | "not_applicable" | "estimated" | "unknown" | null;
    readonly dutyEstimate?: SupplierDutyEstimateProjection | null;
    readonly dutySource?: { readonly amount: number; readonly currency: Currency } | null;
    /** Fixed comparison basis: product + shipping; duty is supplemental. */
    readonly deliveredTotal: number | null;
    readonly authority: PriceAuthority | null;
    readonly shippingType: ShippingType | null;
    readonly shippingSource: string | null;
  };
  readonly delivery: {
    readonly daysMin: number | null;
    readonly daysMax: number | null;
    readonly fulfillmentDays: number | null;
    readonly productionEstimate: ProductionEstimate | null;
  };
  readonly costTreatment?: OfferTaxTreatment;
  /**
   * The design basis this offer's own variant price holds for, with the
   * one-off charge the delivered total leaves out. Absent when the price
   * needs no such qualifier.
   */
  readonly pricingContext?: SupplierPricingContext;
};

export type ResolutionDecidingFactor =
  | "only-offer"
  | "option-fit"
  | "option-fit-factor"
  | "current-comparable-quote"
  | "comparison-price"
  | "delivery-estimate"
  | "offer-id"
  | "none";

export type ResolvedComparisonOffer = {
  readonly requestedOption: RequestedOption;
  readonly selectedOffer: DestinationOffer | null;
  readonly orderedOffers: readonly DestinationOffer[];
  readonly decidingFactor: ResolutionDecidingFactor;
};
