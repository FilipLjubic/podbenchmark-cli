import { z } from "zod";
import { PRICING_TIER_KEYS } from "../pricing/types";
import { DEFAULT_SUPPLIER_PRICE_TOLERANCE } from "./contracts";

/**
 * What a request may set for a price analysis. The schema validates options
 * that arrive from outside (public API and tool inputs); the analysis itself
 * applies the same defaults with `resolveSupplierPriceAnalysisSettings`.
 */
const tierSchema = z.enum(PRICING_TIER_KEYS);

export const supplierPriceAnalysisOptionsSchema = z.strictObject({
  supplierId: z.string().trim().min(1).optional(),
  competitorId: z.string().trim().min(1).nullable().default(null),
  selectedSupplierTier: tierSchema.default("base"),
  /**
   * Percent off the selected supplier’s own product prices, such as a
   * spend-based reward tier. Shipping and every competitor stay as quoted.
   */
  selectedProductDiscountPercent: z
    .number()
    .finite()
    .nonnegative()
    .max(100)
    .default(0),
  competitorTier: tierSchema.default("base"),
  categorySlug: z.string().trim().min(1).nullable().default(null),
  search: z.string().trim().max(200).default(""),
  tolerance: z
    .discriminatedUnion("kind", [
      z.strictObject({
        kind: z.literal("currency"),
        amount: z
          .number()
          .finite()
          .nonnegative()
          .max(1_000_000)
          .multipleOf(0.01),
      }),
      z.strictObject({
        kind: z.literal("percentage"),
        percent: z.number().finite().nonnegative().max(100),
      }),
    ])
    .default(DEFAULT_SUPPLIER_PRICE_TOLERANCE),
  pageSize: z.number().int().min(1).max(50).default(10),
  cheapestOffset: z.number().int().nonnegative().default(0),
  cheaperElsewhereOffset: z.number().int().nonnegative().default(0),
});
