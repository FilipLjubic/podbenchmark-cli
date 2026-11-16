/**
 * Destination fallback ladder for pricing resolution.
 *
 * When a product has no variants in the user's preferred destination,
 * we try geographically proximate markets in order. This gives a more
 * relevant "approximate" price than picking a random region.
 */

import type { Destination } from "../kernel/enums";

/**
 * Geographic-proximity fallback chains per destination.
 * Order: closest markets first, furthest last.
 */
export const DESTINATION_FALLBACK_ORDER: Record<Destination, Destination[]> = {
	US: ["CA", "GB", "DE", "AU"],
	GB: ["DE", "CA", "US", "AU"],
	DE: ["GB", "CA", "US", "AU"],
	AU: ["GB", "DE", "CA", "US"],
	CA: ["US", "GB", "DE", "AU"],
};
