import type { PrintfulTieredPolicyModel } from "./types";

export const PRINTFUL_POLICY_ID = "printful-three-tier";
export const PRINTFUL_POLICY_VERSION = "v1";
/** The tier model rounds to the nearest quarter of a USD cent. */
export const PRINTFUL_ROUNDING_POLICY_ID = "nearest-quarter";

export const PRINTFUL_TIERED_MODEL: PrintfulTieredPolicyModel = {
  kind: "printful_tiered",
  rates: {
    low: { USD: 1, EUR: 0.8389, GBP: 0.7457, CAD: 1.376 },
    normal: { USD: 1, EUR: 0.8463, GBP: 0.7482, CAD: 1.3814 },
    high: { USD: 1, EUR: 0.862, GBP: 0.7596, CAD: 1.4035 },
  },
  roundingIncrement: 0.25,
};

export type PrintfulProductTier = keyof typeof PRINTFUL_TIERED_MODEL.rates;

export function detectPrintfulProductTier(
  productName: string
): PrintfulProductTier {
  const normalized = productName.toLowerCase();

  if (normalized.includes("knit")) return "high";
  if (normalized.includes("adidas") && !normalized.includes("premium")) {
    return "high";
  }
  if (
    normalized.includes("all-over") &&
    normalized.includes("windbreaker")
  ) {
    return "high";
  }
  if (normalized.includes("track pants")) return "high";
  if (
    normalized.includes("slim fit") &&
    normalized.includes("polo")
  ) {
    return "high";
  }
  if (normalized.includes("pajama")) return "high";

  if (normalized.includes("gildan") && !normalized.includes("2400")) {
    return "low";
  }
  if (normalized.includes("comfort colors")) return "low";
  if (normalized.includes("next level 3600")) return "low";
  if (
    normalized.includes("bella + canvas") &&
    /\b(3001|3005|3413|6400|3480|3501)\b/.test(normalized)
  ) {
    return "low";
  }

  return "normal";
}

