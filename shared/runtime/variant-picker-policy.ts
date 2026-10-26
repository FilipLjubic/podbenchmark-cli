export const VARIANT_PICKER_DIMENSIONS = [
  "size",
  "capacity",
  "quantity",
  "pageCount",
  "pageStyle",
  "deviceFit",
  "scent",
  "embroideryFoam",
  "shape",
  "color",
  "finish",
  "frameIncluded",
  "frameMaterial",
  "material",
  "hangingHardware",
  "mountType",
  "standIncluded",
  "fillIncluded",
  "lidIncluded",
  "edgeTreatment",
  "paperType",
  "materialOption",
  "mugStyle",
  "closure",
  "construction",
  "fit",
  "liningOption",
  "decorForm",
  "lampStyle",
  "designStyle",
  "thicknessType",
  "canvasThicknessType",
  "substrateWeightGsm",
  "thicknessMm",
  "wrapDepthMm",
  "printSides",
  "printMethod",
  "printTechnology",
  "printType",
  "printPosition",
] as const;

export type VariantPickerDimension = (typeof VARIANT_PICKER_DIMENSIONS)[number];

const VARIANT_PICKER_DIMENSION_SET = new Set<string>(VARIANT_PICKER_DIMENSIONS);

export const CANVAS_PRINT_PICKER_CATEGORIES = ["canvas-prints"] as const;

export const POSTER_PICKER_CATEGORIES = ["posters"] as const;

export const OTHER_WALL_ART_PICKER_CATEGORIES = [
  "acrylic-prints",
  "framed-prints",
  "metal-prints",
  "photo-tiles",
  "wall-art",
  "wood-prints",
] as const;

export const WALL_ART_PICKER_CATEGORIES = [
  ...CANVAS_PRINT_PICKER_CATEGORIES,
  ...POSTER_PICKER_CATEGORIES,
  ...OTHER_WALL_ART_PICKER_CATEGORIES,
] as const;

export const T_SHIRT_PICKER_CATEGORIES = [
  "long-sleeve-shirts",
  "t-shirts",
] as const;

export const BRANDED_APPAREL_PICKER_CATEGORIES = [
  "baseball-caps",
  "beanies",
  "bodysuits",
  "bucket-hats",
  "crop-tops",
  "dad-hats",
  "hoodies",
  "jackets",
  "polo-shirts",
  "quarter-zips",
  "snapbacks",
  "sweatshirts",
  "trucker-hats",
] as const;

// Only these reviewed cap cohorts admit a conditional selected foam control.
export const HEADWEAR_MATCHING_CATEGORIES = [
  "baseball-caps",
  "snapbacks",
  "trucker-hats",
] as const;

const STRUCTURED_APPAREL_PICKER_CATEGORY_SET = new Set<string>([
  ...T_SHIRT_PICKER_CATEGORIES,
  ...BRANDED_APPAREL_PICKER_CATEGORIES,
]);

export function isStructuredApparelPickerCategory(
  categorySlug: string | null | undefined
): boolean {
  return Boolean(
    categorySlug && STRUCTURED_APPAREL_PICKER_CATEGORY_SET.has(categorySlug)
  );
}

export const WALL_ART_VARIANT_PICKER_DIMENSIONS = [
  "size",
  "finish",
  "hangingHardware",
  "mountType",
  "standIncluded",
  "edgeTreatment",
  "paperType",
  "materialOption",
  "color",
  "printType",
] as const satisfies readonly VariantPickerDimension[];

// Edge, canvas stock and hanging hardware stay product facts. Only Prodigi and
// CustomCat sell edges or stock as variants, edges never change a price, and
// no supplier sells a canvas with and without hardware, so none is a choice.
export const CANVAS_PRINT_VARIANT_PICKER_DIMENSIONS = [
  "size",
  "mountType",
  "standIncluded",
  "materialOption",
] as const satisfies readonly VariantPickerDimension[];

// Only Printify sells poster paper as a variant, and its Glossy and Matte repeat
// the finish every supplier lists. Foil prints keep paper: it names the foil.
export const POSTER_VARIANT_PICKER_DIMENSIONS = [
  "size",
  "finish",
  "hangingHardware",
  "mountType",
  "standIncluded",
  "edgeTreatment",
  "materialOption",
  "color",
  "printType",
] as const satisfies readonly VariantPickerDimension[];

export const T_SHIRT_VARIANT_PICKER_DIMENSIONS = [
  "size",
  "color",
] as const satisfies readonly VariantPickerDimension[];

// Mug style stays a product fact: only Prodigi sells full-wrap or accent styles
// as variants, so choosing one left every other supplier unconfirmed.
export const DRINKWARE_VARIANT_PICKER_DIMENSIONS = [
  "capacity",
  "color",
  "finish",
  "lidIncluded",
  "materialOption",
  "shape",
] as const satisfies readonly VariantPickerDimension[];

export const MULTIPACK_VARIANT_PICKER_DIMENSIONS = [
  "size",
  "quantity",
  "finish",
  "paperType",
  "printSides",
  "shape",
] as const satisfies readonly VariantPickerDimension[];

const PAPER_SIZE_VARIANT_PICKER_DIMENSIONS = [
  "size",
  "quantity",
  "finish",
  "paperType",
  "printSides",
  "shape",
] as const satisfies readonly VariantPickerDimension[];

// Only Printify sells sticker stock as a variant; its Glossy and Satin repeat
// the finish every supplier lists.
const STICKER_VARIANT_PICKER_DIMENSIONS = [
  "size",
  "quantity",
  "finish",
  "printSides",
  "shape",
] as const satisfies readonly VariantPickerDimension[];

// Printify's one-value Satin paper and finish split it from Prodigi's
// same-size rolls without offering a choice.
const WRAPPING_PAPER_VARIANT_PICKER_DIMENSIONS = [
  "size",
  "quantity",
  "printSides",
] as const satisfies readonly VariantPickerDimension[];

const NOTEBOOK_VARIANT_PICKER_DIMENSIONS = [
  "size",
  "pageCount",
  "pageStyle",
  "finish",
  "paperType",
  "color",
] as const satisfies readonly VariantPickerDimension[];

const PHONE_CASE_VARIANT_PICKER_DIMENSIONS = [
  "deviceFit",
  "finish",
  "color",
  "materialOption",
] as const satisfies readonly VariantPickerDimension[];

const DIMENSIONAL_HOME_VARIANT_PICKER_DIMENSIONS = [
  "size",
  "color",
  "fillIncluded",
  "finish",
  "closure",
  "materialOption",
  "liningOption",
  "quantity",
  "printSides",
  "printType",
] as const satisfies readonly VariantPickerDimension[];

// Shape stays a product fact: only Prodigi sells a home product in two shapes,
// and its shapes already come in different sizes.
const FLEXIBLE_HOME_VARIANT_PICKER_DIMENSIONS = [
  "size",
  "quantity",
  "color",
  "finish",
  "fillIncluded",
  "closure",
  "materialOption",
  "lampStyle",
  "designStyle",
  "liningOption",
  "standIncluded",
  "printSides",
  "printType",
] as const satisfies readonly VariantPickerDimension[];

const ORNAMENT_VARIANT_PICKER_DIMENSIONS = [
  "shape",
  "size",
  "quantity",
  "color",
  "designStyle",
  "thicknessType",
  "finish",
  "materialOption",
  "printSides",
] as const satisfies readonly VariantPickerDimension[];

const DISPLAY_VARIANT_PICKER_DIMENSIONS = [
  "size",
  "standIncluded",
  "finish",
  "closure",
  "printSides",
  "quantity",
  "color",
  "materialOption",
  "printType",
] as const satisfies readonly VariantPickerDimension[];

const CANDLE_VARIANT_PICKER_DIMENSIONS = [
  "scent",
  "size",
  "color",
  "finish",
] as const satisfies readonly VariantPickerDimension[];

const FACE_MASK_VARIANT_PICKER_DIMENSIONS = [
  "size",
  "color",
  "fit",
  "construction",
] as const satisfies readonly VariantPickerDimension[];

export type VariantPickerControl =
  | "select"
  | "segmented"
  | "toggle"
  | "swatch"
  | "none";

export type VariantPickerFieldUi = {
  label: string;
  control: VariantPickerControl;
};

export const VARIANT_PICKER_FIELD_UI: Record<
  VariantPickerDimension,
  VariantPickerFieldUi
> = {
  size: { label: "Size", control: "select" },
  capacity: { label: "Capacity", control: "select" },
  quantity: { label: "Quantity", control: "select" },
  pageCount: { label: "Page count", control: "select" },
  pageStyle: { label: "Page style", control: "select" },
  deviceFit: { label: "Device fit", control: "select" },
  scent: { label: "Scent", control: "select" },
  embroideryFoam: { label: "3D foam embroidery", control: "select" },
  shape: { label: "Shape", control: "select" },
  color: { label: "Color", control: "swatch" },
  finish: { label: "Finish", control: "segmented" },
  frameIncluded: { label: "Frame", control: "none" },
  frameMaterial: { label: "Frame material", control: "none" },
  material: { label: "Material", control: "none" },
  hangingHardware: { label: "Hanging hardware", control: "select" },
  mountType: { label: "Mount", control: "select" },
  standIncluded: { label: "Stand", control: "toggle" },
  fillIncluded: { label: "Fill", control: "toggle" },
  lidIncluded: { label: "Lid", control: "toggle" },
  edgeTreatment: { label: "Edge", control: "select" },
  paperType: { label: "Paper", control: "select" },
  materialOption: { label: "Material option", control: "select" },
  mugStyle: { label: "Style", control: "select" },
  closure: { label: "Closure", control: "select" },
  construction: { label: "Construction", control: "select" },
  fit: { label: "Fit", control: "select" },
  liningOption: { label: "Lining", control: "select" },
  decorForm: { label: "Form", control: "none" },
  lampStyle: { label: "Light style", control: "select" },
  designStyle: { label: "Design", control: "select" },
  thicknessType: { label: "Thickness", control: "select" },
  canvasThicknessType: { label: "Canvas thickness", control: "none" },
  substrateWeightGsm: { label: "Substrate weight", control: "none" },
  thicknessMm: { label: "Thickness", control: "none" },
  wrapDepthMm: { label: "Wrap depth", control: "none" },
  printSides: { label: "Printed sides", control: "select" },
  printMethod: { label: "Print method", control: "none" },
  printTechnology: { label: "Print technology", control: "none" },
  printType: { label: "Print type", control: "select" },
  printPosition: { label: "Print position", control: "none" },
};

export type VariantPickerCategoryPolicy = {
  id: string;
  label: string;
  specType: string;
  categorySlugs: readonly string[];
  dimensions: readonly VariantPickerDimension[];
};

export const CANVAS_PRINT_VARIANT_PICKER_POLICY = {
  id: "canvas-prints",
  label: "Canvas prints",
  specType: "wall-art",
  categorySlugs: CANVAS_PRINT_PICKER_CATEGORIES,
  dimensions: CANVAS_PRINT_VARIANT_PICKER_DIMENSIONS,
} as const satisfies VariantPickerCategoryPolicy;

export const POSTER_VARIANT_PICKER_POLICY = {
  id: "posters",
  label: "Posters",
  specType: "wall-art",
  categorySlugs: POSTER_PICKER_CATEGORIES,
  dimensions: POSTER_VARIANT_PICKER_DIMENSIONS,
} as const satisfies VariantPickerCategoryPolicy;

export const WALL_ART_VARIANT_PICKER_POLICY = {
  id: "wall-art",
  label: "Wall Art",
  specType: "wall-art",
  categorySlugs: OTHER_WALL_ART_PICKER_CATEGORIES,
  dimensions: WALL_ART_VARIANT_PICKER_DIMENSIONS,
} as const satisfies VariantPickerCategoryPolicy;

export const T_SHIRT_VARIANT_PICKER_POLICY = {
  id: "t-shirts",
  label: "T-Shirts",
  specType: "apparel",
  categorySlugs: T_SHIRT_PICKER_CATEGORIES,
  dimensions: T_SHIRT_VARIANT_PICKER_DIMENSIONS,
} as const satisfies VariantPickerCategoryPolicy;

export const HEADWEAR_VARIANT_PICKER_POLICY = {
  id: "headwear",
  label: "Headwear",
  specType: "apparel",
  categorySlugs: HEADWEAR_MATCHING_CATEGORIES,
  dimensions: ["size", "color", "embroideryFoam"],
} as const satisfies VariantPickerCategoryPolicy;

export const BRANDED_APPAREL_VARIANT_PICKER_POLICY = {
  id: "branded-apparel",
  label: "Branded apparel",
  specType: "apparel",
  categorySlugs: BRANDED_APPAREL_PICKER_CATEGORIES.filter(
    category =>
      !HEADWEAR_MATCHING_CATEGORIES.some(headwear => headwear === category)
  ),
  dimensions: T_SHIRT_VARIANT_PICKER_DIMENSIONS,
} as const satisfies VariantPickerCategoryPolicy;

export const DRINKWARE_VARIANT_PICKER_POLICY = {
  id: "drinkware",
  label: "Drinkware",
  specType: "drinkware",
  categorySlugs: [
    "drinkware",
    "glassware",
    "mugs",
    "tumblers",
    "water-bottles",
  ],
  dimensions: DRINKWARE_VARIANT_PICKER_DIMENSIONS,
} as const satisfies VariantPickerCategoryPolicy;

export const MULTIPACK_VARIANT_PICKER_POLICY = {
  id: "card-packs",
  label: "Cards",
  specType: "paper-products",
  categorySlugs: ["cards", "greeting-cards", "postcards"],
  dimensions: MULTIPACK_VARIANT_PICKER_DIMENSIONS,
} as const satisfies VariantPickerCategoryPolicy;

const PAPER_SIZE_VARIANT_PICKER_POLICY = {
  id: "paper-size",
  label: "Paper products",
  specType: "paper-products",
  categorySlugs: [
    "brochures",
    "calendars",
    "commercial",
    "flyers",
    "paper-products",
    "stationery",
  ],
  dimensions: PAPER_SIZE_VARIANT_PICKER_DIMENSIONS,
} as const satisfies VariantPickerCategoryPolicy;

const WRAPPING_PAPER_VARIANT_PICKER_POLICY = {
  id: "wrapping-paper",
  label: "Wrapping paper",
  specType: "paper-products",
  categorySlugs: ["wrapping-paper"],
  dimensions: WRAPPING_PAPER_VARIANT_PICKER_DIMENSIONS,
} as const satisfies VariantPickerCategoryPolicy;

const PRINT_RUN_VARIANT_PICKER_POLICY = {
  id: "print-runs",
  label: "Print runs",
  specType: "paper-products",
  categorySlugs: ["business-cards"],
  dimensions: PAPER_SIZE_VARIANT_PICKER_DIMENSIONS,
} as const satisfies VariantPickerCategoryPolicy;

const STICKER_VARIANT_PICKER_POLICY = {
  id: "stickers",
  label: "Stickers",
  specType: "paper-products",
  categorySlugs: ["stickers"],
  dimensions: STICKER_VARIANT_PICKER_DIMENSIONS,
} as const satisfies VariantPickerCategoryPolicy;

const NOTEBOOK_VARIANT_PICKER_POLICY = {
  id: "notebooks",
  label: "Notebooks",
  specType: "paper-products",
  categorySlugs: ["notebooks"],
  dimensions: NOTEBOOK_VARIANT_PICKER_DIMENSIONS,
} as const satisfies VariantPickerCategoryPolicy;

const PHONE_CASE_VARIANT_PICKER_POLICY = {
  id: "phone-cases",
  label: "Phone cases",
  specType: "device-cases",
  categorySlugs: ["phone-cases"],
  dimensions: PHONE_CASE_VARIANT_PICKER_DIMENSIONS,
} as const satisfies VariantPickerCategoryPolicy;

const DIMENSIONAL_HOME_VARIANT_PICKER_POLICY = {
  id: "dimensional-home",
  label: "Home products",
  specType: "home-decor",
  categorySlugs: ["bedding", "blankets", "pillows", "rugs", "towels"],
  dimensions: DIMENSIONAL_HOME_VARIANT_PICKER_DIMENSIONS,
} as const satisfies VariantPickerCategoryPolicy;

const FLEXIBLE_HOME_VARIANT_PICKER_POLICY = {
  id: "flexible-home",
  label: "Home products",
  specType: "home-decor",
  categorySlugs: ["home-decor", "kitchen-accessories"],
  dimensions: FLEXIBLE_HOME_VARIANT_PICKER_DIMENSIONS,
} as const satisfies VariantPickerCategoryPolicy;

const ORNAMENT_VARIANT_PICKER_POLICY = {
  id: "ornaments",
  label: "Ornaments",
  specType: "ornaments",
  categorySlugs: ["ornaments"],
  dimensions: ORNAMENT_VARIANT_PICKER_DIMENSIONS,
} as const satisfies VariantPickerCategoryPolicy;

const DISPLAY_VARIANT_PICKER_POLICY = {
  id: "displays",
  label: "Displays",
  specType: "display",
  categorySlugs: ["banners", "flags", "signage"],
  dimensions: DISPLAY_VARIANT_PICKER_DIMENSIONS,
} as const satisfies VariantPickerCategoryPolicy;

const CANDLE_VARIANT_PICKER_POLICY = {
  id: "candles",
  label: "Candles",
  specType: "home-decor",
  categorySlugs: ["candles"],
  dimensions: CANDLE_VARIANT_PICKER_DIMENSIONS,
} as const satisfies VariantPickerCategoryPolicy;

const FACE_MASK_VARIANT_PICKER_POLICY = {
  id: "face-masks",
  label: "Face masks",
  specType: "apparel",
  categorySlugs: ["face-masks"],
  dimensions: FACE_MASK_VARIANT_PICKER_DIMENSIONS,
} as const satisfies VariantPickerCategoryPolicy;

export const VARIANT_PICKER_POLICIES = [
  CANVAS_PRINT_VARIANT_PICKER_POLICY,
  POSTER_VARIANT_PICKER_POLICY,
  WALL_ART_VARIANT_PICKER_POLICY,
  T_SHIRT_VARIANT_PICKER_POLICY,
  HEADWEAR_VARIANT_PICKER_POLICY,
  BRANDED_APPAREL_VARIANT_PICKER_POLICY,
  DRINKWARE_VARIANT_PICKER_POLICY,
  MULTIPACK_VARIANT_PICKER_POLICY,
  PAPER_SIZE_VARIANT_PICKER_POLICY,
  WRAPPING_PAPER_VARIANT_PICKER_POLICY,
  PRINT_RUN_VARIANT_PICKER_POLICY,
  STICKER_VARIANT_PICKER_POLICY,
  NOTEBOOK_VARIANT_PICKER_POLICY,
  PHONE_CASE_VARIANT_PICKER_POLICY,
  DIMENSIONAL_HOME_VARIANT_PICKER_POLICY,
  FLEXIBLE_HOME_VARIANT_PICKER_POLICY,
  ORNAMENT_VARIANT_PICKER_POLICY,
  DISPLAY_VARIANT_PICKER_POLICY,
  CANDLE_VARIANT_PICKER_POLICY,
  FACE_MASK_VARIANT_PICKER_POLICY,
] as const satisfies readonly VariantPickerCategoryPolicy[];

const VARIANT_PICKER_POLICY_BY_CATEGORY = indexPoliciesByCategory(
  VARIANT_PICKER_POLICIES
);

export function getVariantPickerPolicy(
  categorySlug: string
): VariantPickerCategoryPolicy | null {
  return VARIANT_PICKER_POLICY_BY_CATEGORY.get(categorySlug) ?? null;
}

export function getVariantPickerFieldUi(
  dimension: string
): VariantPickerFieldUi {
  return isVariantPickerDimension(dimension)
    ? VARIANT_PICKER_FIELD_UI[dimension]
    : {
        label: humanizeDimension(dimension),
        control: "select",
      };
}

export function isVariantPickerDimension(
  dimension: string
): dimension is VariantPickerDimension {
  return VARIANT_PICKER_DIMENSION_SET.has(dimension);
}

function indexPoliciesByCategory(
  policies: readonly VariantPickerCategoryPolicy[]
): Map<string, VariantPickerCategoryPolicy> {
  const result = new Map<string, VariantPickerCategoryPolicy>();
  for (const policy of policies) {
    for (const categorySlug of policy.categorySlugs) {
      const existing = result.get(categorySlug);
      if (existing) {
        throw new Error(
          `Variant-picker category ${categorySlug} is covered by both ${existing.id} and ${policy.id}.`
        );
      }
      result.set(categorySlug, policy);
    }
  }
  return result;
}

function humanizeDimension(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .replace(/^./, char => char.toUpperCase());
}
