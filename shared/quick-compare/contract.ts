import type { QUICK_COMPARE_PICKER_SELECTION_AUTHORITY_VERSION } from "./wire/identifiers";
import type { PricingTierKey } from "../pricing/types";
import type { ProductionEstimate } from "../offers/production-estimate";
import type { SupplierDutyEstimateProjection } from "../pricing/duty";
import type {
  SelectedSourceVariantFieldFit,
  SelectedSourceVariantMatchClassification,
  SelectedSourceVariantRowMatch,
} from "../options/selected-source-variant-matching";
import type {
  Destination,
  ShippingType,
  SupplierType,
} from "../kernel/enums";
import type { Currency } from "../market/fx/types";
import type { PriceAuthority } from "../pricing/authority";
import type { SupplierPricingContext } from "../pricing/required-charges";
import type { SupplierOptionLinkTarget } from "../schemas/supplier-option-link";
import type { DestinationQuoteOutcome } from "../offers/destination-quote-state";
import type { QuickCompareSelectionIntent } from "./quick-compare-offer-resolution";
import type { OfferSemanticFitness } from "../options/offer-semantic-fitness";
import type { PrintDecoration } from "../catalog/print-decoration";
import type { QuickComparePricedBasis } from "./quick-compare-priced-basis";
import type { RepresentativeOptionResult } from "../options/representative-option";
import type {
  VariantPickerControl,
  VariantPickerDimension,
} from "../options/variant-picker-policy";

export type QuickComparePricingTierKey = PricingTierKey;

export type QuickCompareDestinationQuoteOutcome = Omit<
  DestinationQuoteOutcome,
  "requestedDestination" | "sourceDestination"
> & {
  requestedDestination: Destination;
  sourceDestination: Destination | null;
};

export type QuickCompareRow = {
  matchKind: "exact" | "alternative";
  surfaceKind: "primary" | "alternative";
  alternativeReason?: "closest_mapping" | "canonical_alternative";
  semanticFitness: OfferSemanticFitness;
  destinationQuote: QuickCompareDestinationQuoteOutcome;
  requestedDestination: Destination;
  sourceDestination: Destination | null;
  isDestinationFallback: boolean;
  supplier: {
    id: string;
    name: string;
    logo: string | null;
    type: SupplierType | null;
    website: string;
  };
  provider: { id: string; name: string; score: number | null } | null;
  /** Active supplier variant used by this row, when the quote proves one. */
  variantId: string | null;
  product: {
    id: string;
    name: string;
    isSubstitute: boolean;
    substituteLevel?: string;
    substituteCanonicalId?: string;
    matchedAttributes?: string[];
    criticalDifferences?: string[];
    differencesUnresolved?: string;
    /** The page's product states a fabric weight, so an ounce figure here is a fabric weight. */
    fabricWeightBasis?: boolean;
  };
  comparison: QuickCompareComparison;
  currency: Currency | null;
  shippingType: ShippingType | null;
  /** Where the offer ships from: a country code or "EU"; null when not stored. */
  fulfillmentRegion?: string | null;
  /** Countries that may ship it when no origin is stored; they settle the receipt's route. */
  candidateOrigins?: string[];
  basePrice: number | null;
  shippingPrice: number | null;
  /** Supplemental supplier-billed duty, excluded from the product + shipping comparison. */
  dutyPrice?: number | null;
  dutyOutcome?: "charged" | "not_applicable" | "estimated" | "unknown" | null;
  dutyEstimate?: SupplierDutyEstimateProjection | null;
  /** Original duty amount from this exact selected variant, before display FX. */
  dutySource?: { amount: number; currency: Currency } | null;
  /** Fixed comparison basis: product + shipping, excluding supplemental duty. */
  totalPrice: number | null;
  deliveryDaysMin: number | null;
  deliveryDaysMax: number | null;
  fulfillmentDays: number | null;
  productionEstimate: ProductionEstimate | null;
  available: boolean;
  printTechnologies: string[];
  colorCount: number;
  sizeRange: string;
  /**
   * What the shown price was quoted for. A summary-default row names the size,
   * color and count of its stored variant; a selected row, whose size and
   * color the seller already chose, carries the count of its own variant only.
   */
  pricedBasis?: QuickComparePricedBasis;
  coverage: {
    totalVariants: number;
    shippingPriceCovered: number;
    shippingTypeCovered: number;
    deliveryTimingCovered: number;
    productionTimingCovered: number;
    transitTimingCovered: number;
  };
  pricingTiers: QuickComparePricingTier[];
  provenance: {
    sourceUrl: string;
    lastCheckedAt: string | null;
    priceAuthority: PriceAuthority | null;
    priceSource: string | null;
    sourceCurrency: Currency | null;
    isProjectedPrice: boolean;
    shippingPriceSource: string | null;
    /**
     * The design basis the shown price holds for, from the variant this row
     * prices. Its one-off setup fee is not in `totalPrice`.
     */
    pricingContext?: SupplierPricingContext;
    /**
     * Supplier-native destination for the option this row prices, already
     * resolved for the row's market. Absent when the priced variant has no
     * reviewed target; the product page in `sourceUrl` remains the fallback.
     */
    supplierOptionLink?: SupplierOptionLinkTarget;
  };
};

export type QuickComparePricingTier = {
  key: QuickComparePricingTierKey;
  label: string;
  price: number;
  /** Equality to the base net established before display conversion/rounding. */
  usesBaseDutyBasis?: boolean;
};

export type QuickCompareRowsForDestination = {
  exactRows: QuickCompareRow[];
  alternativeRows: QuickCompareRow[];
};

export type QuickCompareRowsByDestination = Record<
  Destination,
  QuickCompareRowsForDestination
>;

export type QuickCompareComparison =
  | {
      selectionKind: "summary-default";
    }
  | {
      selectionKind: "selected-profile-exact";
      selectionIntent: Exclude<QuickCompareSelectionIntent, "none">;
      selectedOptionKey: string;
      variantId: string;
      variantProfileId: string;
      matchedFields: string[];
    }
  | {
      selectionKind: "selected-profile-equivalent";
      selectionIntent: Exclude<QuickCompareSelectionIntent, "none">;
      selectedOptionKey: string;
      variantId: string;
      variantProfileId: string;
      matchedFields: string[];
      equivalenceKind: "reviewed-size-equivalence";
    }
  | {
      selectionKind: "selected-profile-unavailable";
      selectionIntent: Exclude<QuickCompareSelectionIntent, "none">;
      selectedOptionKey: string;
      missingFields: string[];
      selectedSource?: QuickCompareSelectedSourceVariantMatchSummary;
    }
  | {
      selectionKind: "selected-source-match";
      selectionIntent: Exclude<QuickCompareSelectionIntent, "none">;
      selectedOptionKey: string;
      variantId: string;
      variantProfileId: string;
      classification: SelectedSourceVariantMatchClassification;
      matchedFields: string[];
      fieldComparisons: SelectedSourceVariantFieldFit[];
    }
  | {
      selectionKind: "selected-source-unavailable";
      selectionIntent: Exclude<QuickCompareSelectionIntent, "none">;
      selectedOptionKey: string;
      classification: Extract<
        SelectedSourceVariantMatchClassification,
        "not-comparable" | "normalization-needed"
      >;
      materializationStatus: SelectedSourceVariantRowMatch["materializationStatus"];
      missingFields: string[];
      fieldComparisons: SelectedSourceVariantFieldFit[];
    };

export type QuickCompareSelectedSourceVariantMatchSummary = {
  productId: string;
  supplierId: string;
  classification: SelectedSourceVariantMatchClassification;
  materializationStatus: SelectedSourceVariantRowMatch["materializationStatus"];
  selectedVariantId: string | null;
  selectedVariantProfileId: string | null;
  matchedFields: string[];
  fieldComparisons: SelectedSourceVariantFieldFit[];
};

export type QuickCompareVariantPickerField = {
  field: VariantPickerDimension;
  label: string;
  control: VariantPickerControl;
  requirement?: "required" | "when-selectable";
};

export type QuickCompareVariantPickerOptionValue = {
  field: VariantPickerDimension;
  label: string;
  valueKey: string;
  normalizedValue: string;
};

export type QuickCompareVariantPickerColorSwatch = {
  /** Ordered supplier component palette, or sorted supplier shades for solid colors. */
  hexes: string[];
  /** `hexes` is one supplier's component palette: draw each hex, never merge shades. */
  componentPalette?: true;
  images?: { url: string; label: string; supplierId: string }[];
  coverage: "complete" | "partial" | "missing";
};

export type QuickCompareVariantPickerOption = {
  key: string;
  label: string;
  values: QuickCompareVariantPickerOptionValue[];
  productIds: string[];
  supplierIds: string[];
};

export type QuickCompareVariantPickerSelection = {
  productId: string;
  supplierId: string;
  matchKind?: "exact" | "reviewed-size-equivalence" | "selected-source";
  variantId: string;
  variantProfileId: string;
  semanticFitness?: OfferSemanticFitness;
  /** Apparel only: which print this price is for. */
  printDecoration?: PrintDecoration;
  selectedSource?: QuickCompareSelectedSourceVariantMatchSummary;
  provider: { id: string; name: string; score: number | null } | null;
  currency: Currency;
  /** The currency the supplier priced this offer in, before any conversion. */
  sourceCurrency?: Currency | null;
  shippingType: ShippingType | null;
  /** Where the offer ships from: a country code or "EU"; null when not stored. */
  fulfillmentRegion?: string | null;
  /** Countries that may ship it when no origin is stored; they settle the receipt's route. */
  candidateOrigins?: string[];
  basePrice: number;
  shippingPrice: number | null;
  /** Supplemental supplier-billed duty, excluded from the product + shipping comparison. */
  dutyPrice?: number | null;
  dutyOutcome?: "charged" | "not_applicable" | "estimated" | "unknown" | null;
  dutyEstimate?: SupplierDutyEstimateProjection | null;
  /** Original duty amount from this exact selected variant, before display FX. */
  dutySource?: { amount: number; currency: Currency } | null;
  /** Fixed comparison basis: product + shipping, excluding supplemental duty. */
  totalPrice: number | null;
  deliveryDaysMin: number | null;
  deliveryDaysMax: number | null;
  fulfillmentDays: number | null;
  productionEstimate: ProductionEstimate | null;
  shippingPriceSource: string | null;
  /** The design basis of this variant's own price; never taken from another selection. */
  pricingContext?: SupplierPricingContext;
  pricingTiers: QuickComparePricingTier[];
  destinationQuote: QuickCompareDestinationQuoteOutcome;
  /** Supplier-native destination for this variant's option, resolved for this market. */
  supplierOptionLink?: SupplierOptionLinkTarget;
  /** The count this variant's own price buys; never taken from another selection or the summary. */
  pricedBasis?: QuickComparePricedBasis;
};

export type QuickCompareVariantPickerSelectionAuthorityCandidate = {
  productId: string;
  supplierId: string;
  variantId: string;
  variantProfileId: string;
  matchKind: "exact" | "reviewed-size-equivalence";
};

type QuickCompareVariantPickerSelectedSourceAuthority = {
  productId: string;
  supplierId: string;
  variantId: string;
  variantProfileId: string;
  classification: SelectedSourceVariantMatchClassification;
  materializationStatus: SelectedSourceVariantRowMatch["materializationStatus"];
};

export type QuickCompareVariantPickerSelectionAuthority = {
  version: typeof QUICK_COMPARE_PICKER_SELECTION_AUTHORITY_VERSION;
  optionKey: string;
  candidates: QuickCompareVariantPickerSelectionAuthorityCandidate[];
  selectedSourceSelections: QuickCompareVariantPickerSelectedSourceAuthority[];
  inputFingerprint: string;
};

export type QuickCompareVariantPickerDataForDestination = {
  enabled: boolean;
  /**
   * Set when the category has option controls but the product's option
   * evidence exceeds a read budget; the rows are compared without them.
   */
  disabledReason?: "evidence-over-budget";
  category: { slug: string; name: string } | null;
  fields: QuickCompareVariantPickerField[];
  options: QuickCompareVariantPickerOption[];
  defaultOptionKey: string | null;
  /**
   * Markets that sell none of the representative's supporting profiles, with
   * the option they open on instead, or `null` for summary rows when the
   * market sells the product only outside these options. Absent markets open
   * on `defaultOptionKey`.
   */
  marketDefaultOptionKeys?: Partial<Record<Destination, string | null>>;
  representativeOption: RepresentativeOptionResult;
  renderedValuesByField?: Partial<
    Record<VariantPickerDimension, string[]>
  >;
  colorSwatchesByValueKey: Record<
    string,
    QuickCompareVariantPickerColorSwatch
  >;
  hiddenOptionCount: number;
  totalSupportedOptionCount: number;
  selectionsByOptionKey: Record<
    string,
    Record<string, QuickCompareVariantPickerSelection>
  >;
  selectionAuthorityByOptionKey?: Record<
    string,
    QuickCompareVariantPickerSelectionAuthority
  >;
  selectedSourceMatchesByOptionKey?: Record<
    string,
    Record<string, QuickCompareSelectedSourceVariantMatchSummary>
  >;
};

export type QuickCompareVariantPickerDataByDestination = Record<
  Destination,
  QuickCompareVariantPickerDataForDestination
>;

/**
 * The read model's own shapes: the selected variant a summary prices, the
 * per-product/destination summary built from it, and the small vocabularies
 * that travel with them. Row builders here and the query layer that fills
 * them both read these, so they live beside the read model, not beside SQL.
 */
export type SelectedVariantRow = {
  fulfillmentRegion?: string | null;
  /** Countries that may ship it when no origin is stored. */
  candidateOrigins?: string[];
  /** Validated, market-independent target of the option this variant prices. */
  supplierLinkTarget?: SupplierOptionLinkTarget | null;
  variantId?: string;
  variantProfileId?: string | null;
  productId: string;
  supplierId: string;
  destination: Destination;
  currency: Currency;
  providerId: string | null;
  providerName: string | null;
  providerScore: number | null;
  size: string | null;
  normalizedSizeValue: string | null;
  productPrice: number;
  nativeProductPrice: number;
  tier1Price: number | null;
  tier2Price: number | null;
  tier1UsesBaseDutyBasis?: boolean;
  tier2UsesBaseDutyBasis?: boolean;
  shippingType: ShippingType | null;
  shippingPriceSource: string | null;
  /** The design basis of the variant whose price this summary shows. */
  pricingContext?: SupplierPricingContext;
  shippingPrice: number | null;
  /** Supplemental supplier-billed duty, excluded from the product + shipping comparison. */
  dutyPrice?: number | null;
  dutyOutcome?: "charged" | "not_applicable" | "estimated" | "unknown" | null;
  dutyEstimate?: SupplierDutyEstimateProjection | null;
  /** Original duty amount from this exact selected variant, before display FX. */
  dutySource?: { amount: number; currency: Currency } | null;
  nativeShippingPrice: number | null;
  deliveryDaysMin: number | null;
  deliveryDaysMax: number | null;
  productionEstimate: ProductionEstimate | null;
  /** Selected-profile facts of the variant this summary prices, for its basis. */
  pricedFacts?: readonly {
    field: string;
    normalizedValue: string | null;
    state?: string;
    valueJson?: unknown;
  }[];
  selectionKind: "summary-default";
};

export type ProductDestinationSummary = {
  supplierId: string;
  selectedVariant: SelectedVariantRow | null;
  comparison: QuickCompareComparison;
  colorCount: number;
  printTechnologies: string[];
  sizeRange: string;
  coverage: QuickCompareRow["coverage"];
  sourceCurrency: Currency | null;
  priceAuthority: PriceAuthority | null;
  priceSource: string;
  lastCheckedAt: Date;
  isProjectedPrice: boolean;
  destinationQuote?: DestinationQuoteOutcome | null;
};

export type ProductSummaryMap = Map<
  string,
  Map<Destination, ProductDestinationSummary>
>;

export type SupplierStoredFxConfig = {
  baseCurrency: Currency;
  fxRates: Partial<Record<Currency, number>>;
};

export type SupplierPricingTierLabels = {
  baseName: string | null;
  tier1Name: string | null;
  tier2Name: string | null;
};

export type ProfileValueRow = {
  variantProfileId: string;
  productId: string;
  field: string;
  normalizedValue: string | null;
  originScope: string;
  normalizationStatus: string | null;
  valueJson: unknown;
  rawEvidenceKey?: string | null;
  source?: string | null;
  evidencePath?: string | null;
};
