import type { z } from "zod";
import { formatSupplierList } from "../runtime/suppliers";
import {
  getProductInputSchema,
  getProductOutputSchema,
  listCategoriesInputSchema,
  listCategoriesOutputSchema,
  resolveSupplierLinkInputSchema,
  resolveSupplierLinkOutputSchema,
  searchProductsInputSchema,
  searchProductsOutputSchema,
} from "./catalog";
import {
  compareProductInputSchema,
  compareProductOutputSchema,
  getProductOptionsInputSchema,
  getProductOptionsOutputSchema,
} from "./comparison";
import {
  getSupplierInputSchema,
  getSupplierOutputSchema,
  getSupplierPricesInputSchema,
  getSupplierPricesOutputSchema,
  listSuppliersInputSchema,
  listSuppliersOutputSchema,
  supplierGuideInputSchema,
  supplierGuideOutputSchema,
} from "./suppliers";

const SUPPLIERS = formatSupplierList("and");
const DESTINATIONS = "Supported destinations: US, GB, DE, AU, CA.";

/**
 * Every public capability. MCP registers each entry as a tool; the CLI maps
 * commands onto the same names; the site serves each at
 * `/api/v1/tools/<name>`. One input and output contract per capability.
 */
export const PUBLIC_TOOLS = {
  search_products: {
    title: "Search POD Benchmark products",
    description: `Use this when a seller wants to find a print-on-demand (POD) product to compare across suppliers such as ${SUPPLIERS}. Search by product type such as T-shirt, hoodie or mug, or by brand and model such as Bella+Canvas 3001 or Gildan 5000, and filter by category, brand, supplier, audience, specs (fit, material, eco and more) or weight. Returns product ids, a starting delivered price for the destination and optional filter counts; compare a specific size or colour with compare_product. ${DESTINATIONS}`,
    inputSchema: searchProductsInputSchema,
    outputSchema: searchProductsOutputSchema,
    cacheSeconds: 600,
  },
  list_categories: {
    title: "List product categories",
    description:
      "Use this to browse POD Benchmark's product categories, with product counts and starting delivered prices for a destination. Pass a category id to search_products to list its products.",
    inputSchema: listCategoriesInputSchema,
    outputSchema: listCategoriesOutputSchema,
    cacheSeconds: 3600,
  },
  get_product: {
    title: "Read a product's details",
    description:
      "Use this when a seller asks about a product's specs, fabric, fit, print methods or what is similar to it. Returns curated product facts and similar products with what they share and how they differ. Specs describe the product; they do not promise every supplier offers every option.",
    inputSchema: getProductInputSchema,
    outputSchema: getProductOutputSchema,
    cacheSeconds: 3600,
  },
  get_product_options: {
    title: "Find product configurations",
    description: `Use this when a seller wants supplier pricing for a specific print-on-demand product size or color, such as an adult M black T-shirt or an 11 oz mug. Lists the product's fields and supported configurations for the destination and currency; narrow with words or choices. Pass a returned key as optionKey, or its choices, to compare_product. Search products first to obtain canonicalProductId. ${DESTINATIONS}`,
    inputSchema: getProductOptionsInputSchema,
    outputSchema: getProductOptionsOutputSchema,
    cacheSeconds: 600,
  },
  compare_product: {
    title: "Compare print-on-demand suppliers",
    description: `Use this when a seller asks which print-on-demand (POD) supplier costs less for a product, wants a Printify vs Printful product comparison, or needs to compare product prices, shipping costs, delivered totals or estimated delivery times. Compares ${SUPPLIERS} wherever the product has supplier offers. Useful for Etsy and Shopify sellers choosing where to fulfill T-shirts, hoodies, mugs and other POD products. Compare one product and configuration for a destination and currency. Search products first; for a specified size or color pass choices or an optionKey from get_product_options. With neither, it uses the product's usual configuration and returns its label. Unknown costs remain null; similar products stay separate; affiliate links never change rankings. Paid plans must be explicitly requested; base is standard pricing. supplier shows one supplier's every product and print provider for the choice. Optional seller context, passed only when the seller already said it and never guessed: yourSupplier (the supplier they use now, so it is pinned first and every other row shows the difference per sale), and sellingPrice in the chosen currency, or targetMargin in percent to get the price to charge, with salesChannel (etsy, shopify, woocommerce, tiktok-shop) and shopLocation (the country their shop is in) to apply approved platform fees. Whenever the seller mentions their supplier, selling price, margin or platform, call this tool again with those fields instead of estimating profit yourself. If a price or margin arrives without salesChannel or shopLocation, the result lists what to ask. Profit is an estimate before tax from approved fee research. ${DESTINATIONS} Comparison totals and rankings are product + shipping. Supplier-billed duty is separate: an established amount, zero, bounded estimate or unverified amount. Profit deducts established duty or a converted estimate. Show one estimated duty amount using the converted upper endpoint, or the native upper endpoint marked not converted; do not narrate min–max ranges. Unverified duty or an unconverted native estimate leaves profit before that charge. Estimated or unverified duty never supports a best actual-profit claim in either profit mode; conditional design/setup prices do not establish a winner or gap. VAT, sales tax and customer-paid import charges are excluded or explicitly marked unknown. Do not use for ordering, store integrations, print-quality rankings or unsupported destinations.`,
    inputSchema: compareProductInputSchema,
    outputSchema: compareProductOutputSchema,
    cacheSeconds: 300,
  },
  resolve_supplier_link: {
    title: "Find the product behind a supplier link",
    description:
      `Use this when a seller pastes a supplier product link (${formatSupplierList("or")}). Returns the matching POD Benchmark product and any colour the link selects, ready for compare_product with yourSupplier set to that supplier. It never opens the link.`,
    inputSchema: resolveSupplierLinkInputSchema,
    outputSchema: resolveSupplierLinkOutputSchema,
    cacheSeconds: 3600,
  },
  list_suppliers: {
    title: "List suppliers",
    description:
      "Use this to list the print-on-demand suppliers POD Benchmark compares, with their type and website.",
    inputSchema: listSuppliersInputSchema,
    outputSchema: listSuppliersOutputSchema,
    cacheSeconds: 3600,
  },
  get_supplier: {
    title: "Read a supplier's facts",
    description:
      "Use this when a seller asks how a supplier works: plans and monthly fees, custom branding, who handles checkout, support and refunds, where it prints, or which print providers a marketplace uses. Facts carry their verification date and sources. Production locations are what the supplier reports, not a promise that a given product ships from there.",
    inputSchema: getSupplierInputSchema,
    outputSchema: getSupplierOutputSchema,
    cacheSeconds: 3600,
  },
  get_supplier_prices: {
    title: "Where a supplier is cheapest",
    description:
      "Use this when a seller asks how a supplier's prices compare overall, by category, or against one other supplier: how many products it is the cheapest for, where it costs more, and by how much. Uses each product's usual configuration delivered to the destination; checkedAt is the supplier's latest price scrape.",
    inputSchema: getSupplierPricesInputSchema,
    outputSchema: getSupplierPricesOutputSchema,
    cacheSeconds: 3600,
  },
  supplier_guide: {
    title: "Which suppliers fit a shop",
    description:
      "Use this when a seller is choosing a supplier for a product type (t-shirts, hoodies, mugs, wall art, stickers or phone cases) and their shop: where buyers are, the platform, whether they need custom branding, want to start free, or want to choose their print provider. Returns suppliers that fit, that need a check, and that don't, each with dated reasons and sources, plus a delivered price range for an example product. No AI ranking.",
    inputSchema: supplierGuideInputSchema,
    outputSchema: supplierGuideOutputSchema,
    cacheSeconds: 1800,
  },
} as const;

export type PublicToolName = keyof typeof PUBLIC_TOOLS;
export const PUBLIC_TOOL_NAMES = [
  "search_products",
  "list_categories",
  "get_product",
  "get_product_options",
  "compare_product",
  "resolve_supplier_link",
  "list_suppliers",
  "get_supplier",
  "get_supplier_prices",
  "supplier_guide",
] as const satisfies readonly PublicToolName[];
// Every registered tool is listed above.
type UnlistedTools = Exclude<
  PublicToolName,
  (typeof PUBLIC_TOOL_NAMES)[number]
>;
const allToolsListed: [UnlistedTools] extends [never] ? true : never = true;
void allToolsListed;
export type PublicToolInput<Name extends PublicToolName> = z.input<
  (typeof PUBLIC_TOOLS)[Name]["inputSchema"]
>;
export type PublicToolOutput<Name extends PublicToolName> = z.output<
  (typeof PUBLIC_TOOLS)[Name]["outputSchema"]
>;
/** Validated arguments for any tool, as sent to `/api/v1/tools/<name>`. */
export type PublicToolArguments = {
  [Name in PublicToolName]: z.output<
    (typeof PUBLIC_TOOLS)[Name]["inputSchema"]
  >;
}[PublicToolName];
export const PUBLIC_TOOL_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

export function isPublicToolName(value: string): value is PublicToolName {
  return Object.hasOwn(PUBLIC_TOOLS, value);
}

export * from "./common";
export * from "./catalog";
export * from "./comparison";
export * from "./suppliers";
