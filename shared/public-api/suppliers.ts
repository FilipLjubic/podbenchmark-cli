import { z } from "zod";
import { CurrencySchema } from "../pricing/schema";
import { TARGET_DESTINATIONS } from "../runtime/enums";
import {
  destinationSchema,
  optionalCurrencySchema,
  pageInputShape,
  pageOutputShape,
  publicIdSchema,
  publicResult,
  supplierIdSchema,
  PUBLIC_PRICING_TIERS,
} from "./common";

const supplierSchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  /** `marketplace` routes orders to independent print providers. */
  type: z.string().nullable(),
  website: z.url(),
  url: z.url(),
});
const sourceSchema = z.strictObject({ label: z.string(), url: z.url() });

export const listSuppliersInputSchema = z.strictObject({
  query: z.string().trim().max(200).default(""),
  ...pageInputShape,
});
export const listSuppliersOutputSchema = publicResult({
  suppliers: z.array(supplierSchema),
  ...pageOutputShape,
});

export const getSupplierInputSchema = z.strictObject({
  supplierId: supplierIdSchema,
  include: z
    .array(z.enum(["facts", "locations", "providers"]))
    .max(3)
    .default(["facts"])
    .describe(
      "facts: plans, fees, branding and who handles what. locations: where it reports printing. providers: a marketplace's print providers."
    ),
  country: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .optional()
    .describe("Only production locations in this country, such as US."),
  provider: publicIdSchema.optional(),
  ...pageInputShape,
});
export const getSupplierOutputSchema = publicResult({
  supplier: supplierSchema,
  activeListingCount: z.number().int().nonnegative().nullable(),
  introduction: z.string().nullable(),
  summary: z.array(
    z.strictObject({
      label: z.string(),
      value: z.string(),
      detail: z.string().nullable(),
    })
  ),
  facts: z
    .strictObject({
      items: z.array(
        z.strictObject({
          title: z.string(),
          summary: z.string().nullable(),
          detail: z.string().nullable(),
          status: z.string(),
          verifiedAt: z.string().nullable(),
          sources: z.array(sourceSchema),
        })
      ),
      ...pageOutputShape,
    })
    .nullable(),
  providers: z
    .strictObject({
      items: z.array(z.strictObject({ id: z.string(), name: z.string() })),
      ...pageOutputShape,
    })
    .nullable(),
  locations: z
    .strictObject({
      countries: z.array(
        z.strictObject({
          countryCode: z.string(),
          countryName: z.string(),
          locationCount: z.number().int().nonnegative(),
        })
      ),
      items: z.array(
        z.strictObject({
          label: z.string(),
          countryCode: z.string(),
          provider: z.string().nullable(),
        })
      ),
      ...pageOutputShape,
      checkedAt: z.string().nullable(),
    })
    .nullable(),
});

export const getSupplierPricesInputSchema = z.strictObject({
  supplierId: supplierIdSchema,
  versus: supplierIdSchema
    .optional()
    .describe("Compare against this supplier only, instead of every other one."),
  category: publicIdSchema.optional(),
  search: z.string().trim().max(200).default(""),
  within: z
    .discriminatedUnion("kind", [
      z.strictObject({
        kind: z.literal("amount"),
        amount: z.number().finite().nonnegative().max(1000),
      }),
      z.strictObject({
        kind: z.literal("percent"),
        percent: z.number().finite().nonnegative().max(100),
      }),
    ])
    .default({ kind: "amount", amount: 1 })
    .describe("How close to the cheapest still counts as near-cheapest."),
  pricingTier: z.enum(PUBLIC_PRICING_TIERS).default("base"),
  destination: destinationSchema.default("US"),
  currency: optionalCurrencySchema,
  ...pageInputShape,
  categoryLimit: z.number().int().min(0).max(50).default(10),
});
const priceProductSchema = z.strictObject({
  canonicalProductId: z.string(),
  name: z.string(),
  url: z.url().nullable(),
  option: z.string(),
  delivered: z.number(),
  /** The competitor's (or cheapest other supplier's) delivered price. */
  otherDelivered: z.number().nullable(),
  otherSupplier: z.string().nullable(),
  gap: z.number(),
});
const tallySchema = z.strictObject({
  compared: z.number().int().nonnegative(),
  cheapest: z.number().int().nonnegative(),
  tied: z.number().int().nonnegative(),
  cheaperElsewhere: z.number().int().nonnegative(),
  nearCheapest: z.number().int().nonnegative(),
  medianWinningGap: z.number().nullable(),
  medianLosingGap: z.number().nullable(),
});
export const getSupplierPricesOutputSchema = publicResult({
  status: z.enum(["ready", "unavailable"]),
  destination: z.enum(TARGET_DESTINATIONS),
  currency: CurrencySchema,
  checkedAt: z.string().nullable(),
  overview: tallySchema.nullable(),
  categories: z.array(
    tallySchema.extend({ id: z.string(), name: z.string() })
  ),
  cheapest: z.strictObject({
    items: z.array(priceProductSchema),
    ...pageOutputShape,
  }),
  cheaperElsewhere: z.strictObject({
    items: z.array(priceProductSchema),
    ...pageOutputShape,
  }),
});

export const SUPPLIER_GUIDE_PRODUCT_TYPES = [
  "t-shirts",
  "hoodies",
  "mugs",
  "wall-art",
  "stickers",
  "phone-cases",
] as const;
export const supplierGuideInputSchema = z.strictObject({
  productType: z.enum(SUPPLIER_GUIDE_PRODUCT_TYPES).default("t-shirts"),
  destination: destinationSchema.default("US"),
  salesChannel: z
    .enum(["shopify", "etsy", "woocommerce", "tiktok-shop"])
    .optional()
    .describe("Where the seller sells. Leave out if they haven't decided."),
  shopLocation: z.enum(TARGET_DESTINATIONS).optional(),
  needsCustomBranding: z.boolean().default(false),
  wantsFreeStart: z.boolean().default(false),
  wantsToChooseProvider: z.boolean().default(false),
  ...pageInputShape,
});
const guideReasonSchema = z.strictObject({
  status: z.string(),
  label: z.string(),
  detail: z.string(),
  checkedAt: z.string().nullable(),
  source: sourceSchema.nullable(),
});
const guideSupplierSchema = z.strictObject({
  supplierId: z.string(),
  name: z.string(),
  url: z.url(),
  reasons: z.array(guideReasonSchema),
});
const guideListSchema = z.strictObject({
  items: z.array(guideSupplierSchema),
  ...pageOutputShape,
});
export const supplierGuideOutputSchema = publicResult({
  state: z.string(),
  productType: z.string(),
  destination: z.enum(TARGET_DESTINATIONS),
  /** The product the delivered prices refer to. */
  exampleProduct: z
    .strictObject({
      canonicalProductId: z.string(),
      name: z.string(),
      option: z.string().nullable(),
      url: z.url(),
    })
    .nullable(),
  fits: guideListSchema,
  needsCheck: guideListSchema,
  doesNotFit: guideListSchema,
  deliveredRange: z
    .strictObject({
      minimum: z.number(),
      maximum: z.number(),
      currency: CurrencySchema,
    })
    .nullable(),
});
