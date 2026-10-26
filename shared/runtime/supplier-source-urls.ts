import { createClosedStringLookup } from "./closed-string-lookup";
import { isTextValue } from "./text";

export type SupplierSourceUrlSupplier =
  | "customcat"
  | "fourthwall"
  | "gelato"
  | "inkthreadable"
  | "printful"
  | "printify"
  | "prodigi";

export type CustomCatSourceProduct = {
  catalog_product_id?: number;
  product_name?: unknown;
  product_colors?: unknown;
};

export function readCustomCatSourceProductName(
  product: CustomCatSourceProduct | null | undefined
): string | null | undefined {
  const name = product?.product_name;
  if (name === null || name === undefined || isTextValue(name)) return name;
  throw new TypeError("CustomCat source product name must be a string when present.");
}

export type PrintfulSourceUrlCandidateInput = {
  slug: string;
  categoryPath?: string | null;
  productTypeName?: string | null;
  productTitle?: string | null;
  specType?: string | null;
};

export type ProdigiSourceUrlBreadcrumb = {
  slug?: string | null;
};

const SOURCE_URL_BASES = {
  customcat: "https://customcat.com/products",
  fourthwall: "https://fourthwall.com/products",
  gelato: "https://www.gelato.com/custom",
  inkthreadable: "https://www.inkthreadable.co.uk",
  printful: "https://www.printful.com",
  printify: "https://printify.com/app/products",
  prodigi: "https://www.prodigi.com/products",
} as const;

const PRODIGI_SHARED_SAMPLE_PACK_SLUGS = new Set([
  "fine-art-sample-pack",
  "float-frames-sample-pack",
  "frames-sample-pack",
]);

const CUSTOMCAT_PUBLIC_CATEGORY_PATHS = {
  accessories: "custom-accessories/misc",
  activewear: "custom-apparel/athletic-apparel",
  baby: "custom-apparel/babies",
  backpacks: "custom-accessories/bags",
  bags: "custom-accessories/bags",
  blankets: "custom-housewares/blankets",
  "cinch-packs": "custom-accessories/bags",
  coolers: "custom-accessories/bags",
  "dress-shirts": "custom-apparel/button-up",
  drinkware: "custom-housewares/drinkware",
  "duffel-bags": "custom-accessories/bags",
  hats: "custom-apparel/hats",
  hoodies: "custom-apparel/hoodies",
  jackets: "custom-apparel/jackets",
  "long-sleeve": "custom-apparel/long-sleeve",
  pants: "custom-apparel/pants",
  "polo-shirts": "custom-apparel/polo-shirts",
  pullover: "custom-apparel/hoodies",
  shoes: "custom-accessories/footwear",
  shorts: "custom-apparel/pants",
  sweatpants: "custom-apparel/pants",
  sweatshirts: "custom-apparel/sweatshirts",
  "t-shirts": "custom-apparel/t-shirts",
  "tank-tops": "custom-apparel/tank-tops",
  towels: "custom-housewares/towels",
  "tote-bags": "custom-accessories/bags",
  "trucker-hats": "custom-apparel/hats",
  women: "custom-apparel/womens-apparel",
  workwear: "custom-apparel/workwear",
  youth: "custom-apparel/youth-apparel",
} satisfies Record<string, string>;

const PRINTFUL_GENERIC_SOURCE_PATHS = {
  apparel: ["custom/mens/all", "custom/womens/all"],
  bags: ["custom/bags/personalized"],
  drinkware: ["custom/mugs/personalized", "custom/home-living/all"],
  headwear: ["custom/hats/personalized"],
  "home-decor": ["custom/home-living/all", "custom/decor/personalized"],
  "pet-products": ["custom/pet-products/personalized"],
  "phone-cases": ["custom/phone-cases/personalized"],
  stationery: ["custom/stationery/personalized"],
  "wall-art": ["custom/wall-art/personalized", "custom/wall-art/posters"],
} satisfies Record<string, readonly string[]>;
const lookupCustomCatPublicCategoryPath = createClosedStringLookup(
  CUSTOMCAT_PUBLIC_CATEGORY_PATHS,
);
const lookupPrintfulGenericSourcePaths = createClosedStringLookup(
  PRINTFUL_GENERIC_SOURCE_PATHS,
);

export function slugifySupplierUrlPart(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['\u2019]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, "");
}

function dedupe<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function firstNonEmpty(
  ...values: Array<string | null | undefined>
): string | null {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return null;
}

export function buildPrintifySourceUrl(input: {
  blueprintId: string | number | null | undefined;
  brandName?: string | null;
  productName?: string | null;
}): string {
  const blueprintId = String(input.blueprintId ?? "").trim();
  const brandSlug = slugifySupplierUrlPart(input.brandName ?? "");
  const productSlug = slugifySupplierUrlPart(input.productName ?? "");

  if (!blueprintId) return "";
  if (!brandSlug || !productSlug) {
    return `${SOURCE_URL_BASES.printify}/${blueprintId}`;
  }

  return `${SOURCE_URL_BASES.printify}/${blueprintId}/${brandSlug}/${productSlug}`;
}

export function buildFourthwallSourceUrl(input: {
  slug: string | null | undefined;
}): string {
  const slug = slugifySupplierUrlPart(input.slug ?? "");
  return slug ? `${SOURCE_URL_BASES.fourthwall}/${slug}` : "";
}

/** Product membership is established by ingestion; this only validates its slug. */
export function buildInkthreadableSourceUrl(input: { slug: string }): string {
  const slug = input.slug.trim().replace(/^\/+|\/+$/g, "");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error("Invalid Inkthreadable product slug");
  }
  return `${SOURCE_URL_BASES.inkthreadable}/${slug}`;
}

export function buildProdigiSourceUrl(input: {
  slug: string | null | undefined;
  categoryPath?: string | null;
}): string {
  const slug = slugifySupplierUrlPart(input.slug ?? "");
  const categoryPath = normalizeProdigiPath(input.categoryPath ?? "");
  if (!slug) return "";

  // Prodigi retired the individual sample-pack detail pages. Its current
  // public search index exposes one shared page that owns all three API rows.
  if (PRODIGI_SHARED_SAMPLE_PACK_SLUGS.has(slug)) {
    return "https://www.prodigi.com/sample-pack/";
  }

  if (categoryPath) {
    // The public site uses the category path and product slug as separate
    // segments even when both segments happen to have the same value, e.g.
    // `/calendars/calendars/` and `/canvas/framed-canvas/framed-canvas/`.
    const fullPath = `${categoryPath}/${slug}`;
    return `${SOURCE_URL_BASES.prodigi}/${fullPath}/`;
  }

  return `${SOURCE_URL_BASES.prodigi}/${slug}`;
}

function normalizeProdigiPath(value: string): string {
  const path = trimSlashes(value).replace(/^products\//, "");
  return path
    .split("/")
    .map(part => slugifySupplierUrlPart(part))
    .filter(Boolean)
    .join("/");
}

function extractProdigiCategoryPathFromProductPath(
  path: string | null | undefined,
  slug: string
): string | null {
  const normalizedPath = normalizeProdigiPath(path ?? "");
  if (!normalizedPath || !slug) return null;
  if (normalizedPath === slug) return null;
  if (!normalizedPath.endsWith(`/${slug}`)) return null;
  return normalizedPath.slice(0, -`/${slug}`.length);
}

export function extractProdigiCategoryPath(input: {
  slug: string | null | undefined;
  parentCategorySlug?: string | null;
  breadcrumbs?: readonly ProdigiSourceUrlBreadcrumb[] | null;
  fallbackCategoryPath?: string | null;
}): string | null {
  const slug = slugifySupplierUrlPart(input.slug ?? "");
  if (!slug) return null;

  const parentPath = normalizeProdigiPath(input.parentCategorySlug ?? "");
  if (parentPath && parentPath !== slug && !parentPath.endsWith(`/${slug}`)) {
    return parentPath;
  }

  for (const breadcrumb of [...(input.breadcrumbs ?? [])].reverse()) {
    const categoryPath = extractProdigiCategoryPathFromProductPath(
      breadcrumb.slug,
      slug
    );
    if (categoryPath) return categoryPath;
  }

  const fallbackPath = normalizeProdigiPath(input.fallbackCategoryPath ?? "");
  return fallbackPath || null;
}

export function buildGelatoSourceUrl(input: {
  categoryId?: string | null;
  categoryPublicPath: string | null | undefined;
  localisedSlug: string | null | undefined;
  /** Exact product path returned by catalogProductDetails. */
  productPublicPath?: string | null;
}): string {
  const productPath = trimSlashes(input.productPublicPath ?? "").replace(
    /^custom\//,
    ""
  );
  if (productPath) return `${SOURCE_URL_BASES.gelato}/${productPath}`;

  const slug = slugifySupplierUrlPart(input.localisedSlug ?? "");
  let categoryPath = trimSlashes(input.categoryPublicPath ?? "");

  if (
    input.categoryId === "gelato:fine-art" ||
    categoryPath === "wall-art/fine-art" ||
    categoryPath === "wallart/fine-art"
  ) {
    categoryPath = "wall-art/posters";
  } else if (categoryPath.startsWith("wallart/")) {
    categoryPath = `wall-art/${categoryPath.slice("wallart/".length)}`;
  }

  return categoryPath && slug
    ? `${SOURCE_URL_BASES.gelato}/${categoryPath}/${slug}`
    : "";
}

export function extractGelatoCategoryPublicPathFromSourceUrl(
  sourceUrl: string | null | undefined,
  localisedSlug: string | null | undefined
): string | null {
  const slug = slugifySupplierUrlPart(localisedSlug ?? "");
  if (!sourceUrl || !slug) return null;

  try {
    const url = new URL(sourceUrl);
    if (url.hostname !== "www.gelato.com" && url.hostname !== "gelato.com") {
      return null;
    }
    const path = trimSlashes(url.pathname);
    const prefix = "custom/";
    const suffix = `/${slug}`;
    if (!path.startsWith(prefix) || !path.endsWith(suffix)) return null;
    return path.slice(prefix.length, -suffix.length);
  } catch {
    return null;
  }
}

function customCatPathFromSubcategory(
  subcategoryName: string | null | undefined,
  productName: string
): string {
  const subcategorySlug = slugifySupplierUrlPart(subcategoryName ?? "");
  if (subcategorySlug === "housewares") {
    if (
      /\b(airframe|canvas|poster|photo\s*tile|wall\s*art)\b/i.test(productName)
    ) {
      return "custom-housewares/wall-art";
    }
    if (/\b(pillow|case)\b/i.test(productName))
      return "custom-housewares/pillows";
    if (/\b(blanket)\b/i.test(productName)) return "custom-housewares/blankets";
    if (/\b(mug|tumbler|bottle|stein|drinkware)\b/i.test(productName)) {
      return "custom-housewares/drinkware";
    }
    return "custom-housewares";
  }

  return (
    lookupCustomCatPublicCategoryPath(subcategorySlug) ??
    (subcategorySlug ? `custom-apparel/${subcategorySlug}` : "custom-apparel")
  );
}

function customCatProductSlug(productName: string): string {
  return slugifySupplierUrlPart(
    productName.replace(/\b(\d+)\s*oz\b/gi, "$1 oz")
  );
}

function selectCustomCatPublicProduct(input: {
  product?: CustomCatSourceProduct | null;
  sourceProducts?: CustomCatSourceProduct[] | null;
  mergeStrategy?: string | null;
}): CustomCatSourceProduct | null {
  const products = [
    ...(input.sourceProducts?.filter(Boolean) ?? []),
    ...(input.product ? [input.product] : []),
  ];
  if (products.length === 0) return null;

  if (input.mergeStrategy === "mirrored-orientation") {
    return (
      products.find(product =>
        /\blandscape\b/i.test(`${product.product_name ?? ""}`)
      ) ?? products[0]!
    );
  }

  return products[0]!;
}

export function buildCustomCatSourceUrl(input: {
  product?: CustomCatSourceProduct | null;
  sourceProducts?: CustomCatSourceProduct[] | null;
  displayName?: string | null;
  subcategoryName?: string | null;
  mergeStrategy?: string | null;
}): string {
  const publicProduct = selectCustomCatPublicProduct(input);
  const productName = firstNonEmpty(
    readCustomCatSourceProductName(publicProduct),
    input.displayName
  );
  if (!productName) return "";

  // The authenticated catalog API often omits the model code that prefixes
  // CustomCat's public slug. Without that code, a reconstructed URL looks
  // plausible but returns 404. Script-side catalog ingestion resolves against
  // the public product index; neutral callers must use the safe catalog fallback.
  const [firstToken] = productName.trim().split(/\s+/);
  const hasPublicModelCode =
    firstToken !== undefined && /[a-z]/i.test(firstToken) && /\d/.test(firstToken);
  if (!hasPublicModelCode) return `${SOURCE_URL_BASES.customcat}/`;

  const categoryPath = customCatPathFromSubcategory(
    input.subcategoryName,
    productName
  );
  const productSlug = customCatProductSlug(productName);

  return `${SOURCE_URL_BASES.customcat}/${categoryPath}/${productSlug}/`;
}

export function buildPrintfulSourceUrlCandidates(
  input: PrintfulSourceUrlCandidateInput
): string[] {
  const categoryPath = trimSlashes(input.categoryPath ?? "");
  const rawSlug = slugifySupplierUrlPart(input.slug);
  const slug =
    categoryPath === "aprons/personalized" && rawSlug === "apron"
      ? "all-over-print-apron"
      : rawSlug;
  if (!slug) return [];

  const candidates: string[] = [];
  if (categoryPath && categoryPath.toLowerCase() !== "uncategorized") {
    candidates.push(
      `${SOURCE_URL_BASES.printful}/custom/${categoryPath}/${slug}`
    );
  }

  const searchText = [input.specType, input.productTypeName, input.productTitle]
    .join(" ")
    .toLowerCase();

  const inferredGroups: string[] = [];
  if (/\b(mug|bottle|tumbler|drinkware|glass|cup|stein)\b/.test(searchText)) {
    inferredGroups.push("drinkware");
  }
  if (/\b(poster|canvas|print|wall art|frame)\b/.test(searchText)) {
    inferredGroups.push("wall-art");
  }
  if (/\b(phone|case)\b/.test(searchText)) inferredGroups.push("phone-cases");
  if (/\b(hat|cap|beanie|visor)\b/.test(searchText))
    inferredGroups.push("headwear");
  if (/\b(bag|tote|backpack|duffel|pouch)\b/.test(searchText))
    inferredGroups.push("bags");
  if (/\b(pet|dog)\b/.test(searchText)) inferredGroups.push("pet-products");
  if (/\b(pillow|blanket|towel|decor|home)\b/.test(searchText)) {
    inferredGroups.push("home-decor");
  }
  if (
    /\b(card|notebook|sticker|calendar|stationery|journal)\b/.test(searchText)
  ) {
    inferredGroups.push("stationery");
  }
  if (
    /\b(shirt|hoodie|sweatshirt|tank|polo|tee|jacket|pants|leggings)\b/.test(
      searchText
    )
  ) {
    inferredGroups.push("apparel");
  }

  for (const group of dedupe([input.specType ?? "", ...inferredGroups])) {
    for (const path of lookupPrintfulGenericSourcePaths(group) ?? []) {
      candidates.push(`${SOURCE_URL_BASES.printful}/${path}/${slug}`);
    }
  }

  candidates.push(
    `${SOURCE_URL_BASES.printful}/custom/home-living/all/${slug}`
  );
  candidates.push(`${SOURCE_URL_BASES.printful}/custom-products/${slug}`);

  return dedupe(candidates);
}

export function extractPrintfulCanonicalUrl(html: string): string | null {
  const canonicalMatch =
    html.match(
      /<link\b[^>]*\brel=["']canonical["'][^>]*\bhref=["']([^"']+)["'][^>]*>/i
    ) ??
    html.match(
      /<link\b[^>]*\bhref=["']([^"']+)["'][^>]*\brel=["']canonical["'][^>]*>/i
    );
  const canonical = canonicalMatch?.[1]?.trim();
  if (!canonical) return null;

  try {
    const url = new URL(canonical, SOURCE_URL_BASES.printful);
    if (
      url.hostname !== "www.printful.com" &&
      url.hostname !== "printful.com"
    ) {
      return null;
    }
    if (!url.pathname.startsWith("/custom/")) return null;
    url.hash = "";
    url.search = "";
    return url.toString();
  } catch {
    return null;
  }
}

export function stripSupplierUrlQuery(sourceUrl: string): string {
  try {
    const url = new URL(sourceUrl);
    url.hash = "";
    url.search = "";
    return url.toString();
  } catch {
    return sourceUrl;
  }
}
