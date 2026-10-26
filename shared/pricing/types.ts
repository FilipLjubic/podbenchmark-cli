import type { Destination } from "../runtime/enums";
import type { Currency } from "../runtime/fx/types";
import type { z } from "zod";
import type {
  RelativeRatesPolicyModelSchema,
  PrintfulTieredPolicyModelSchema,
  SupplierCurrencyPolicyModelSchema,
  SupplierCurrencyPolicySchema,
} from "./schema";
import type { PriceAuthority, StoredPriceOrigin } from "./authority";
import type { SupplierPricingContext } from "./required-charges";
import type { SupplierDutyEstimate, SupplierDutyEstimateProjection } from "./duty";


export const PRICING_TIER_KEYS = ["base", "tier1", "tier2"] as const;
export type PricingTierKey = (typeof PRICING_TIER_KEYS)[number];

export type RelativeRatesPolicyModel = z.infer<typeof RelativeRatesPolicyModelSchema>;
export type PrintfulTieredPolicyModel = z.infer<typeof PrintfulTieredPolicyModelSchema>;
export type SupplierCurrencyPolicyModel = z.infer<typeof SupplierCurrencyPolicyModelSchema>;
export type SupplierCurrencyPolicy = z.infer<typeof SupplierCurrencyPolicySchema>;

export type ProjectablePriceFields = {
  selectedBasePrice: number;
  selectedShippingPrice: number | null;
  /** Separate supplier-billed duty; null means unknown, never zero. */
  selectedDutyPrice: number | null;
  /** Product + shipping comparison amount, excluding separate duty. */
  selectedTotalPrice: number;
  selectedTier1Price: number | null;
  selectedTier2Price: number | null;
  minBasePrice: number;
  maxBasePrice: number;
  minShippingPrice: number;
  maxShippingPrice: number;
  minTotalPrice: number;
  maxTotalPrice: number;
};

/**
 * A supplier's lowest product + shipping offer for one print technology, at
 * that technology's comparable decoration, with known shipping. Kept as
 * components so a currency projection converts it like the selected offer.
 */
export type PrintTechnologyOffer = {
  basePrice: number;
  shippingPrice: number;
  dutyPrice: number | null;
  /** Native bounded duty belongs to this method's concrete winner. */
  dutyEstimate?: SupplierDutyEstimate | null;
  /** This method winner's own context; never the summary's other selection. */
  pricingContext?: SupplierPricingContext;
};
export type PrintTechnologyOffers = Record<string, PrintTechnologyOffer>;
/** Product + shipping per technology; a technology without one is unknown. */
export type PrintTechnologyTotals = Record<string, number>;

/**
 * A supplier's lowest comparable product + shipping offer per technology,
 * whether or not its price holds only under a stated design history. Separate
 * from `PrintTechnologyOffer`, which stays unconditional. It carries its own
 * price origin because a method's authority is independent of the summary's.
 * `decorationRank` is the within-method rank that chose it.
 */
export type PrintTechnologyDisplayOffer = PrintTechnologyOffer & {
  variantId: string;
  priceOrigin: StoredPriceOrigin;
  decorationRank: number;
  decorationToken: string | null;
};
export type PrintTechnologyDisplayOffers = Record<
  string,
  PrintTechnologyDisplayOffer
>;

/**
 * A display offer converted to the projection currency. The total may rest on
 * `pricingContext`; its setup fees stay in the supplier's own currency.
 */
export type PrintTechnologyDisplayPrice = {
  totalPrice: number;
  dutyEstimate?: SupplierDutyEstimateProjection | null;
  variantId: string;
  pricingContext?: SupplierPricingContext;
  decorationRank: number;
  decorationToken: string | null;
  provenance: PriceProjectionProvenance;
};
export type PrintTechnologyDisplayPrices = Record<
  string,
  PrintTechnologyDisplayPrice
>;

export type StoredPriceCandidate = ProjectablePriceFields & {
  printTechnologyOffers?: PrintTechnologyOffers;
  printTechnologyDisplayOffers?: PrintTechnologyDisplayOffers;
  productSummaryId: string;
  productId: string;
  productName: string;
  supplierId: string;
  destination: Destination;
  currency: Currency;
  selectedVariantId: string;
  authority: PriceAuthority;
  priceSource: string;
  sourceCurrency: Currency;
  pricePolicyId: string | null;
  pricePolicyVersion: string | null;
  roundingPolicyId: string | null;
  fxSnapshotId: string | null;
};

export type PriceProjectionProvenance = {
  authority: PriceAuthority;
  priceSource: string;
  sourceCurrency: Currency;
  sourceProductSummaryId: string;
  supplierCurrencyPolicySnapshotId: string | null;
  supplierPolicyId: string | null;
  supplierPolicyVersion: string | null;
  fxSnapshotId: string | null;
  roundingPolicyId: string | null;
  effectiveRate: number;
};

export type DisplayPriceProjection = ProjectablePriceFields & {
  minTotalPriceByPrintTechnology: PrintTechnologyTotals;
  printTechnologyDisplayPrices: PrintTechnologyDisplayPrices;
  productId: string;
  supplierId: string;
  destination: Destination;
  currency: Currency;
  selectedVariantId: string;
  provenance: PriceProjectionProvenance;
};
