/** Single source of truth for cross-module enum constants. Import from here, not local definitions. */

export const TARGET_DESTINATIONS = ["US", "GB", "DE", "AU", "CA"] as const;
export type Destination = (typeof TARGET_DESTINATIONS)[number];

/** Unit used first when displaying a market's dimension range. */
export function preferredDestinationDimensionUnit(destination: Destination): "in" | "cm" {
  return destination === "US" ? "in" : "cm";
}


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

const CATEGORY_TYPES = ["product", "marketing", "seasonal", "brand", "print_method", "feature", "collection", "invalid"] as const;
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

export const SOURCE_OPTION_AXIS_ROLES = [
	"selected-choice",
	"available-choice",
	"capability",
	"context",
] as const;
export type SourceOptionAxisRole = (typeof SOURCE_OPTION_AXIS_ROLES)[number];
export type NonSelectionSourceOptionAxisRole = Extract<
	SourceOptionAxisRole,
	"capability" | "context"
>;

