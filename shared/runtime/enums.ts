/** Single source of truth for cross-module enum constants. Import from here, not local definitions. */

export const TARGET_DESTINATIONS = ["US", "GB", "DE", "AU", "CA"] as const;
export type Destination = (typeof TARGET_DESTINATIONS)[number];

export const MATCH_TYPES = ["exact", "closest", "no_match"] as const;
export type MatchType = (typeof MATCH_TYPES)[number];

export const SIMILARITY_LEVELS = ["close_alternative", "acceptable_substitute"] as const;
export type SimilarityLevel = (typeof SIMILARITY_LEVELS)[number];

export const SHIPPING_TYPES = ["local", "international", "varies"] as const;
export type ShippingType = (typeof SHIPPING_TYPES)[number];

export const SHIPPING_PRICE_SOURCES = [
	"api",
	"estimate_same_product",
	"estimate_cross_destination",
	"estimate_category_nearest_price",
	"estimate_related_category",
	"estimate_destination_median",
	"estimate_global_median",
	"supplier_default",
] as const;
export type ShippingPriceSource = (typeof SHIPPING_PRICE_SOURCES)[number];

export const SUPPLIER_TYPES = ["direct", "marketplace"] as const;
export type SupplierType = (typeof SUPPLIER_TYPES)[number];

export const CATEGORY_TYPES = ["product", "marketing", "seasonal", "brand", "print_method", "feature", "collection", "invalid"] as const;
export type CategoryType = (typeof CATEGORY_TYPES)[number];

export const SCRAPE_JOB_STATUSES = ["running", "paused", "completed", "failed", "cancelled"] as const;
export type ScrapeJobStatus = (typeof SCRAPE_JOB_STATUSES)[number];

export const ALTERNATIVE_SOURCES = ["spec-scoring", "llm-review", "llm-generated", "manual"] as const;
export type AlternativeSource = (typeof ALTERNATIVE_SOURCES)[number];

export const CANONICAL_COMPARISON_CLASSES = ["branded", "generic"] as const;
export type CanonicalComparisonClass = (typeof CANONICAL_COMPARISON_CLASSES)[number];

export const CANONICAL_IDENTITY_BASES = [
	"manufacturer_verified",
	"cross_supplier_shared",
	"supplier_private_label",
	"generic_no_brand",
] as const;
export type CanonicalIdentityBasis = (typeof CANONICAL_IDENTITY_BASES)[number];

export const CANONICAL_SURFACING_TIERS = [
	"compare-primary",
	"attached-to-anchor",
	"discovery-only",
	"hidden-internal",
] as const;
export type CanonicalSurfacingTier = (typeof CANONICAL_SURFACING_TIERS)[number];

export const DELIVERY_DAY_TYPES = ["business", "calendar"] as const;
export type DeliveryDayType = (typeof DELIVERY_DAY_TYPES)[number];

/**
 * What unit each supplier's delivery timing columns use.
 * Most suppliers report business days directly. Fourthwall returns delivery
 * dates, and we normalize the resulting calendar-day diff to business days at
 * ingestion time.
 *
 * Sources and normalization policies:
 *   Prodigi: explicit code comment in scraper
 *   CustomCat: explicit code comment + source docs
 *   Printify: API field literally named `average_business_days_in_production`
 *   Printful: API tooltip says "calculated in business days"; transit confirmed via frontend (2026-03-05)
 *   Gelato: confirmed via frontend shipping page (2026-03-05)
 *   Fourthwall: calendar date diff from API dates, normalized with
 *     ceil(calendarDays * 5 / 7) before persistence
 *   Inkthreadable: MODELLED unit policy reviewed 2026-10-21; product working-day
 *     production plus selected-service transit treated as working days, not a
 *     source-confirmed transit unit. Composition guidance:
 *     https://www.inkthreadable.co.uk/how-does-print-on-demand-work
 *     Transit bounds: https://www.inkthreadable.co.uk/shipping-costs
 */
export const SUPPLIER_DELIVERY_DAY_TYPE = {
	gelato: "business",
	printful: "business",
	printify: "business",
	prodigi: "business",
	customcat: "business",
	fourthwall: "business",
	inkthreadable: "business",
} satisfies Record<string, DeliveryDayType>;
