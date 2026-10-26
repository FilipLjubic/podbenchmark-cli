import { z } from "zod";
import { CurrencySchema } from "../pricing/schema";
import { canonicalPathSegmentSchema } from "../product-search/identity";
import { TARGET_DESTINATIONS } from "../runtime/enums";
import { SPEC_FACETS } from "../site/spec-facets";
import {
  destinationSchema,
  optionalCurrencySchema,
  pageInputShape,
  pageOutputShape,
  PUBLIC_SUPPLIER_IDS,
  publicIdSchema,
  publicResult,
  supplierIdSchema,
} from "./common";

export const SEARCH_SORTS = [
  "relevance",
  "cheapest",
  "priciest",
  "most-suppliers",
  "name",
] as const;

export const searchProductsInputSchema = z
  .strictObject({
    query: z
      .string()
      .trim()
      .max(200)
      .default("")
      .describe(
        "Product type, brand or model, such as `hoodie` or `bella canvas 3001`. Leave empty to browse with filters."
      ),
    category: publicIdSchema
      .optional()
      .describe("A category id from list_categories, such as `t-shirts`."),
    brands: z.array(publicIdSchema).max(20).default([]),
    suppliers: z
      .array(supplierIdSchema)
      .max(PUBLIC_SUPPLIER_IDS.length)
      .default([])
      .describe("Only products at least one of these suppliers sells."),
    audiences: z
      .array(publicIdSchema)
      .max(10)
      .default([])
      .describe("Such as unisex, mens, womens or kids."),
    specs: z
      .partialRecord(
        z.enum(SPEC_FACETS),
        z.array(publicIdSchema).min(1).max(30)
      )
      .default({})
      .describe(
        'Spec filters, any value per field, such as { "fit": ["classic"], "material": ["cotton"] }. includeFacets lists the values.'
      ),
    minWeightOz: z.number().finite().nonnegative().max(100).optional(),
    maxWeightOz: z.number().finite().nonnegative().max(100).optional(),
    pricedOnly: z
      .boolean()
      .default(false)
      .describe("Only products with a delivered price for the destination."),
    sort: z.enum(SEARCH_SORTS).default("relevance"),
    destination: destinationSchema.default("US"),
    currency: optionalCurrencySchema,
    includeFacets: z
      .boolean()
      .default(false)
      .describe("Also count brands, suppliers, audiences and spec values."),
    ...pageInputShape,
  })
  .refine(
    value =>
      value.minWeightOz === undefined ||
      value.maxWeightOz === undefined ||
      value.minWeightOz <= value.maxWeightOz,
    "minWeightOz cannot exceed maxWeightOz."
  );
export type SearchProductsInput = z.infer<typeof searchProductsInputSchema>;

const facetValueSchema = z.strictObject({
  value: z.string(),
  count: z.number().int().nonnegative(),
});
const searchProductSchema = z.strictObject({
  canonicalProductId: canonicalPathSegmentSchema,
  name: z.string(),
  brand: z.string().nullable(),
  category: z.string(),
  url: z.url(),
  audience: z.string(),
  weightOz: z.number().nullable(),
  highlights: z.array(z.string()),
  suppliers: z.array(z.string()),
  /** Suppliers with a delivered price for the destination. */
  pricedSuppliers: z.array(z.string()),
  /**
   * The lowest delivered price (product plus shipping) across suppliers'
   * usual configuration; null when no supplier has one. Compare a specific
   * size or colour with compare_product.
   */
  startingPrice: z.number().nullable(),
});
export const searchProductsOutputSchema = publicResult({
  destination: z.enum(TARGET_DESTINATIONS),
  currency: CurrencySchema,
  products: z.array(searchProductSchema),
  ...pageOutputShape,
  facets: z
    .strictObject({
      brands: z.array(facetValueSchema),
      suppliers: z.array(facetValueSchema),
      audiences: z.array(facetValueSchema),
      specs: z.record(z.string(), z.array(facetValueSchema)),
    })
    .nullable(),
});
export type SearchProductsOutput = z.infer<typeof searchProductsOutputSchema>;

export const listCategoriesInputSchema = z.strictObject({
  query: z.string().trim().max(200).default(""),
  parent: publicIdSchema
    .optional()
    .describe("Only the children of this category."),
  destination: destinationSchema.default("US"),
  currency: optionalCurrencySchema,
  ...pageInputShape,
  limit: z.number().int().min(1).max(100).default(50),
});
export const listCategoriesOutputSchema = publicResult({
  destination: z.enum(TARGET_DESTINATIONS),
  currency: CurrencySchema,
  categories: z.array(
    z.strictObject({
      id: z.string(),
      name: z.string(),
      parent: z.string().nullable(),
      url: z.url(),
      productCount: z.number().int().nonnegative(),
      pricedProductCount: z.number().int().nonnegative(),
      supplierCount: z.number().int().nonnegative(),
      startingPrice: z.number().nullable(),
    })
  ),
  ...pageOutputShape,
});

export const getProductInputSchema = z.strictObject({
  canonicalProductId: canonicalPathSegmentSchema,
  similarLimit: z.number().int().min(0).max(20).default(5),
});
export const getProductOutputSchema = publicResult({
  product: z.strictObject({
    canonicalProductId: z.string(),
    name: z.string(),
    brand: z.string().nullable(),
    model: z.string().nullable(),
    category: z.strictObject({ id: z.string(), name: z.string() }).nullable(),
    url: z.url().nullable(),
    audience: z.string().nullable(),
    description: z.string().nullable(),
    highlights: z.array(z.string()),
    printMethods: z.array(z.string()),
    specs: z.record(z.string(), z.string()),
    faqs: z.array(z.strictObject({ question: z.string(), answer: z.string() })),
  }),
  similar: z.array(
    z.strictObject({
      canonicalProductId: z.string(),
      name: z.string(),
      url: z.url(),
      similarity: z.string(),
      sharedTraits: z.array(z.string()),
      differences: z.array(z.string()),
    })
  ),
  similarCount: z.number().int().nonnegative(),
});

export const resolveSupplierLinkInputSchema = z.strictObject({
  url: z
    .string()
    .trim()
    .min(1)
    .max(4096)
    .describe(
      "A supplier's product page, such as a Printify or Printful product link."
    ),
});
const resolvedChoiceSchema = z.strictObject({
  canonicalProductId: z.string(),
  name: z.string(),
  supplierId: z.string(),
  supplierProductName: z.string().nullable(),
  url: z.url(),
  /** What the link selects, ready for compare_product `choices`; empty for the product's usual choice. */
  choices: z.record(z.string(), z.string()),
});
export const resolveSupplierLinkOutputSchema = publicResult({
  status: z.enum([
    "resolved",
    "ambiguous",
    "unsupported",
    "no-match",
    "configuration-unavailable",
    "unavailable",
  ]),
  /** The match when resolved; every candidate when ambiguous. */
  matches: z.array(resolvedChoiceSchema),
  message: z.string(),
});
