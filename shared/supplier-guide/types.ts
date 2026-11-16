import type {
  SupplierFulfillmentConnectionState,
  SupplierOperatingFactAvailability,
  SupplierOperatingFactEffectiveState,
  SupplierOperatingFactOfferRequirement,
} from "shared/schemas/supplier-operating-fact";
import type { DestinationQuoteState } from "shared/offers/destination-quote-state";
import type { Destination } from "shared/kernel/enums";
import type { Currency } from "shared/market/fx/types";
import type { SalesChannel } from "shared/sales-channel-fees/channels";

export const BEGINNER_PRODUCT_FAMILY_IDS = [
  "t-shirts",
  "hoodies",
  "mugs",
  "wall-art",
  "stickers",
  "phone-cases",
] as const;
export type BeginnerProductFamilyId =
  (typeof BEGINNER_PRODUCT_FAMILY_IDS)[number];

export type BeginnerSalesChannel = "not-decided" | SalesChannel;

type BeginnerBrandingNeed = "not-required" | "custom-required";
type BeginnerPlanPreference = "free-start" | "paid-okay";
type BeginnerProviderPreference = "no-preference" | "choose-provider";

export type BeginnerProductFamilyDefinition = {
  id: BeginnerProductFamilyId;
  label: string;
  categoryId: string;
  categoryHref: string;
};

export type BeginnerGuideInput = {
  productFamilyId: BeginnerProductFamilyId;
  destination: Destination;
  salesChannel: BeginnerSalesChannel;
  sellerMarket: Destination | null;
  brandingNeed: BeginnerBrandingNeed;
  planPreference: BeginnerPlanPreference;
  providerPreference: BeginnerProviderPreference;
};

type BeginnerGuideEvidenceLink = {
  label: string;
  url: string;
  observedAt: string;
};

export type BeginnerGuideComparisonOffer = {
  supplierId: string;
  available: boolean;
  isDestinationFallback: boolean;
  quoteState: DestinationQuoteState;
  checkedAt: string | null;
};

export type BeginnerGuideComparisonRows = {
  offers: BeginnerGuideComparisonOffer[];
};

export type BeginnerGuideProductCoverageState =
  | "available"
  | "stale"
  | "unquoted"
  | "unavailable"
  | "unknown"
  | "absent";

/** Delivered price of the starting product's representative option. */
export type BeginnerGuideOffer = {
  /** The supplier's own name for the product. */
  productName: string;
  /** False when the price is for the supplier's closest variant, not the exact option. */
  optionMatched: boolean;
  totalPrice: number;
  currency: Currency;
  deliveryDaysMin: number | null;
  deliveryDaysMax: number | null;
  checkedAt: string | null;
};

export type BeginnerGuideProviderBrandingFeature =
  | "inserts"
  | "neck_labels"
  | "gift_messages";

/** A print provider listed for a product on a marketplace supplier. */
export type BeginnerGuidePrintProvider = {
  name: string;
  countryCode: string | null;
  brandingFeatures: BeginnerGuideProviderBrandingFeature[];
  /** The platform assigns the printer per order (e.g. Printify Choice). */
  routedByPlatform: boolean;
};

/**
 * Where the supplier sells any product in the family: this destination,
 * only other destinations, or nowhere in our weekly-scraped catalog.
 */
export type BeginnerGuideFamilyReach = "destination" | "elsewhere" | "none";

export type BeginnerGuideProductCoverage = {
  state: BeginnerGuideProductCoverageState;
  familyReach: BeginnerGuideFamilyReach;
  exactMatch: boolean;
  quoteStates: DestinationQuoteState[];
  checkedAt: string | null;
  /** Null when the representative option has no comparable delivered price. */
  offer: BeginnerGuideOffer | null;
  /** Providers that make this product for the destination; empty unless the supplier is a marketplace. */
  printProviders: BeginnerGuidePrintProvider[];
  /** The supplier's closest product when it lacks this exact one. */
  alternative: { productName: string; offer: BeginnerGuideOffer } | null;
};

export type BeginnerGuideFactCore = {
  factId: string;
  effectiveState: SupplierOperatingFactEffectiveState;
  summary: string;
  conditions: string[];
  sellerMarkets: string[];
  channels: string[];
  commerceModes: string[];
  routingModes: string[];
  plans: string[];
  products: string[];
  providers: string[];
  destinations: string[];
  accountCohorts: string[];
  scopeNotes: string[];
  offerRequirements: SupplierOperatingFactOfferRequirement[];
  verifiedAt: string;
  reviewAfter: string;
  evidence: BeginnerGuideEvidenceLink[];
};

export type BeginnerGuideConnectionFact = BeginnerGuideFactCore & {
  connectionState: SupplierFulfillmentConnectionState;
  workflow: string | null;
};

export type BeginnerGuideCapabilityFact = BeginnerGuideFactCore & {
  status: SupplierOperatingFactAvailability;
};

export type BeginnerGuidePlan = {
  id: string;
  name: string;
  isFree: boolean;
  /** Cheapest published monthly-equivalent price for paid plans. */
  monthlyPrice: { amount: number; currency: string } | null;
  summary: string | null;
};

export type BeginnerGuidePlanFact = BeginnerGuideFactCore & {
  hasFreePlan: boolean;
  planNames: string[];
  offeredPlans: BeginnerGuidePlan[];
};

export type BeginnerGuideRoutingFact = BeginnerGuideFactCore & {
  model: string;
  facilityChoiceStatus: SupplierOperatingFactAvailability;
  facilityChoiceAnswer: string;
};

export type BeginnerGuideSupplierPairLink = {
  slug: string;
  href: string;
  otherSupplierId: string;
  otherSupplierName: string;
};

export type BeginnerGuideSupplier = {
  id: string;
  name: string;
  /** Self-hosted mark from `public/assets/suppliers`, or the stored logo URL. */
  logo: string | null;
  profileHref: string | null;
  comparisonLinks: BeginnerGuideSupplierPairLink[];
  connections: BeginnerGuideConnectionFact[];
  branding: BeginnerGuideCapabilityFact[];
  plans: BeginnerGuidePlanFact[];
  routing: BeginnerGuideRoutingFact[];
};

export type BeginnerGuideStartingProduct = {
  id: string;
  name: string;
  comparisonHref: string;
  /** Representative option the delivered prices refer to, e.g. "11 oz · White". */
  optionLabel: string | null;
  supplierCoverage: Record<string, BeginnerGuideProductCoverage>;
};

export type BeginnerGuideDestinationCoverage = {
  state: "current" | "evidence-only" | "unknown";
  exactProductCandidateCount: number;
  startingProduct: BeginnerGuideStartingProduct | null;
};

export type BeginnerGuideProductFamily = {
  id: BeginnerProductFamilyId;
  label: string;
  categoryHref: string;
  byDestination: Record<Destination, BeginnerGuideDestinationCoverage>;
};

export type BeginnerSupplierGuideSnapshot = {
  /** Omitted on complete build snapshots; interactive reads name their coverage. */
  scope?: {
    productFamilyId: BeginnerProductFamilyId;
    destination: Destination;
  };
  productFamilies: BeginnerGuideProductFamily[];
  suppliers: BeginnerGuideSupplier[];
  generatedAt: string;
  latestComparisonObservedAt: string | null;
};

export type BeginnerGuideReasonKind =
  | "product"
  | "channel"
  | "branding"
  | "plan"
  | "provider";

export type BeginnerGuideReasonStatus =
  | "met"
  | "qualified"
  | "unknown"
  | "blocked";

export type BeginnerGuideReason = {
  kind: BeginnerGuideReasonKind;
  status: BeginnerGuideReasonStatus;
  label: string;
  detail: string;
  conditions: string[];
  scope: string[];
  sourceKind: "comparison" | "official" | "none";
  sourceHref: string | null;
  sourceLabel: string | null;
  checkedAt: string | null;
  reviewAfter: string | null;
};

export type BeginnerGuideSupplierResult = {
  supplier: BeginnerGuideSupplier;
  status: "aligned" | "needs-check" | "blocked";
  reasons: BeginnerGuideReason[];
};

type BeginnerGuideShortlistResultCore = {
  input: BeginnerGuideInput;
  productFamily: BeginnerGuideProductFamily;
  destinationLabel: string;
};

/** Delivered-price span across the suppliers that fit, in one currency. */
export type BeginnerGuidePriceRange = {
  min: number;
  max: number;
  currency: Currency;
  supplierCount: number;
  checkedFrom: string | null;
  checkedTo: string | null;
};

export type BeginnerGuideShortlistResult =
  | (BeginnerGuideShortlistResultCore & {
      state: "ready";
      startingProduct: BeginnerGuideStartingProduct;
      aligned: BeginnerGuideSupplierResult[];
      needsCheck: BeginnerGuideSupplierResult[];
      blocked: BeginnerGuideSupplierResult[];
      priceRange: BeginnerGuidePriceRange | null;
    })
  | (BeginnerGuideShortlistResultCore & {
      state: "coverage-unknown";
      startingProduct: null;
      aligned: [];
      needsCheck: [];
      blocked: [];
      priceRange: null;
    });
