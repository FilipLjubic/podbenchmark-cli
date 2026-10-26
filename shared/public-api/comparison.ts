import { z } from "zod";
import { CurrencySchema } from "../pricing/schema";
import { supplierPricingContextSchema } from "../pricing/required-charges";
import { canonicalPathSegmentSchema } from "../product-search/identity";
import { TARGET_DESTINATIONS } from "../runtime/enums";
import { SALES_CHANNELS } from "../sales-channel-fees/channels";
import {
  destinationSchema,
  publicErrorSchema,
  publicResult,
  supplierIdSchema,
  PUBLIC_PRICING_TIERS,
} from "./common";

const choicesSchema = z
  .record(z.string().trim().min(1).max(60), z.string().trim().min(1).max(120))
  .refine(value => Object.keys(value).length <= 15, "At most 15 choices.")
  .describe(
    'Choices by field, such as { "size": "m", "color": "black" }. Values match a value key, its last part or its label, case-insensitively; get_product_options lists them.'
  );

export const getProductOptionsInputSchema = z.strictObject({
  canonicalProductId: canonicalPathSegmentSchema,
  destination: destinationSchema,
  currency: CurrencySchema,
  query: z
    .string()
    .trim()
    .max(120)
    .default("")
    .describe("Words to narrow the list, such as `m black`."),
  choices: choicesSchema.optional(),
  offset: z.number().int().min(0).max(10000).default(0),
  limit: z.number().int().min(1).max(100).default(50),
});
export type GetProductOptionsInput = z.infer<
  typeof getProductOptionsInputSchema
>;

export const compareProductInputSchema = z
  .strictObject({
    canonicalProductId: canonicalPathSegmentSchema,
    destination: destinationSchema,
    currency: CurrencySchema,
    optionKey: z
      .string()
      .min(1)
      .max(2048)
      .optional()
      .describe("An exact key from get_product_options."),
    choices: choicesSchema.optional(),
    pricingTier: z
      .enum(PUBLIC_PRICING_TIERS)
      .default("base")
      .describe(
        "base is each supplier's standard price; tier1 and tier2 are its paid plans."
      ),
    supplier: supplierIdSchema
      .optional()
      .describe(
        "Show only this supplier, with every product and print provider it offers for the choice."
      ),
    // Optional context the seller already gave in the conversation. Each one only
    // adds to the plain comparison; leave it out when the seller has not said.
    yourSupplier: supplierIdSchema
      .optional()
      .describe(
        "The supplier the seller uses today. Only when the seller said so; never guess."
      ),
    sellingPrice: z
      .number()
      .positive()
      .max(100000)
      .optional()
      .describe(
        "What the seller's customer pays per item, in the chosen currency, including any shipping the seller charges. Only when the seller said so."
      ),
    targetMargin: z
      .number()
      .gt(0)
      .lt(95)
      .optional()
      .describe(
        "The share of the sale, in percent, the seller wants to keep after supplier cost and platform fees. Returns the price to charge with each supplier. Use instead of sellingPrice."
      ),
    salesChannel: z
      .enum(SALES_CHANNELS)
      .optional()
      .describe(
        "The platform the seller sells on. Needed with sellingPrice or targetMargin for platform fees."
      ),
    shopLocation: z
      .enum(TARGET_DESTINATIONS)
      .optional()
      .describe(
        "The country the seller's shop is based in, which can differ from the destination the order ships to. Needed with sellingPrice or targetMargin for platform fees."
      ),
  })
  .refine(
    value =>
      value.sellingPrice === undefined || value.targetMargin === undefined,
    "Give sellingPrice or targetMargin, not both."
  )
  .refine(
    value => value.optionKey === undefined || value.choices === undefined,
    "Give optionKey or choices, not both."
  );
export type CompareProductInput = z.infer<typeof compareProductInputSchema>;

const optionValueSchema = z.strictObject({
  value: z.string(),
  label: z.string(),
});
const optionSchema = z.strictObject({
  key: z.string(),
  label: z.string(),
  /** The same choice by field, ready for compare_product `choices`. */
  choices: z.record(z.string(), z.string()),
  supplierCount: z.number().int().nonnegative(),
});
const optionFieldSchema = z.strictObject({
  field: z.string(),
  label: z.string(),
  values: z.array(optionValueSchema),
});

const dutyRangeSchema = z.strictObject({
  min: z.number().nonnegative(),
  max: z.number().nonnegative(),
  currency: CurrencySchema,
});
/** A modeled range for an amount the supplier has not confirmed; never exact. */
const dutyEstimateSchema = z.strictObject({
  native: dutyRangeSchema.extend({
    basis: z.literal("line_net_x_compatible_product_rate"),
  }),
  converted: dutyRangeSchema.nullable(),
});

const feeComponentSchema = z.strictObject({
  label: z.string(),
  amount: z.number(),
});
const offerProfitSchema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("calculated"),
    dutyStatus: z.enum(["known", "estimated", "unknown"]),
    qualification: z.string(),
    /** The upper modeled duty deducted when the exact amount is unconfirmed. */
    estimatedDutyDeducted: z.number().nonnegative().nullable().optional(),
    /** The selling price; with targetMargin, the price to charge. */
    sale: z.number(),
    supplierCost: z.number(),
    fees: z.number(),
    feeBreakdown: z.array(feeComponentSchema),
    keep: z.number(),
    /** Share of the sale the seller keeps, 0 to 1; null when the sale is zero. */
    margin: z.number().nullable(),
  }),
  z.strictObject({
    status: z.literal("unavailable"),
    reason: z.enum([
      "missing_cost",
      "fees_unavailable",
      "target_not_reachable",
    ]),
  }),
]);
const offerSchema = z.strictObject({
  supplierId: z.string(),
  supplier: z.string(),
  provider: z.string().nullable(),
  product: z.string(),
  /** Product cost; null when unknown, never 0. */
  price: z.number().nonnegative().nullable(),
  shipping: z.number().nonnegative().nullable(),
  duty: z.number().nonnegative().nullable(),
  dutyEstimate: dutyEstimateSchema.nullable().optional(),
  priceBasis: z.literal("product-and-shipping"),
  dutySource: z
    .object({ amount: z.number().nonnegative(), currency: CurrencySchema })
    .nullable()
    .optional(),
  sourceCurrency: CurrencySchema.nullable().optional(),
  taxNote: z.string().optional(),
  buyerImportWarning: z.string().nullable().optional(),
  delivered: z.number().nonnegative().nullable(),
  currency: CurrencySchema.nullable(),
  available: z.boolean(),
  comparable: z.boolean(),
  cheapest: z.boolean(),
  /** Leaves the seller the most per sale; only set when profit is shown. */
  mostKept: z.boolean(),
  isYourSupplier: z.boolean(),
  profit: offerProfitSchema.nullable(),
  /**
   * Per sale against the seller's own supplier: positive means the seller
   * keeps more here. Uses profit when shown, otherwise the delivered total.
   */
  versusYours: z.number().nullable(),
  note: z.string().nullable(),
  pricingContext: supplierPricingContextSchema.optional(),
  /** The selected price basis and setup disclosure in words. */
  pricingBasis: z.string().optional(),
  pricingPlan: z.string(),
  deliveryDaysMin: z.number().nullable(),
  deliveryDaysMax: z.number().nullable(),
  checkedAt: z.string().nullable(),
  actionUrl: z.url(),
  productUrl: z.url(),
  affiliate: z.boolean(),
  facts: z.array(z.strictObject({ label: z.string(), value: z.string() })),
});
const groupSchema = z.strictObject({
  offer: offerSchema,
  otherOffers: z.array(offerSchema).max(50),
  otherOfferCount: z.number().int().nonnegative(),
});
export type ComparisonOffer = z.infer<typeof offerSchema>;
export type ComparisonGroup = z.infer<typeof groupSchema>;

const profitSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("off") }),
  z.strictObject({
    status: z.literal("needs_input"),
    missing: z.array(z.enum(["salesChannel", "shopLocation"])).min(1),
    message: z.string(),
  }),
  z.strictObject({
    status: z.literal("unavailable"),
    message: z.string(),
  }),
  z.strictObject({
    status: z.literal("ready"),
    mode: z.enum(["selling-price", "target-margin"]),
    /** Null with targetMargin: each offer's profit.sale is its own price. */
    sellingPrice: z.number().nullable(),
    /** Percent; null with sellingPrice. */
    targetMargin: z.number().nullable(),
    salesChannel: z.enum(SALES_CHANNELS),
    salesChannelLabel: z.string(),
    shopLocation: z.enum(TARGET_DESTINATIONS),
    /** Set when the requested channel has no fees for the shop, so another was used. */
    fallbackFromLabel: z.string().nullable(),
    /** `YYYY-MM-DD` of the fee research in use. */
    feesCheckedAt: z.string().nullable(),
  }),
]);
const yourSupplierSchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  /** False when the supplier does not sell this product in this configuration. */
  sellsProduct: z.boolean(),
});

export const compareProductOutputSchema = publicResult({
  product: z.strictObject({
    id: z.string(),
    name: z.string(),
    subtitle: z.string().nullable(),
    /** The category slug from the product's path, such as `t-shirts`. */
    category: z.string(),
    url: z.url(),
  }),
  destination: z.enum(TARGET_DESTINATIONS),
  currency: CurrencySchema,
  pricingTier: z.enum(PUBLIC_PRICING_TIERS),
  optionKey: z.string().nullable(),
  optionLabel: z.string().nullable(),
  /** The selected option by field, such as { size: "Adult M", color: "Black" }. */
  optionChoices: z.record(z.string(), z.string()),
  profit: profitSchema,
  yourSupplier: yourSupplierSchema.nullable(),
  /** Set when the request asked for one supplier's offers. */
  supplier: z.strictObject({ id: z.string(), name: z.string() }).nullable(),
  options: z.array(optionSchema.pick({ key: true, label: true })).max(100),
  optionCount: z.number().int().nonnegative(),
  suppliers: z.array(groupSchema),
  alternatives: z.array(groupSchema),
  priceContext: z.string(),
  servedAt: z.string(),
  affiliateDisclosure: z.string(),
});
export type CompareProductOutput = z.infer<typeof compareProductOutputSchema>;
export type CompareProductSuccess = Extract<CompareProductOutput, { ok: true }>;

export const getProductOptionsOutputSchema = publicResult({
  fields: z.array(optionFieldSchema),
  options: z.array(optionSchema).max(100),
  totalCount: z.number().int().nonnegative(),
  nextOffset: z.number().int().nullable(),
  defaultOptionKey: z.string().nullable(),
});
export type GetProductOptionsOutput = z.infer<
  typeof getProductOptionsOutputSchema
>;

export { publicErrorSchema };
