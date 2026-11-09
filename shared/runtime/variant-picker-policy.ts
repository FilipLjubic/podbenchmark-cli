import { resolveSelectedConfigurationFamily, type SelectedConfigurationClass } from "./selected-configuration-family";
export const VARIANT_PICKER_DIMENSIONS = [
  "trimConfiguration",
  "envelopeColor",
  "animalType",
  "hardwareFinish",
  "bundleOption",
  "storageBagColor",
  "shipmentPresentation",
  "shadeRingIncluded",
  "leashIncluded",
  "strawKit",
  "ribbonIncluded",
  "ribbonOption",
  "tasselColor",
  "borderColor",
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
  "frameProfile",
  "matIncluded",
  "hangingPinsIncluded",
  "frameAssemblyIncluded",
  "canvasStretchAllowance",
  "canvasBorderStyle",
  "backboardIncluded",
  "electricalConfiguration",
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
  "framed-prints",
  "photo-tiles",
  "wall-art",
  "wood-prints",
] as const;

// Metal and acrylic prints are bought as a finished panel, so how the image is
// printed (sublimation or UV, giclée) is not something their sellers choose.
export const PANEL_PRINT_PICKER_CATEGORIES = [
  "acrylic-prints",
  "metal-prints",
] as const;

export const WALL_ART_PICKER_CATEGORIES = [
  ...CANVAS_PRINT_PICKER_CATEGORIES,
  ...POSTER_PICKER_CATEGORIES,
  ...PANEL_PRINT_PICKER_CATEGORIES,
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

// Wall art leaves three one-supplier choices to the supplier, each priced on its
// standard version (matching: selected-source-variant-matching/policies.ts):
// - Quantity: only Artelo sells prints as sets of 2 to 15 and gallery walls, each
//   a separate purchase from the single print every supplier sells. A pack is
//   never the standard version, and picking one left every other supplier
//   unconfirmed.
// - Frame style: only Artelo sells Oak and Premium oak (Metal and Premium metal)
//   as two products. Its base grade is the standard; no other supplier states a
//   grade, so picking one left them unconfirmed.
// - Frame assembly: only Artelo sells the same frame assembled or as a kit, and
//   the kit is not the framed print sellers compare, so assembled is the standard.
// - Hanging pins: only Artelo states them, always as not included, so the fact
//   never varied and only left suppliers that do not state it unconfirmed.
// - Hanging hardware: acrylic, metal and foam-board prints each have it or lack
//   it as a fixed product fact; no supplier sells both, so it only split
//   suppliers by a detail sellers do not choose.
// Kept on purpose after the audit: Color (the frame or presentation color; seven
// of eight products keep it, foam board's Gelato-only black or white included)
// and Paper, offered as its grade (poster, enhanced matte and photo, fine art;
// picker-value-families.ts) rather than each supplier's stock name. Print type
// went on 2026-11-08: giclée against "standard digital" is not a process
// difference (suppliers call their pigment inkjet giclée), each value was sold
// by one supplier only, and paper grade carries the quality tier
// (docs/architecture/picker-option-decisions.md).
export const WALL_ART_VARIANT_PICKER_DIMENSIONS = [
  "size",
  "matIncluded",
  "finish",
  "mountType",
  "standIncluded",
  "edgeTreatment",
  "paperType",
  "materialOption",
  "color",
] as const satisfies readonly VariantPickerDimension[];

// Panel prints also leave print type to the supplier: sublimation against UV on
// metal and giclée against UV on acrylic are production processes that each
// supplier fixes, and no supplier sells both, so choosing one only unconfirmed
// the suppliers on the other process.
export const PANEL_PRINT_VARIANT_PICKER_DIMENSIONS = [
  "size",
  "matIncluded",
  "finish",
  "mountType",
  "standIncluded",
  "edgeTreatment",
  "paperType",
  "materialOption",
  "color",
] as const satisfies readonly VariantPickerDimension[];

// Edge, canvas stock and hanging hardware stay product facts. Only Prodigi and
// CustomCat sell edges or stock as variants, edges never change a price, and
// no supplier sells a canvas with and without hardware, so none is a choice.
// Finish is not a choice either (2026-11-08): only Printify sells it as one
// (Matte, Glossy or Satin); CustomCat has one Matte canvas, Prodigi states
// "None" (unvarnished) and Printful, Gelato and Fourthwall state none, so every
// finish pick compared one or two suppliers. The 2026-11-07 attempt was
// reverted because the hidden option's reference profile (CustomCat's "No
// Blank Color Option") then bound every supplier; canvas matching now ignores
// conditional fields the picked option does not carry
// (scopeSelectedSourcePolicyToOption), so each supplier is priced on its own.
export const CANVAS_PRINT_VARIANT_PICKER_DIMENSIONS = [
  "frameProfile",
  "color",
  "backboardIncluded",
  "size",
  "quantity",
  "canvasStretchAllowance",
  "canvasBorderStyle",
  "mountType",
  "standIncluded",
  "materialOption",
] as const satisfies readonly VariantPickerDimension[];

// Only Printify sells poster paper as a variant, and its Glossy and Matte repeat
// the finish every supplier lists. Foil prints keep paper: it names the foil.
// Quantity and hanging hardware stay out for the reasons given at
// WALL_ART_VARIANT_PICKER_DIMENSIONS: only Artelo sells sets, so every supplier
// is priced on a single poster, and no supplier sells the same poster with and
// without its hanger.
export const POSTER_VARIANT_PICKER_DIMENSIONS = [
  "size",
  "finish",
  "mountType",
  "standIncluded",
  "edgeTreatment",
  "materialOption",
  "color",
] as const satisfies readonly VariantPickerDimension[];

export const T_SHIRT_VARIANT_PICKER_DIMENSIONS = [
  "size",
  "color",
] as const satisfies readonly VariantPickerDimension[];

// Mug style stays a product fact: only Prodigi sells full-wrap or accent styles
// as variants, so choosing one left every other supplier unconfirmed.
// Quantity is not a drinkware choice either. A bulk bundle (36 mugs for one
// price) is a different purchase from one mug, so it is never a version of the
// product a seller compares; only Inkthreadable lists bundles, and picking one
// left five suppliers unconfirmed. Matching holds every supplier to a single mug.
// Shape (Mug, Cup, Tumbler) is a name only Printify varies on one mug; sellers
// choose capacity and color, not the word for the vessel.
export const DRINKWARE_VARIANT_PICKER_DIMENSIONS = [
  "strawKit",
  "capacity",
  "color",
  "finish",
  "lidIncluded",
  "materialOption",
] as const satisfies readonly VariantPickerDimension[];

// Printed sides is out: only Printify's postcards sell one side or both as a
// variant, and no other supplier states it, so choosing a side left them
// unconfirmed. Each supplier is priced on its standard postcard.
// Paper is out too (2026-11-07 audit), for the reason business cards drop it:
// Printify names six coatings that repeat Finish (Glossy, Matte, Uncoated, Coated
// One Side) and Prodigi names two art stocks (Fine Art Card, Mohawk Superfine),
// so no value is sold by both and sellers do not pick stock grades.
export const MULTIPACK_VARIANT_PICKER_DIMENSIONS = [
  "size",
  "quantity",
  "finish",
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

// Business cards keep the print run (quantity), size and printed sides. Paper
// stock and finish are out: only Printify names them as variants (five stocks,
// Glossy and Matte) while Printful and Prodigi state neither, so choosing one
// left both unconfirmed. Each supplier is priced on its standard card.
const PRINT_RUN_VARIANT_PICKER_DIMENSIONS = [
  "size",
  "quantity",
  "printSides",
  "shape",
] as const satisfies readonly VariantPickerDimension[];

// Only Printify sells sticker stock as a variant; its Glossy and Satin repeat
// the finish every supplier lists. Finish stays (2026-11-07 audit): Prodigi and
// Printify sell Glossy and Matte as a real choice, which sellers advertise; the
// kiss-cut split between Glossy, Satin and Matte is a naming question.
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

// Cover finish is out (2026-11-07 audit): only Printify sells it as a choice
// (Glossy or Semi Glossy; Printful's one value is Glossy, Fourthwall's one is
// Satin), and sellers rarely pick between two near-identical coatings.
const NOTEBOOK_VARIANT_PICKER_DIMENSIONS = [
  "size",
  "pageCount",
  "pageStyle",
  "paperType",
  "color",
] as const satisfies readonly VariantPickerDimension[];

// Finish stays (2026-11-07 audit): slim and tough cases sell Glossy and Matte as a
// choice at two to three suppliers each, and sellers advertise it. Clear and
// flexi cases show one finish per supplier (Satin at one, Matte at another); that
// is a naming gap between suppliers rather than a control to remove.
const PHONE_CASE_VARIANT_PICKER_DIMENSIONS = [
  "deviceFit",
  "finish",
  "color",
  "materialOption",
] as const satisfies readonly VariantPickerDimension[];

// Print type is out: Cut Sew (Printful) against Sublimation (Printify, CustomCat)
// is how each supplier makes a pillow, and none sells both, so choosing one
// left the others unconfirmed over a production detail.
// Printed sides stays: one side or both changes what the customer receives, even
// where each supplier sells only one (the custom-shaped pillow, and the woven
// blanket where Prodigi prints both sides and Printify one; 2026-11-07 audit).
const DIMENSIONAL_HOME_VARIANT_PICKER_DIMENSIONS = [
  "tasselColor",
  "borderColor",
  "size",
  "color",
  "fillIncluded",
  "finish",
  "closure",
  "materialOption",
  "liningOption",
  "quantity",
  "printSides",
] as const satisfies readonly VariantPickerDimension[];

// Shape stays a product fact: only Prodigi sells a home product in two shapes,
// and its shapes already come in different sizes.
// Quantity, frame style and frame assembly are Artelo's alone (see
// WALL_ART_VARIANT_PICKER_DIMENSIONS). Print type is a production detail that
// nobody sells both ways: the night light's Laser Engrave or UV and the acrylic
// photo block's Giclée or Sublimation are fixed by the supplier.
const FLEXIBLE_HOME_VARIANT_PICKER_DIMENSIONS = [
  "electricalConfiguration",
  "size",
  "matIncluded",
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
] as const satisfies readonly VariantPickerDimension[];

// Finish is out (2026-11-07 audit): the one ornament with two finishes is the metal
// ornament, where Printful's glossy and Prodigi's matte each come with their own
// printed sides, so the two controls asked one question. Printed sides stays: one
// side or both changes what the customer receives (ceramic ornaments sell either
// at Printful and Printify).
const ORNAMENT_VARIANT_PICKER_DIMENSIONS = [
  "hardwareFinish",
  "shape",
  "size",
  "quantity",
  "color",
  "designStyle",
  "thicknessType",
  "materialOption",
  "printSides",
] as const satisfies readonly VariantPickerDimension[];

// Print type is out: only Printify sells yard signs printed digitally or by
// sublimation, so choosing one left Prodigi unconfirmed over a production detail.
const DISPLAY_VARIANT_PICKER_DIMENSIONS = [
  "ribbonIncluded",
  "size",
  "standIncluded",
  "finish",
  "closure",
  "printSides",
  "quantity",
  "color",
  "materialOption",
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
  trimConfiguration: { label: "Trim", control: "select" },
  envelopeColor: { label: "Envelope color", control: "select" },
  animalType: { label: "Animal", control: "select" },
  hardwareFinish: { label: "Hardware finish", control: "select" },
  bundleOption: { label: "Bundle", control: "select" },
  storageBagColor: { label: "Storage bag color", control: "select" },
  shipmentPresentation: { label: "Shipping format", control: "select" },
  shadeRingIncluded: { label: "Shade ring", control: "toggle" },
  leashIncluded: { label: "Leash", control: "toggle" },
  strawKit: { label: "Straw kit", control: "select" },
  ribbonIncluded: { label: "Ribbon", control: "toggle" },
  ribbonOption: { label: "Ribbon", control: "select" },
  tasselColor: { label: "Tassel color", control: "select" },
  borderColor: { label: "Border color", control: "select" },
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
  frameProfile: { label: "Frame style", control: "select" },
  matIncluded: { label: "Mat", control: "toggle" },
  hangingPinsIncluded: { label: "Hanging pins", control: "toggle" },
  frameAssemblyIncluded: { label: "Frame assembly", control: "toggle" },
  canvasStretchAllowance: { label: "Canvas allowance", control: "select" },
  canvasBorderStyle: { label: "Canvas border", control: "select" },
  backboardIncluded: { label: "Backboard", control: "toggle" },
  electricalConfiguration: { label: "Plug and voltage", control: "select" },
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
  decorForm: { label: "Form", control: "select" },
  lampStyle: { label: "Light style", control: "select" },
  designStyle: { label: "Design", control: "select" },
  thicknessType: { label: "Thickness", control: "select" },
  canvasThicknessType: { label: "Canvas thickness", control: "none" },
  substrateWeightGsm: { label: "Substrate weight", control: "none" },
  thicknessMm: { label: "Thickness", control: "select" },
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

export const PANEL_PRINT_VARIANT_PICKER_POLICY = {
  id: "panel-prints",
  label: "Metal and acrylic prints",
  specType: "wall-art",
  categorySlugs: PANEL_PRINT_PICKER_CATEGORIES,
  dimensions: PANEL_PRINT_VARIANT_PICKER_DIMENSIONS,
} as const satisfies VariantPickerCategoryPolicy;

export const T_SHIRT_VARIANT_PICKER_POLICY = {
  id: "t-shirts",
  label: "T-Shirts",
  specType: "apparel",
  categorySlugs: T_SHIRT_PICKER_CATEGORIES,
  dimensions: T_SHIRT_VARIANT_PICKER_DIMENSIONS,
} as const satisfies VariantPickerCategoryPolicy;

// Size stays on every cap: it is the hat's fit, even though most caps state one size.
// The Richardson 112 lists "Adult XL" beside "One Size" only at Gelato; that is
// one supplier's range, not a reason to drop the control (2026-11-07 audit).
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
  dimensions: PRINT_RUN_VARIANT_PICKER_DIMENSIONS,
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
  PANEL_PRINT_VARIANT_PICKER_POLICY,
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
  categorySlug: string,
  canonicalSpecs?: SelectedConfigurationClass | null
): VariantPickerCategoryPolicy | null {
  return (
    resolveSelectedConfigurationFamily(categorySlug, canonicalSpecs)?.picker ??
    VARIANT_PICKER_POLICY_BY_CATEGORY.get(categorySlug) ?? null
  );
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
