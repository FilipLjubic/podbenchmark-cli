import { PRICING_TIER_KEYS } from "../pricing/types";
import { z } from "zod";
import { TARGET_DESTINATIONS } from "../kernel/enums";
import {
  SUPPORTED_CURRENCIES,
  getDefaultCurrencyForDestination,
} from "../market/user-preferences";
import { SALES_CHANNELS } from "../sales-channel-fees/channels";
import { BEGINNER_PRODUCT_FAMILY_IDS } from "../supplier-guide/types";
import { supplierPriceAnalysisOptionsSchema } from "../supplier-price-analysis/options-schema";
import type { Destination } from "../kernel/enums";
import type { Currency } from "../market/fx/types";

const siteIdSchema = z.string().trim().min(1).max(200);
const pageShape = {
  offset: z.number().int().min(0).max(100000).default(0),
  limit: z.number().int().min(1).max(50).default(10),
};
const marketShape = {
  destination: z.enum(TARGET_DESTINATIONS).default("US"),
  currency: z.enum(SUPPORTED_CURRENCIES).optional(),
};
/** The largest page of categories either the site or the public tool pages through. */
export const CATEGORIES_PAGE_LIMIT_MAX = 100;
export const categoriesInputSchema = z.strictObject({
  ...marketShape,
  ...pageShape,
  limit: z
    .number()
    .int()
    .min(1)
    .max(CATEGORIES_PAGE_LIMIT_MAX)
    .default(10),
  query: z.string().trim().max(200).default(""),
  parentId: siteIdSchema.nullable().optional(),
});
import { SPEC_FACETS } from "./spec-facets";
export { SPEC_FACETS };
export const catalogInputSchema = z
  .strictObject({
    ...marketShape,
    ...pageShape,
    category: siteIdSchema.optional(),
    facetOffset: z.number().int().min(0).max(100000).default(0),
    facetLimit: z.number().int().min(1).max(50).default(20),
    query: z.string().trim().max(200).default(""),
    brands: z.array(siteIdSchema).max(50).default([]),
    supplierIds: z.array(siteIdSchema).max(20).default([]),
    demographics: z.array(siteIdSchema).max(20).default([]),
    specs: z
      .partialRecord(z.enum(SPEC_FACETS), z.array(siteIdSchema).min(1).max(30))
      .default({}),
    minimumWeightOz: z.number().finite().nonnegative().max(100).optional(),
    maximumWeightOz: z.number().finite().nonnegative().max(100).optional(),
    pricedOnly: z.boolean().default(false),
    sort: z
      .enum([
        "recommended",
        "name",
        "price-asc",
        "price-desc",
        "supplier-count",
      ])
      .default("recommended"),
  })
  .refine(
    value =>
      value.minimumWeightOz === undefined ||
      value.maximumWeightOz === undefined ||
      value.minimumWeightOz <= value.maximumWeightOz,
    "Minimum weight cannot exceed maximum weight."
  );
export const productInputSchema = z.strictObject({
  canonicalId: siteIdSchema,
  ...pageShape,
});
export const optionsInputSchema = z.strictObject({
  canonicalId: siteIdSchema,
  ...pageShape,
  values: z
    .record(siteIdSchema, siteIdSchema)
    .refine(
      values => Object.keys(values).length <= 15,
      "At most 15 option fields."
    )
    .optional(),
});
export const comparisonInputSchema = z.strictObject({
  canonicalId: siteIdSchema,
  ...marketShape,
  ...pageShape,
  selection: z
    .union([
      z.literal("representative"),
      z.literal("summary"),
      z.strictObject({ optionKey: siteIdSchema.max(4000) }),
      z.strictObject({ values: optionsInputSchema.shape.values.unwrap() }),
    ])
    .default("representative"),
  pricingTier: z.enum(PRICING_TIER_KEYS).default("base"),
  includeAlternatives: z.boolean().default(false),
  supplierId: siteIdSchema.optional(),
  offerOffset: z.number().int().min(0).max(100000).default(0),
  offerLimit: z.number().int().min(1).max(50).default(5),
});
export const suppliersInputSchema = z.strictObject({
  query: z.string().trim().max(200).default(""),
  ...pageShape,
});
export const supplierInputSchema = z.strictObject({
  supplierId: siteIdSchema,
  ...pageShape,
  include: z
    .array(z.enum(["facts", "locations", "providers"]))
    .max(3)
    .default(["facts"]),
  factKeys: z.array(siteIdSchema).max(30).optional(),
  providerId: siteIdSchema.optional(),
  country: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .optional(),
});
export const pricesInputSchema = z.strictObject({
  ...marketShape,
  ...supplierPriceAnalysisOptionsSchema.shape,
  supplierId: siteIdSchema,
  categoryOffset: pageShape.offset,
  categoryLimit: pageShape.limit,
});
export const guideInputSchema = z.strictObject({
  ...pageShape,
  productFamilyId: z.enum(BEGINNER_PRODUCT_FAMILY_IDS).default("mugs"),
  destination: z.enum(TARGET_DESTINATIONS).default("US"),
  salesChannel: z
    .enum(["not-decided", ...SALES_CHANNELS])
    .default("not-decided"),
  sellerMarket: z.enum(TARGET_DESTINATIONS).nullable().default(null),
  brandingNeed: z
    .enum(["not-required", "custom-required"])
    .default("not-required"),
  planPreference: z.enum(["free-start", "paid-okay"]).default("paid-okay"),
  providerPreference: z
    .enum(["no-preference", "choose-provider"])
    .default("no-preference"),
});
export const profitInputSchema = comparisonInputSchema.extend({
  sellerMarket: z.enum(TARGET_DESTINATIONS),
  channel: z.enum(SALES_CHANNELS).default("etsy"),
  shippingSetupId: siteIdSchema.default("merchant-fulfilled"),
  mode: z
    .discriminatedUnion("kind", [
      z.strictObject({
        kind: z.literal("selling-price"),
        amountMinor: z.number().int().min(0).max(100000000),
      }),
      z.strictObject({
        kind: z.literal("target-margin"),
        percent: z.number().finite().min(0).lt(100),
        displayIncrementMinor: z.number().int().min(1).max(100000).default(50),
      }),
    ])
    .default({ kind: "target-margin", percent: 30, displayIncrementMinor: 50 }),
});
export const supplierLinkInputSchema = z.strictObject({
  url: z.string().trim().min(1).max(4096),
});
export const feesInputSchema = z.strictObject({
  canonicalId: siteIdSchema,
  sellerMarket: z.enum(TARGET_DESTINATIONS),
  channel: z.enum(SALES_CHANNELS).default("etsy"),
  shippingSetupId: siteIdSchema.default("merchant-fulfilled"),
});

export function siteMarket(input: {
  destination: Destination;
  currency?: Currency;
}) {
  return {
    destination: input.destination,
    currency:
      input.currency ?? getDefaultCurrencyForDestination(input.destination),
  };
}
export function sitePage<T>(
  items: readonly T[],
  input: { offset: number; limit: number }
) {
  const shown = items.slice(input.offset, input.offset + input.limit);
  const next = input.offset + shown.length;
  return {
    items: shown,
    totalCount: items.length,
    returnedCount: shown.length,
    offset: input.offset,
    nextOffset: next < items.length ? next : null,
    truncated: next < items.length,
  };
}
export class SiteDataError extends Error {
  constructor(
    readonly code: "invalid_input" | "not_found" | "unavailable",
    message: string
  ) {
    super(message);
    this.name = "SiteDataError";
  }
}
