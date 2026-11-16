import { z } from "zod";
import { createClosedStringLookup } from "../kernel/closed-string-lookup";

/**
 * A supplier product's data in three lanes:
 *
 * - raw: verbatim API responses (audit log), stored locally in
 *   ProductRawEvidence and never published
 * - specs: all processed/extracted data (discriminated union), Product.specs
 * - specSources: provenance tracking, Product.specSources
 *
 * Types are inferred from Zod schemas - single source of truth.
 */

// =============================================================================
// SPEC SOURCES (Provenance)
// =============================================================================

export const specSourceTypeSchema = z.enum([
  "api",
  "text",
  "infer",
  "lookup",
  "manual",
  "vision",
]);

export const specSourceSchema = z.object({
  source: specSourceTypeSchema,
  rawPath: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  note: z.string().optional(),
});

export const specSourcesSchema = z.record(z.string(), specSourceSchema);

// =============================================================================
// COMPONENT-SCOPED FACTS
// =============================================================================

/**
 * Controlled roles for facts that would be ambiguous when flattened onto a
 * composite product. Keep this vocabulary intentionally small and independent
 * of supplier terminology.
 */
export const componentRoleSchema = z.enum([
  "finished-product",
  "printable-surface",
  "substrate-core",
  "decorative-frame",
  "stretcher-frame",
  "stand-base",
  "mount-hardware",
  "insert-liner",
  "unknown",
]);

const componentFactFieldSchema = z.enum([
  "material",
  "construction",
  "finish",
  "thicknessMm",
  "weightGsm",
]);

const componentScopeSourceSchema = z.enum([
  "explicit",
  "parsed",
  "inferred",
  "unknown",
]);

const componentFactValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
]);

export const componentSpecFactSchema = z.object({
  field: componentFactFieldSchema,
  value: componentFactValueSchema,
  componentRole: componentRoleSchema,
  scopeSource: componentScopeSourceSchema,
  rawEvidence: z.string().min(1),
  source: specSourceSchema,
});

// =============================================================================
// RAW DATA (Verbatim API Responses)
// =============================================================================

const cacheReferenceSchema = z.object({
  key: z.string(),
  url: z.string(),
});

export const rawDataSchema = z.object({
  supplierId: z.string(),
  fetchedAt: z.iso.datetime(),
  payloads: z.record(z.string(), z.unknown()),
  cache: z.record(z.string(), cacheReferenceSchema).optional(),
  sourceCategories: z.array(z.string()).optional(),
});

// =============================================================================
// SPECS (Processed Data - Discriminated Union)
// =============================================================================

const baseSpecFields = {
  /** @deprecated Variant-level field — will migrate to ProductVariant.data.variantSpecs */
  printTechnology: z.string().optional(),
  // Phase 1 boundary: raw subtype remains freeform string input.
  // Canonical-sensitive consumers must parse/assert through shared helpers first.
  subtype: z.string().optional(),
  ecoFriendly: z.string().nullable().optional(),
  careInstructions: z.string().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  componentFacts: z.array(componentSpecFactSchema).optional(),
};

/** Necklines the canonical apparel spec accepts. */
export const APPAREL_NECKLINES = [
  "crew",
  "v-neck",
  "scoop",
  "henley",
  "racerback",
  "hooded",
  "polo",
  "mock",
  "collar",
  "lap-shoulder",
] as const;
export type ApparelNeckline = (typeof APPAREL_NECKLINES)[number];

/** Construction facts the canonical apparel spec accepts. */
export const APPAREL_CONSTRUCTIONS = [
  "side-seamed",
  "tubular",
  "set-in-sleeve",
  "raglan",
  "drop-shoulder",
  "rolled-forward-shoulder",
  "lap-shoulder",
  "reinforced",
  "knit-specific",
] as const;
export type ApparelConstruction = (typeof APPAREL_CONSTRUCTIONS)[number];

/** Fits the canonical apparel spec accepts. */
export const APPAREL_FITS = [
  "regular",
  "slim",
  "relaxed",
  "oversized",
  "retail",
  "classic",
  "fitted",
  "boxy",
  "modern",
  "athletic",
  "tapered",
] as const;
export type ApparelFit = (typeof APPAREL_FITS)[number];

/** Sleeve lengths the canonical apparel spec accepts. */
export const APPAREL_SLEEVES = ["short", "long", "sleeveless", "3/4"] as const;
export type ApparelSleeve = (typeof APPAREL_SLEEVES)[number];

export const apparelSpecsSchema = z.object({
  type: z.literal("apparel"),
  audienceAgeGroup: z.string().optional(),
  audienceGenderFit: z.string().optional(),
  fabric: z.string().optional(),
  weight: z.string().optional(),
  fit: z.enum(APPAREL_FITS).optional(),
  neckline: z.enum(APPAREL_NECKLINES).optional(),
  sleeve: z.enum(APPAREL_SLEEVES).optional(),
  construction: z.enum(APPAREL_CONSTRUCTIONS).optional(),
  constructionRaw: z.string().optional(),
  yarnType: z
    .enum([
      "ring-spun",
      "open-end",
      "combed-ring-spun",
      "airlume-combed",
      "carded",
      "combed",
      "organic",
    ])
    .optional(),
  fabricBlendCategory: z
    .enum([
      "100-cotton",
      "cotton-poly",
      "tri-blend",
      "100-polyester",
      "100-acrylic",
      "acrylic-blend",
      "polyester-blend",
      "100-nylon",
      "cotton-modal",
      "bamboo-blend",
    ])
    .optional(),
  labelType: z
    .enum(["tear-away", "woven", "printed", "satin", "tagless", "twill"])
    .optional(),
  ...baseSpecFields,
});

export const drinkwareSpecsSchema = z.object({
  type: z.literal("drinkware"),
  material: z
    .enum([
      "ceramic",
      "stainless-steel",
      "steel",
      "aluminum",
      "glass",
      "plastic",
      "acrylic",
      "enamel",
      "neoprene",
      "bone-china",
      "enamel-steel",
      "porcelain",
    ])
    .optional(),
  capacity: z.string().optional(),
  insulated: z.boolean().optional(),
  lidIncluded: z.boolean().optional(),
  shape: z
    .enum([
      "mug",
      "tumbler",
      "bottle",
      "stein",
      "travel-mug",
      "cup",
      "wine-tumbler",
      "shot-glass",
    ])
    .optional(),
  doubleWall: z.boolean().optional(),
  dishwasherSafe: z.boolean().optional(),
  microwaveSafe: z.boolean().optional(),
  ...baseSpecFields,
});

export const wallArtSpecsSchema = z.object({
  type: z.literal("wall-art"),
  material: z
    .enum([
      "canvas",
      "paper",
      "metal",
      "acrylic",
      "wood",
      "foam",
      "poster",
      "ceramic",
      "polyester",
    ])
    .optional(),
  finish: z.enum(["matte", "glossy", "satin", "semi-glossy", "metallic"]).optional(),
  frameIncluded: z.boolean().optional(),
  hangingHardware: z.boolean().optional(),
  frameMaterial: z.string().optional(),
  printMethod: z
    .enum([
      "giclée",
      "inkjet",
      "dye-sublimation",
      "screen-print",
      "uv-direct",
      "offset",
    ])
    .optional(),
  edgeTreatment: z
    .enum([
      "gallery-wrapped",
      "mirrored-edge",
      "white-edge",
      "black-edge",
      "image-edge",
    ])
    .optional(),
  substrateWeightGsm: z.number().optional(),
  thicknessMm: z.number().optional(),
  /** Specific supplier paper stock; grade/picker families remain derived. */
  paperType: z.string().optional(),
  coating: z.enum(["uncoated", "coated-silk", "enhanced-uncoated"]).optional(),
  /** Supplier's paper wording, not a texture rating or a whiteness measurement. */
  paperTexture: z.string().optional(),
  paperBaseTone: z.string().optional(),
  wrapDepthMm: z.number().optional(),
  mountType: z
    .enum([
      "flush-mount",
      "standoff",
      "float-mount",
      "wire-hanger",
      "sawtooth",
      "french-cleat",
      "keyhole",
    ])
    .optional(),
  canvasBlend: z
    .enum([
      "cotton",
      "polyester",
      "poly-cotton",
      "100% polyester",
      "100% cotton",
      "cotton/polyester",
    ])
    .optional(),
  paperClass: z.enum(["poster", "fine_art", "photo", "specialty"]).optional(),
  inkType: z.enum(["pigment", "dye"]).optional(),
  archivalGrade: z.enum(["archival", "standard"]).optional(),
  ...baseSpecFields,
});

export const homeDecorSpecsSchema = z.object({
  type: z.literal("home-decor"),
  material: z.string().optional(),
  finish: z.enum(["matte", "glossy", "satin"]).optional(),
  /** @deprecated Variant-level field — will migrate to ProductVariant.data.variantSpecs */
  printSides: z.enum(["single", "double"]).optional(),
  fillIncluded: z.boolean().optional(),
  closure: z
    .enum(["zipper", "envelope", "button", "snap", "sewn-seam", "none"])
    .optional(),
  frameIncluded: z.boolean().optional(),
  hangingHardware: z.boolean().optional(),
  frameMaterial: z.string().optional(),
  printMethod: z
    .enum([
      "giclée",
      "inkjet",
      "dye-sublimation",
      "screen-print",
      "uv-direct",
      "offset",
    ])
    .optional(),
  ...baseSpecFields,
});

export const accessoriesSpecsSchema = z.object({
  type: z.literal("accessories"),
  material: z.string().optional(),
  finish: z.enum(["matte", "glossy", "satin"]).optional(),
  dimensions: z.string().optional(),
  baseMetal: z
    .enum([
      "stainless-steel",
      "sterling-silver",
      "brass",
      "zinc-alloy",
      "copper",
    ])
    .optional(),
  plating: z
    .enum(["gold", "silver", "rose-gold", "rhodium", "none"])
    .optional(),
  stickerCut: z.enum(["kiss-cut", "die-cut", "sheet"]).optional(),
  ...baseSpecFields,
});

export const stationerySpecsSchema = z.object({
  type: z.literal("stationery"),
  material: z.string().optional(),
  paperWeightGsm: z.number().optional(),
  paperType: z
    .enum([
      "matte",
      "glossy",
      "uncoated",
      "kraft",
      "recycled",
      "photo",
      "coated-silk",
    ])
    .optional(),
  finish: z.enum(["matte", "glossy", "satin", "semi-glossy", "uncoated"]).optional(),
  bindingType: z.string().optional(),
  coverPaperWeightGsm: z.number().optional(),
  pages: z.number().optional(),
  /** @deprecated Variant-level field — will migrate to ProductVariant.data.variantSpecs */
  pageRange: z
    .object({ min: z.number(), max: z.number(), step: z.number() })
    .optional(),
  /** @deprecated Variant-level field — will migrate to ProductVariant.data.variantSpecs */
  printSides: z.enum(["single", "double"]).optional(),
  coating: z.string().optional(),
  stickerCut: z.enum(["kiss-cut", "die-cut", "sheet"]).optional(),
  weatherproof: z.boolean().optional(),
  ...baseSpecFields,
});

export const phoneCaseSpecsSchema = z.object({
  type: z.literal("phone-cases"),
  caseType: z
    .enum(["flexi", "tough", "clear", "snap", "rubber", "slim", "bio"])
    .optional(),
  material: z.enum(["silicone", "hard-plastic", "tpu", "leather"]).optional(),
  finish: z.enum(["matte", "glossy", "satin"]).optional(),
  protection: z.enum(["slim", "standard", "rugged"]).optional(),
  magSafeCompatible: z.boolean().optional(),
  wirelessCharging: z.boolean().optional(),
  coverage: z.enum(["full-wrap", "back-only", "back-and-sides"]).optional(),
  ...baseSpecFields,
});

export const bagSpecsSchema = z.object({
  type: z.literal("bags"),
  material: z.string().optional(),
  capacity: z.string().optional(),
  compartments: z.number().optional(),
  closure: z
    .enum([
      "zipper",
      "drawstring",
      "snap",
      "open-top",
      "flap",
      "roll-top",
      "buckle",
      "velcro",
      "magnetic",
    ])
    .optional(),
  ...baseSpecFields,
});

export const headwearSpecsSchema = z.object({
  type: z.literal("headwear"),
  material: z.string().optional(),
  closure: z
    .enum(["snapback", "fitted", "adjustable", "velcro", "buckle", "none"])
    .optional(),
  profile: z.enum(["low", "mid", "high"]).optional(),
  panels: z.number().optional(),
  style: z
    .enum([
      "snapback",
      "trucker",
      "dad",
      "fitted",
      "beanie",
      "bucket",
      "visor",
      "5-panel",
      "pom-pom-beanie",
    ])
    .optional(),
  structured: z.boolean().optional(),
  brimStyle: z.enum(["flat", "curved", "pre-curved"]).optional(),
  knitPattern: z
    .enum(["ribbed", "waffle", "fisherman", "cable", "plain", "jersey"])
    .optional(),
  ...baseSpecFields,
});

export const petProductSpecsSchema = z.object({
  type: z.literal("pet-products"),
  material: z.string().optional(),
  finish: z.enum(["matte", "glossy", "satin"]).optional(),
  /** @deprecated Variant-level field — will migrate to ProductVariant.data.variantSpecs */
  sizeRange: z.string().optional(),
  ...baseSpecFields,
});

export const unknownSpecsSchema = z.looseObject({
  type: z.literal("unknown"),
  ...baseSpecFields,
});

export const productSpecsSchema = z.discriminatedUnion("type", [
  apparelSpecsSchema,
  drinkwareSpecsSchema,
  wallArtSpecsSchema,
  homeDecorSpecsSchema,
  accessoriesSpecsSchema,
  stationerySpecsSchema,
  phoneCaseSpecsSchema,
  bagSpecsSchema,
  headwearSpecsSchema,
  petProductSpecsSchema,
  unknownSpecsSchema,
]);

// =============================================================================
// PRODUCT DATA (Complete Structure)
// =============================================================================

export const productDataSchema = z.object({
  raw: rawDataSchema,
  specs: productSpecsSchema,
  specSources: specSourcesSchema,
});

// =============================================================================
// INFERRED TYPES (from Zod schemas)
// =============================================================================

export type SpecSourceType = z.infer<typeof specSourceTypeSchema>;
export type SpecSource = z.infer<typeof specSourceSchema>;
export type SpecSources = z.infer<typeof specSourcesSchema>;
export type ComponentRole = z.infer<typeof componentRoleSchema>;
export type ComponentFactField = z.infer<typeof componentFactFieldSchema>;
export type ComponentScopeSource = z.infer<typeof componentScopeSourceSchema>;
export type ComponentSpecFact = z.infer<typeof componentSpecFactSchema>;
export type RawData = z.infer<typeof rawDataSchema>;

export type WallArtSpecs = z.infer<typeof wallArtSpecsSchema>;
export type PhoneCaseSpecs = z.infer<typeof phoneCaseSpecsSchema>;
export type ProductSpecs = z.infer<typeof productSpecsSchema>;

/** The spec field that states a product's weight, for rows whose specs are JSON. */
export const productWeightSpecSchema = z
  .object({ weight: z.string().optional() })
  .loose();

export const PRODUCT_SPEC_FIELDS_BY_TYPE: Readonly<
  Record<Exclude<ProductSpecs["type"], "unknown">, readonly string[]>
> = {
  apparel: Object.keys(apparelSpecsSchema.shape),
  drinkware: Object.keys(drinkwareSpecsSchema.shape),
  "wall-art": Object.keys(wallArtSpecsSchema.shape),
  "home-decor": Object.keys(homeDecorSpecsSchema.shape),
  accessories: Object.keys(accessoriesSpecsSchema.shape),
  stationery: Object.keys(stationerySpecsSchema.shape),
  "phone-cases": Object.keys(phoneCaseSpecsSchema.shape),
  bags: Object.keys(bagSpecsSchema.shape),
  headwear: Object.keys(headwearSpecsSchema.shape),
  "pet-products": Object.keys(petProductSpecsSchema.shape),
};

export type ProductData = z.infer<typeof productDataSchema>;

/**
 * SpecDraft - intermediate type for parser results before finalization.
 * All fields are optional strings/primitives. Parsers extract raw values;
 * finalization validates and adds the 'type' discriminant.
 */
export type SpecDraft = {
  brand?: string;
  audienceAgeGroup?: string;
  audienceGenderFit?: string;
  fabric?: string;
  weight?: string;
  fit?: string;
  neckline?: string;
  sleeve?: string;
  construction?: string;
  constructionRaw?: string;
  yarnType?: string;
  fabricBlendCategory?: string;
  labelType?: string;
  material?: string;
  capacity?: string;
  insulated?: boolean;
  lidIncluded?: boolean;
  shape?: string;
  doubleWall?: boolean;
  dishwasherSafe?: boolean;
  microwaveSafe?: boolean;
  finish?: string;
  frameIncluded?: boolean;
  hangingHardware?: boolean;
  frameMaterial?: string;
  edgeTreatment?: string;
  mountType?: string;
  wrapDepthMm?: number;
  thicknessMm?: number;
  printMethod?: string;
  paperClass?: string;
  inkType?: string;
  archivalGrade?: string;
  printSides?: string;
  fillIncluded?: boolean;
  dimensions?: string;
  baseMetal?: string;
  plating?: string;
  paperWeightGsm?: number;
  substrateWeightGsm?: number;
  paperType?: string;
  paperTexture?: string;
  paperBaseTone?: string;
  pages?: number;
  pageRange?: { min: number; max: number; step: number };
  stickerCut?: string;
  weatherproof?: boolean;
  bindingType?: string;
  coverPaperWeightGsm?: number;
  coating?: string;
  protection?: string;
  magSafeCompatible?: boolean;
  wirelessCharging?: boolean;
  coverage?: string;
  caseType?: string;
  compartments?: number;
  closure?: string;
  profile?: string;
  panels?: number;
  style?: string;
  structured?: boolean;
  brimStyle?: string;
  sizeRange?: string;
  subtype?: string;
  printTechnology?: string;
  ecoFriendly?: string | null;
  careInstructions?: string;
  componentFacts?: ComponentSpecFact[];
  [key: string]:
    | string
    | number
    | boolean
    | { min: number; max: number; step: number }
    | ComponentSpecFact[]
    | null
    | undefined;
};

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

export const parseProductDataSafely = (data: unknown) => {
  return productDataSchema.safeParse(data);
};

// =============================================================================
// CONSTRUCTION NORMALIZATION (preserve distinct sleeve and shoulder patterns)
// =============================================================================

export const CONSTRUCTION_GROUP_MAP = {
  "side-seamed": "side-seamed",
  "no-back-seam": "side-seamed",
  tubular: "tubular",
  "set-in": "set-in-sleeve",
  "set-in-sleeve": "set-in-sleeve",
  "drop-shoulder": "drop-shoulder",
  "rolled-forward-shoulder": "rolled-forward-shoulder",
  raglan: "raglan",
  "lap-shoulder": "lap-shoulder",
  "double-stitched": "reinforced",
  reinforced: "reinforced",
  "taped-shoulders": "reinforced",
  overlock: "reinforced",
  coverstitch: "reinforced",
  "flat-seam": "reinforced",
  "bias-bound": "reinforced",
  ribbed: "knit-specific",
  "flat-knit": "knit-specific",
  "french-terry": "knit-specific",
  "double-layered": "knit-specific",
  "side-slit": "knit-specific",
  "knit-specific": "knit-specific",
} as const satisfies Readonly<Record<string, string>>;

const lookupConstructionGroup =
  createClosedStringLookup<string>(CONSTRUCTION_GROUP_MAP);

// =============================================================================
// SPEC FINALIZATION (SpecDraft → ProductSpecs)
// =============================================================================

const specSchemaByType = {
  apparel: apparelSpecsSchema,
  drinkware: drinkwareSpecsSchema,
  "wall-art": wallArtSpecsSchema,
  "home-decor": homeDecorSpecsSchema,
  accessories: accessoriesSpecsSchema,
  stationery: stationerySpecsSchema,
  "phone-cases": phoneCaseSpecsSchema,
  bags: bagSpecsSchema,
  headwear: headwearSpecsSchema,
  "pet-products": petProductSpecsSchema,
  unknown: unknownSpecsSchema,
} satisfies Record<ProductSpecs["type"], z.ZodSchema>;

type FinalizeSpecsResult =
  | { success: true; data: ProductSpecs }
  | { success: false; error: z.ZodError };

const applyConstructionGrouping = (
  draft: SpecDraft,
  type: ProductSpecs["type"]
) => {
  if (type !== "apparel" || !draft.construction) return draft;
  const raw = draft.construction;
  const grouped = lookupConstructionGroup(raw);
  if (!grouped) return draft;
  return { ...draft, constructionRaw: raw, construction: grouped };
};

export const finalizeSpecs = (
  draft: SpecDraft,
  type: ProductSpecs["type"]
): ProductSpecs => {
  const result = safeFinalizeSpecs(draft, type);
  if (!result.success) throw result.error;
  return result.data;
};

export const safeFinalizeSpecs = (
  draft: SpecDraft,
  type: ProductSpecs["type"]
): FinalizeSpecsResult => {
  const schema = specSchemaByType[type];
  const mapped = applyConstructionGrouping(draft, type);
  const withType = { ...mapped, type };
  const result = schema.safeParse(withType);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
};

// =============================================================================
// SPEC TYPE HELPERS
// =============================================================================

export const categoryToSpecType = {
  "t-shirts": "apparel",
  "tank-tops": "apparel",
  hoodies: "apparel",
  sweatshirts: "apparel",
  "long-sleeve-shirts": "apparel",
  "polo-shirts": "apparel",
  leggings: "apparel",
  shorts: "apparel",
  joggers: "apparel",
  dresses: "apparel",
  "kids-clothing": "apparel",
  "baby-clothing": "apparel",
  swimwear: "apparel",
  activewear: "apparel",
  "sports-bras": "apparel",
  underwear: "apparel",
  socks: "apparel",
  "crop-tops": "apparel",
  "eco-friendly": "apparel",
  jackets: "apparel",
  sweaters: "apparel",
  "quarter-zips": "apparel",
  sweatpants: "apparel",
  vests: "apparel",
  jerseys: "apparel",
  "button-up-shirts": "apparel",
  bodysuits: "apparel",
  sleepwear: "apparel",
  skirts: "apparel",
  pants: "apparel",
  bottoms: "apparel",
  mugs: "drinkware",
  tumblers: "drinkware",
  bottles: "drinkware",
  "wine-tumblers": "drinkware",
  glassware: "drinkware",
  "water-bottles": "drinkware",
  "shaker-bottles": "drinkware",
  "canvas-prints": "wall-art",
  posters: "wall-art",
  "metal-prints": "wall-art",
  "acrylic-prints": "wall-art",
  "framed-prints": "wall-art",
  "wood-prints": "wall-art",
  "photo-tiles": "wall-art",
  "photo-prints": "wall-art",
  "wall-tapestries": "home-decor",
  pillows: "home-decor",
  blankets: "home-decor",
  towels: "home-decor",
  rugs: "home-decor",
  curtains: "home-decor",
  candles: "home-decor",
  aprons: "apparel",
  bedding: "home-decor",
  fabric: "home-decor",
  tableware: "home-decor",
  "home-decor": "home-decor",
  "kitchen-accessories": "home-decor",
  "phone-cases": "phone-cases",
  "earphone-cases": "accessories",
  "tablet-cases": "accessories",
  "laptop-cases": "accessories",
  "e-reader-cases": "accessories",
  stickers: "stationery",
  notebooks: "stationery",
  cards: "stationery",
  calendars: "stationery",
  postcards: "stationery",
  "photo-books": "stationery",
  books: "stationery",
  "wrapping-paper": "stationery",
  "office-supplies": "stationery",
  flyers: "stationery",
  "tote-bags": "bags",
  backpacks: "bags",
  "fanny-packs": "bags",
  "crossbody-sling-bags": "bags",
  "drawstring-bags": "bags",
  "laptop-sleeves": "bags",
  coolers: "bags",
  "lunch-bags": "bags",
  "duffel-bags": "bags",
  hats: "headwear",
  beanies: "headwear",
  "bucket-hats": "headwear",
  visors: "headwear",
  snapbacks: "headwear",
  "trucker-hats": "headwear",
  "dad-hats": "headwear",
  "baseball-caps": "headwear",
  "golf-caps": "headwear",
  jewelry: "accessories",
  "jewelry-storage": "accessories",
  "watch-bands": "accessories",
  luggage: "accessories",
  pins: "accessories",
  keychains: "accessories",
  patches: "accessories",
  magnets: "accessories",
  flags: "home-decor",
  banners: "home-decor",
  signage: "home-decor",
  "window-clings": "accessories",
  "sports-accessories": "accessories",
  "hair-accessories": "accessories",
  "hair-care": "unknown",
  puzzles: "accessories",
  "mouse-pads": "accessories",
  "yoga-mats": "accessories",
  slippers: "accessories",
  "pet-products": "pet-products",
  "dog-bandanas": "pet-products",
  "pet-bowls": "pet-products",
  "pet-apparel": "pet-products",
} as const satisfies Record<string, ProductSpecs["type"]>;

const lookupCategorySpecType =
  createClosedStringLookup<ProductSpecs["type"]>(categoryToSpecType);

export const getSpecTypeForCategory = (
  categorySlug: string
): ProductSpecs["type"] => {
  return lookupCategorySpecType(categorySlug) ?? "unknown";
};

