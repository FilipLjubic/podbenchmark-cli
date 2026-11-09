import { resolveSelectedConfigurationFamily, type SelectedConfigurationClass } from "./selected-configuration-family";
import {
  CANVAS_PRINT_PICKER_CATEGORIES,
  HEADWEAR_MATCHING_CATEGORIES,
  OTHER_WALL_ART_PICKER_CATEGORIES,
  PANEL_PRINT_PICKER_CATEGORIES,
  POSTER_PICKER_CATEGORIES,
} from "./variant-picker-policy";

export type RepresentativeOptionAxisPolicy = {
  field: string;
  requirement: "required" | "when-selectable";
  equivalence: "exact" | "reviewed";
};

export type RepresentativeOptionImplicitDefaultExclusion = {
  field: string;
  normalizedValues: readonly string[];
  reasonCode: string;
};

export type RepresentativeOptionTypicalValuePreference =
  | {
      field: string;
      /** The size nearest its scale's typical size, the larger one on a tie. */
      kind: "closest-typical-size";
      /** One normalized size per size scale, such as `apparel:adult:m`. */
      typicalSizes: readonly string[];
    }
  | {
      field: string;
      /** The dimensions nearest the typical size's area, the larger on a tie. */
      kind: "closest-typical-area";
      /** A normalized dimension such as `wall-art:dim:3048x4064`. */
      typicalSize: string;
    }
  | {
      field: string;
      /** The listed values in order; every other value ranks after them. */
      kind: "preferred-values";
      normalizedValues: readonly string[];
    };

export type RepresentativeOptionCategoryPolicy = {
  id: string;
  version: string;
  categorySlugs: readonly string[];
  readiness:
    | { status: "ready" }
    | {
        status: "not-applicable" | "evidence-blocked";
        reasonCode: string;
        reason: string;
      };
  canonicalEligibility?: {
    kind: "verified-branded-identity";
    reasonCode: string;
    reason: string;
  };
  axes: readonly RepresentativeOptionAxisPolicy[];
  minimumTupleAxisCount?: number;
  /** Generic garment selection stays within one reviewed supplier product. */
  requireSupplierProductSize?: boolean;
  stableTupleOrder: readonly string[];
  implicitDefaultExclusions: readonly RepresentativeOptionImplicitDefaultExclusion[];
  /**
   * Seller-typical values, in declared axis order, for candidates still tied
   * on supplier coverage and profile support. They never outrank either.
   */
  typicalValuePreferences?: readonly RepresentativeOptionTypicalValuePreference[];
};

const ALL_OVER_PRINT_COLOR_EXCLUSION = {
  field: "color",
  normalizedValues: ["all-over-print", "All Over Print"],
  reasonCode: "decoration-mode-is-not-a-representative-color",
} as const satisfies RepresentativeOptionImplicitDefaultExclusion;

// 12×16 in (≈ 30×40 cm) sits among the sizes most wall-art products offer:
// 12×12, 11×14, 12×18 and 16×20 in.
const TYPICAL_WALL_ART_SIZE_PREFERENCE = {
  field: "size",
  kind: "closest-typical-area",
  typicalSize: "wall-art:dim:3048x4064",
} as const satisfies RepresentativeOptionTypicalValuePreference;

export const CANVAS_PRINT_REPRESENTATIVE_OPTION_POLICY = {
  id: "canvas-print-representative-option",
  version: "2026-11-08.2",
  categorySlugs: CANVAS_PRINT_PICKER_CATEGORIES,
  readiness: { status: "ready" },
  axes: [
    {
      field: "frameProfile",
      requirement: "when-selectable",
      equivalence: "exact",
    },
    { field: "color", requirement: "when-selectable", equivalence: "exact" },
    {
      field: "backboardIncluded",
      requirement: "when-selectable",
      equivalence: "exact",
    },
    { field: "size", requirement: "required", equivalence: "reviewed" },
    { field: "quantity", requirement: "when-selectable", equivalence: "exact" },
    { field: "canvasStretchAllowance", requirement: "when-selectable", equivalence: "exact",
    },
    { field: "canvasBorderStyle", requirement: "when-selectable", equivalence: "exact",
    },
    {
      field: "mountType",
      requirement: "when-selectable",
      equivalence: "exact",
    },
    {
      field: "standIncluded",
      requirement: "when-selectable",
      equivalence: "exact",
    },
    {
      field: "materialOption",
      requirement: "when-selectable",
      equivalence: "exact",
    },
  ],
  stableTupleOrder: [
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
  ],
  implicitDefaultExclusions: [],
  typicalValuePreferences: [TYPICAL_WALL_ART_SIZE_PREFERENCE],
} as const satisfies RepresentativeOptionCategoryPolicy;

// Quantity, frame style, frame assembly and hanging hardware are not picker axes
// ([why](./variant-picker-policy.ts)); matching holds each supplier to its
// standard version instead.
export const WALL_ART_REPRESENTATIVE_OPTION_POLICY = {
  id: "wall-art-representative-option",
  version: "2026-11-08.1",
  categorySlugs: OTHER_WALL_ART_PICKER_CATEGORIES,
  readiness: { status: "ready" },
  axes: [
    { field: "size", requirement: "required", equivalence: "reviewed" },
    { field: "matIncluded", requirement: "when-selectable", equivalence: "exact",
    },
    { field: "finish", requirement: "when-selectable", equivalence: "exact" },
    {
      field: "mountType",
      requirement: "when-selectable",
      equivalence: "exact",
    },
    {
      field: "standIncluded",
      requirement: "when-selectable",
      equivalence: "exact",
    },
    {
      field: "edgeTreatment",
      requirement: "when-selectable",
      equivalence: "exact",
    },
    {
      field: "paperType",
      requirement: "when-selectable",
      equivalence: "exact",
    },
    {
      field: "materialOption",
      requirement: "when-selectable",
      equivalence: "exact",
    },
    { field: "color", requirement: "when-selectable", equivalence: "exact" },
  ],
  stableTupleOrder: [
    "size",
    "matIncluded",
    "finish",
    "mountType",
    "standIncluded",
    "edgeTreatment",
    "paperType",
    "materialOption",
    "color",
  ],
  implicitDefaultExclusions: [ALL_OVER_PRINT_COLOR_EXCLUSION],
  typicalValuePreferences: [TYPICAL_WALL_ART_SIZE_PREFERENCE],
} as const satisfies RepresentativeOptionCategoryPolicy;

// Metal and acrylic prints compare like other wall art without print type, which
// each supplier fixes as a production process.
export const PANEL_PRINT_REPRESENTATIVE_OPTION_POLICY = {
  ...WALL_ART_REPRESENTATIVE_OPTION_POLICY,
  id: "panel-print-representative-option",
  version: "2026-11-08.1",
  categorySlugs: PANEL_PRINT_PICKER_CATEGORIES,
  axes: WALL_ART_REPRESENTATIVE_OPTION_POLICY.axes,
  stableTupleOrder: WALL_ART_REPRESENTATIVE_OPTION_POLICY.stableTupleOrder,
} as const satisfies RepresentativeOptionCategoryPolicy;

// Posters compare like other wall art, except Printify's paper, which repeats
// the finish every supplier lists. Quantity and hanging hardware stay out for
// the reasons given at WALL_ART_VARIANT_PICKER_DIMENSIONS.
export const POSTER_REPRESENTATIVE_OPTION_POLICY = {
  id: "poster-representative-option",
  version: "2026-11-08.1",
  categorySlugs: POSTER_PICKER_CATEGORIES,
  readiness: { status: "ready" },
  axes: [
    { field: "size", requirement: "required", equivalence: "reviewed" },
    { field: "finish", requirement: "when-selectable", equivalence: "exact" },
    { field: "mountType", requirement: "when-selectable", equivalence: "exact" },
    { field: "standIncluded", requirement: "when-selectable", equivalence: "exact" },
    { field: "edgeTreatment", requirement: "when-selectable", equivalence: "exact" },
    { field: "materialOption", requirement: "when-selectable", equivalence: "exact" },
    { field: "color", requirement: "when-selectable", equivalence: "exact" },
  ],
  stableTupleOrder: [
    "size",
    "finish",
    "mountType",
    "standIncluded",
    "edgeTreatment",
    "materialOption",
    "color",
  ],
  implicitDefaultExclusions: [ALL_OVER_PRINT_COLOR_EXCLUSION],
  typicalValuePreferences: [TYPICAL_WALL_ART_SIZE_PREFERENCE],
} as const satisfies RepresentativeOptionCategoryPolicy;

export const DRINKWARE_REPRESENTATIVE_OPTION_POLICY = {
  id: "drinkware-representative-option",
  version: "2026-11-07.1",
  categorySlugs: [
    "drinkware",
    "glassware",
    "mugs",
    "tumblers",
    "water-bottles",
  ],
  readiness: { status: "ready" },
  axes: [
    { field: "strawKit", requirement: "when-selectable", equivalence: "exact" },

    { field: "capacity", requirement: "required", equivalence: "exact" },
    { field: "color", requirement: "when-selectable", equivalence: "exact" },
    { field: "finish", requirement: "when-selectable", equivalence: "exact" },
    {
      field: "lidIncluded",
      requirement: "when-selectable",
      equivalence: "exact",
    },
    {
      field: "materialOption",
      requirement: "when-selectable",
      equivalence: "exact",
    },
  ],
  stableTupleOrder: [
    "strawKit",
    "capacity",
    "color",
    "finish",
    "lidIncluded",
    "materialOption",
  ],
  implicitDefaultExclusions: [ALL_OVER_PRINT_COLOR_EXCLUSION],
} as const satisfies RepresentativeOptionCategoryPolicy;

export const MULTIPACK_REPRESENTATIVE_OPTION_POLICY = {
  id: "card-pack-representative-option",
  version: "2026-11-07.2",
  categorySlugs: ["cards", "greeting-cards", "postcards"],
  readiness: { status: "ready" },
  axes: [
    { field: "size", requirement: "required", equivalence: "exact" },
    { field: "quantity", requirement: "required", equivalence: "exact" },
    { field: "finish", requirement: "when-selectable", equivalence: "exact" },
    { field: "shape", requirement: "when-selectable", equivalence: "exact" },
  ],
  stableTupleOrder: ["size", "quantity", "finish", "shape"],
  implicitDefaultExclusions: [],
} as const satisfies RepresentativeOptionCategoryPolicy;

export const T_SHIRT_REPRESENTATIVE_OPTION_POLICY = {
  id: "t-shirt-representative-option",
  version: "2026-09-30.1",
  categorySlugs: ["long-sleeve-shirts", "t-shirts"],
  readiness: { status: "ready" },
  canonicalEligibility: {
    kind: "verified-branded-identity",
    reasonCode: "branded-apparel-identity-required",
    reason:
      "Generic apparel remains disabled until demographic and fit are explicit; verified branded models may attach canonical audience context to exact size/color profiles.",
  },
  axes: [
    {
      field: "audienceAgeGroup",
      requirement: "required",
      equivalence: "exact",
    },
    {
      field: "audienceGenderFit",
      requirement: "required",
      equivalence: "exact",
    },
    { field: "size", requirement: "required", equivalence: "exact" },
    { field: "color", requirement: "required", equivalence: "exact" },
  ],
  stableTupleOrder: ["audienceAgeGroup", "audienceGenderFit", "size", "color"],
  implicitDefaultExclusions: [ALL_OVER_PRINT_COLOR_EXCLUSION],
  typicalValuePreferences: [
    {
      field: "size",
      kind: "closest-typical-size",
      typicalSizes: [
        "apparel:adult:m",
        "apparel:adult-tall:lt",
        "apparel:youth:ym",
        "apparel:youth:8y",
        "apparel:toddler:3t",
        "apparel:baby:12m",
      ],
    },
    {
      field: "color",
      kind: "preferred-values",
      normalizedValues: ["black", "white"],
    },
  ],
} as const satisfies RepresentativeOptionCategoryPolicy;

export const BRANDED_APPAREL_REPRESENTATIVE_OPTION_POLICY = {
  ...T_SHIRT_REPRESENTATIVE_OPTION_POLICY,
  id: "branded-apparel-representative-option",
  categorySlugs: [
    "beanies",
    "bodysuits",
    "bucket-hats",
    "crop-tops",
    "dad-hats",
    "hoodies",
    "jackets",
    "polo-shirts",
    "quarter-zips",
    "sweatshirts",
  ],
} as const satisfies RepresentativeOptionCategoryPolicy;

export const HEADWEAR_REPRESENTATIVE_OPTION_POLICY = {
  ...BRANDED_APPAREL_REPRESENTATIVE_OPTION_POLICY,
  id: "headwear-representative-option",
  version: "2026-10-22.2",
  categorySlugs: HEADWEAR_MATCHING_CATEGORIES,
  axes: [
    { field: "audienceAgeGroup", requirement: "when-selectable", equivalence: "exact",
    },
    { field: "audienceGenderFit", requirement: "when-selectable", equivalence: "exact",
    },
    { field: "size", requirement: "required", equivalence: "exact" },
    { field: "color", requirement: "required", equivalence: "exact" },
    { field: "embroideryFoam", requirement: "when-selectable", equivalence: "exact",
    },
  ],
  stableTupleOrder: [
    ...BRANDED_APPAREL_REPRESENTATIVE_OPTION_POLICY.stableTupleOrder,
    "embroideryFoam",
  ],
} as const satisfies RepresentativeOptionCategoryPolicy;

export const PAPER_SIZE_REPRESENTATIVE_OPTION_POLICY = {
  id: "paper-size-representative-option",
  version: "2026-11-02.1",
  categorySlugs: [
    "brochures",
    "calendars",
    "commercial",
    "flyers",
    "paper-products",
    "stationery",
  ],
  readiness: { status: "ready" },
  axes: [
    { field: "size", requirement: "required", equivalence: "exact" },
    { field: "quantity", requirement: "when-selectable", equivalence: "exact" },
    { field: "pageCount", requirement: "when-selectable", equivalence: "exact",
    },
    { field: "finish", requirement: "when-selectable", equivalence: "exact" },
    {
      field: "paperType",
      requirement: "when-selectable",
      equivalence: "exact",
    },
    {
      field: "printSides",
      requirement: "when-selectable",
      equivalence: "exact",
    },
    { field: "shape", requirement: "when-selectable", equivalence: "exact" },
  ],
  stableTupleOrder: [
    "size",
    "quantity",
    "pageCount",
    "finish",
    "paperType",
    "printSides",
    "shape",
  ],
  implicitDefaultExclusions: [],
} as const satisfies RepresentativeOptionCategoryPolicy;

export const WRAPPING_PAPER_REPRESENTATIVE_OPTION_POLICY = {
  id: "wrapping-paper-representative-option",
  version: "2026-10-09.1",
  categorySlugs: ["wrapping-paper"],
  readiness: { status: "ready" },
  axes: [
    { field: "size", requirement: "required", equivalence: "exact" },
    { field: "quantity", requirement: "when-selectable", equivalence: "exact" },
    {
      field: "printSides",
      requirement: "when-selectable",
      equivalence: "exact",
    },
  ],
  stableTupleOrder: ["size", "quantity", "printSides"],
  implicitDefaultExclusions: [],
} as const satisfies RepresentativeOptionCategoryPolicy;

export const PRINT_RUN_REPRESENTATIVE_OPTION_POLICY = {
  id: "print-run-representative-option",
  version: "2026-11-07.1",
  categorySlugs: ["business-cards"],
  readiness: { status: "ready" },
  axes: [
    { field: "size", requirement: "required", equivalence: "exact" },
    { field: "quantity", requirement: "required", equivalence: "exact" },
    {
      field: "printSides",
      requirement: "when-selectable",
      equivalence: "exact",
    },
    { field: "shape", requirement: "when-selectable", equivalence: "exact" },
  ],
  stableTupleOrder: ["size", "quantity", "printSides", "shape"],
  implicitDefaultExclusions: [],
} as const satisfies RepresentativeOptionCategoryPolicy;

export const STICKER_REPRESENTATIVE_OPTION_POLICY = {
  id: "sticker-representative-option",
  version: "2026-10-09.1",
  categorySlugs: ["stickers"],
  readiness: { status: "ready" },
  axes: [
    { field: "size", requirement: "required", equivalence: "exact" },
    { field: "quantity", requirement: "when-selectable", equivalence: "exact" },
    { field: "finish", requirement: "when-selectable", equivalence: "exact" },
    {
      field: "printSides",
      requirement: "when-selectable",
      equivalence: "exact",
    },
    { field: "shape", requirement: "when-selectable", equivalence: "exact" },
  ],
  stableTupleOrder: [
    "size",
    "quantity",
    "finish",
    "printSides",
    "shape"],
  implicitDefaultExclusions: [],
} as const satisfies RepresentativeOptionCategoryPolicy;

export const NOTEBOOK_REPRESENTATIVE_OPTION_POLICY = {
  id: "notebook-representative-option",
  version: "2026-11-07.2",
  categorySlugs: ["notebooks"],
  readiness: { status: "ready" },
  axes: [
    { field: "size", requirement: "required", equivalence: "exact" },
    { field: "pageCount", requirement: "required", equivalence: "exact" },
    { field: "pageStyle", requirement: "required", equivalence: "exact" },
    {
      field: "paperType",
      requirement: "when-selectable",
      equivalence: "exact",
    },
    { field: "color", requirement: "when-selectable", equivalence: "exact" },
  ],
  stableTupleOrder: [
    "size",
    "pageCount",
    "pageStyle",
    "paperType",
    "color",
  ],
  implicitDefaultExclusions: [ALL_OVER_PRINT_COLOR_EXCLUSION],
} as const satisfies RepresentativeOptionCategoryPolicy;

export const DEVICE_REPRESENTATIVE_OPTION_POLICY = {
  id: "phone-device-fit-representative-option",
  version: "2026-07-18.2",
  categorySlugs: ["phone-cases"],
  readiness: { status: "ready" },
  axes: [
    { field: "deviceFit", requirement: "required", equivalence: "exact" },
    { field: "finish", requirement: "when-selectable", equivalence: "exact" },
    { field: "color", requirement: "when-selectable", equivalence: "exact" },
    {
      field: "materialOption",
      requirement: "when-selectable",
      equivalence: "exact",
    },
  ],
  stableTupleOrder: ["deviceFit", "finish", "color", "materialOption"],
  implicitDefaultExclusions: [ALL_OVER_PRINT_COLOR_EXCLUSION],
} as const satisfies RepresentativeOptionCategoryPolicy;

export const DIMENSIONAL_HOME_REPRESENTATIVE_OPTION_POLICY = {
  id: "dimensional-home-representative-option",
  version: "2026-11-07.1",
  categorySlugs: ["bedding", "blankets", "pillows", "rugs", "towels"],
  readiness: { status: "ready" },
  axes: [
    {
      field: "tasselColor",
      requirement: "when-selectable",
      equivalence: "exact",
    },
    {
      field: "borderColor",
      requirement: "when-selectable",
      equivalence: "exact",
    },

    { field: "size", requirement: "required", equivalence: "exact" },
    { field: "color", requirement: "when-selectable", equivalence: "exact" },
    {
      field: "fillIncluded",
      requirement: "when-selectable",
      equivalence: "exact",
    },
    { field: "finish", requirement: "when-selectable", equivalence: "exact" },
    { field: "closure", requirement: "when-selectable", equivalence: "exact" },
    {
      field: "materialOption",
      requirement: "when-selectable",
      equivalence: "exact",
    },
    {
      field: "liningOption",
      requirement: "when-selectable",
      equivalence: "exact",
    },
    { field: "quantity", requirement: "when-selectable", equivalence: "exact" },
    {
      field: "printSides",
      requirement: "when-selectable",
      equivalence: "exact",
    },
  ],
  stableTupleOrder: [
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
  ],
  implicitDefaultExclusions: [ALL_OVER_PRINT_COLOR_EXCLUSION],
} as const satisfies RepresentativeOptionCategoryPolicy;

export const FLEXIBLE_HOME_REPRESENTATIVE_OPTION_POLICY = {
  id: "flexible-home-representative-option",
  version: "2026-11-07.1",
  categorySlugs: ["home-decor", "kitchen-accessories"],
  readiness: { status: "ready" },
  axes: [
    { field: "electricalConfiguration",
      requirement: "when-selectable",
      equivalence: "exact",
    },
    { field: "size", requirement: "when-selectable", equivalence: "exact" },
    { field: "color", requirement: "when-selectable", equivalence: "exact" },
    { field: "finish", requirement: "when-selectable", equivalence: "exact" },
    {
      field: "fillIncluded",
      requirement: "when-selectable",
      equivalence: "exact",
    },
    { field: "designStyle", requirement: "when-selectable", equivalence: "exact",
    },
    { field: "closure", requirement: "when-selectable", equivalence: "exact" },
    {
      field: "materialOption",
      requirement: "when-selectable",
      equivalence: "exact",
    },
    {
      field: "lampStyle",
      requirement: "when-selectable",
      equivalence: "exact",
    },
    {
      field: "liningOption",
      requirement: "when-selectable",
      equivalence: "exact",
    },
    {
      field: "standIncluded",
      requirement: "when-selectable",
      equivalence: "exact",
    },
    {
      field: "printSides",
      requirement: "when-selectable",
      equivalence: "exact",
    },
  ],
  minimumTupleAxisCount: 1,
  stableTupleOrder: [
    "size",
    "color",
    "finish",
    "fillIncluded",
    "designStyle",
    "closure",
    "materialOption",
    "lampStyle",
    "liningOption",
    "standIncluded",
    "printSides",
  ],
  implicitDefaultExclusions: [ALL_OVER_PRINT_COLOR_EXCLUSION],
} as const satisfies RepresentativeOptionCategoryPolicy;

export const ORNAMENT_REPRESENTATIVE_OPTION_POLICY = {
  id: "ornament-representative-option",
  version: "2026-11-07.2",
  categorySlugs: ["ornaments"],
  readiness: { status: "ready" },
  axes: [
    { field: "hardwareFinish", requirement: "when-selectable", equivalence: "exact" },
    { field: "shape", requirement: "required", equivalence: "exact" },
    { field: "size", requirement: "when-selectable", equivalence: "exact" },
    { field: "quantity", requirement: "when-selectable", equivalence: "exact" },
    { field: "color", requirement: "when-selectable", equivalence: "exact" },
    {
      field: "designStyle",
      requirement: "when-selectable",
      equivalence: "exact",
    },
    {
      field: "thicknessType",
      requirement: "when-selectable",
      equivalence: "exact",
    },
    {
      field: "materialOption",
      requirement: "when-selectable",
      equivalence: "exact",
    },
    {
      field: "printSides",
      requirement: "when-selectable",
      equivalence: "exact",
    },
  ],
  stableTupleOrder: [
    "hardwareFinish",
    "shape",
    "size",
    "quantity",
    "color",
    "designStyle",
    "thicknessType",
    "materialOption",
    "printSides",
  ],
  implicitDefaultExclusions: [ALL_OVER_PRINT_COLOR_EXCLUSION],
} as const satisfies RepresentativeOptionCategoryPolicy;

export const DISPLAY_REPRESENTATIVE_OPTION_POLICY = {
  id: "display-representative-option",
  version: "2026-11-07.1",
  categorySlugs: ["banners", "flags", "signage"],
  readiness: { status: "ready" },
  axes: [
    {
      field: "ribbonIncluded",
      requirement: "when-selectable",
      equivalence: "exact",
    },

    { field: "size", requirement: "required", equivalence: "exact" },
    {
      field: "standIncluded",
      requirement: "when-selectable",
      equivalence: "exact",
    },
    { field: "finish", requirement: "when-selectable", equivalence: "exact" },
    { field: "closure", requirement: "when-selectable", equivalence: "exact" },
    {
      field: "printSides",
      requirement: "when-selectable",
      equivalence: "exact",
    },
    { field: "quantity", requirement: "when-selectable", equivalence: "exact" },
    { field: "color", requirement: "when-selectable", equivalence: "exact" },
    {
      field: "materialOption",
      requirement: "when-selectable",
      equivalence: "exact",
    },
  ],
  stableTupleOrder: [
    "ribbonIncluded",
    "size",
    "standIncluded",
    "finish",
    "closure",
    "printSides",
    "quantity",
    "color",
    "materialOption",
  ],
  implicitDefaultExclusions: [ALL_OVER_PRINT_COLOR_EXCLUSION],
} as const satisfies RepresentativeOptionCategoryPolicy;

export const CANDLE_REPRESENTATIVE_OPTION_POLICY = {
  id: "candle-scent-representative-option",
  version: "2026-07-18.1",
  categorySlugs: ["candles"],
  readiness: { status: "ready" },
  axes: [
    { field: "scent", requirement: "required", equivalence: "exact" },
    { field: "size", requirement: "when-selectable", equivalence: "exact" },
    { field: "color", requirement: "when-selectable", equivalence: "exact" },
    { field: "finish", requirement: "when-selectable", equivalence: "exact" },
  ],
  stableTupleOrder: ["scent", "size", "color", "finish"],
  implicitDefaultExclusions: [ALL_OVER_PRINT_COLOR_EXCLUSION],
} as const satisfies RepresentativeOptionCategoryPolicy;

export const FACE_MASK_REPRESENTATIVE_OPTION_POLICY = {
  id: "face-mask-size-representative-option",
  version: "2026-07-18.1",
  categorySlugs: ["face-masks"],
  readiness: { status: "ready" },
  axes: [
    { field: "size", requirement: "required", equivalence: "exact" },
    { field: "color", requirement: "when-selectable", equivalence: "exact" },
    { field: "fit", requirement: "when-selectable", equivalence: "exact" },
    {
      field: "construction",
      requirement: "when-selectable",
      equivalence: "exact",
    },
  ],
  stableTupleOrder: ["size", "color", "fit", "construction"],
  implicitDefaultExclusions: [ALL_OVER_PRINT_COLOR_EXCLUSION],
} as const satisfies RepresentativeOptionCategoryPolicy;

export const GENERIC_APPAREL_REPRESENTATIVE_OPTION_POLICY = {
  id: "generic-apparel-representative-option",
  version: "2026-07-18.2",
  categorySlugs: [
    "activewear",
    "apparel",
    "bibs",
    "button-up-shirts",
    "dresses",
    "footwear",
    "golf-caps",
    "jerseys",
    "joggers",
    "leggings",
    "pants",
    "sandals",
    "shoes",
    "shorts",
    "skirts",
    "sleepwear",
    "socks",
    "swimwear",
    "sweaters",
    "sweatpants",
    "tank-tops",
    "underwear",
    "vests",
    "visors",
  ],
  readiness: {
    status: "evidence-blocked",
    reasonCode: "apparel-demographic-fit-evidence-incomplete",
    reason:
      "Size cannot be compared safely until audience, fit, and size-system evidence is complete on every selected profile.",
  },
  axes: [
    {
      field: "audienceAgeGroup",
      requirement: "required",
      equivalence: "exact",
    },
    {
      field: "audienceGenderFit",
      requirement: "required",
      equivalence: "exact",
    },
    { field: "fit", requirement: "required", equivalence: "exact" },
    { field: "size", requirement: "required", equivalence: "exact" },
  ],
  stableTupleOrder: ["audienceAgeGroup", "audienceGenderFit", "fit", "size"],
  implicitDefaultExclusions: [],
} as const satisfies RepresentativeOptionCategoryPolicy;

export const BAG_REPRESENTATIVE_OPTION_POLICY = {
  id: "bag-representative-option",
  version: "2026-07-18.1",
  categorySlugs: [
    "aprons",
    "backpacks",
    "bags",
    "coolers",
    "drawstring-bags",
    "duffel-bags",
    "fanny-packs",
    "tote-bags",
  ],
  readiness: {
    status: "evidence-blocked",
    reasonCode: "bag-dimension-capacity-evidence-incomplete",
    reason:
      "Color is structured, but dimensions, capacity, and construction are not profile-normalized consistently enough to align bag configurations.",
  },
  axes: [
    { field: "size", requirement: "required", equivalence: "exact" },
    { field: "capacity", requirement: "when-selectable", equivalence: "exact" },
    { field: "closure", requirement: "when-selectable", equivalence: "exact" },
    { field: "color", requirement: "when-selectable", equivalence: "exact" },
  ],
  stableTupleOrder: ["size", "capacity", "closure", "color"],
  implicitDefaultExclusions: [ALL_OVER_PRINT_COLOR_EXCLUSION],
} as const satisfies RepresentativeOptionCategoryPolicy;

export const DEVICE_ADJACENT_REPRESENTATIVE_OPTION_POLICY = {
  id: "device-adjacent-representative-option",
  version: "2026-07-18.1",
  categorySlugs: [
    "earphone-cases",
    "electronics-accessories",
    "laptop-sleeves",
    "tablet-cases",
  ],
  readiness: {
    status: "evidence-blocked",
    reasonCode: "device-fit-evidence-missing",
    reason:
      "Device-specific dimensions and model compatibility are not represented as exact device-fit profile facts.",
  },
  axes: [{ field: "deviceFit", requirement: "required", equivalence: "exact" }],
  stableTupleOrder: ["deviceFit"],
  implicitDefaultExclusions: [],
} as const satisfies RepresentativeOptionCategoryPolicy;

export const PET_REPRESENTATIVE_OPTION_POLICY = {
  id: "pet-fit-representative-option",
  version: "2026-07-18.1",
  categorySlugs: ["pet-apparel", "pet-products"],
  readiness: {
    status: "evidence-blocked",
    reasonCode: "pet-species-fit-size-evidence-incomplete",
    reason:
      "Species, fit system, and size are not jointly complete enough to compare pet-product profiles safely.",
  },
  axes: [
    { field: "animalType", requirement: "required", equivalence: "exact" },
    { field: "fit", requirement: "required", equivalence: "exact" },
    { field: "size", requirement: "required", equivalence: "exact" },
  ],
  stableTupleOrder: ["animalType", "fit", "size"],
  implicitDefaultExclusions: [],
} as const satisfies RepresentativeOptionCategoryPolicy;

export const UNSTRUCTURED_DIMENSION_REPRESENTATIVE_OPTION_POLICY = {
  id: "unstructured-dimension-representative-option",
  version: "2026-07-18.1",
  categorySlugs: ["magnets", "mouse-pads", "puzzles", "tableware"],
  readiness: {
    status: "evidence-blocked",
    reasonCode: "selected-profile-dimension-evidence-missing",
    reason:
      "Dimensions or configuration are visible in product data but are not exact selected-profile facts, so partial axes such as shape or quantity cannot define a safe default.",
  },
  axes: [
    { field: "size", requirement: "required", equivalence: "exact" },
    { field: "quantity", requirement: "when-selectable", equivalence: "exact" },
    { field: "shape", requirement: "when-selectable", equivalence: "exact" },
  ],
  stableTupleOrder: ["size", "quantity", "shape"],
  implicitDefaultExclusions: [],
} as const satisfies RepresentativeOptionCategoryPolicy;

export const HETEROGENEOUS_CATEGORY_REPRESENTATIVE_OPTION_POLICY = {
  id: "heterogeneous-category-representative-option",
  version: "2026-07-18.1",
  categorySlugs: [
    "accessories",
    "car-accessories",
    "consumables",
    "jewelry",
    "keychains",
    "party-supplies",
    "personal-accessories",
    "plushies",
    "seasonal",
    "tech",
  ],
  readiness: {
    status: "evidence-blocked",
    reasonCode: "category-option-axis-contract-incomplete",
    reason:
      "The category contains product families with different missing size, fit, device, bundle, or configuration axes; a shared partial-axis policy would overstate comparability.",
  },
  axes: [],
  stableTupleOrder: [],
  implicitDefaultExclusions: [],
} as const satisfies RepresentativeOptionCategoryPolicy;

export const UNMODELED_PROFILE_CONFIGURATION_REPRESENTATIVE_OPTION_POLICY = {
  id: "unmodeled-profile-configuration-representative-option",
  version: "2026-07-18.1",
  categorySlugs: [
    "bathroom",
    "books",
    "coffee",
    "folders",
    "gifts",
    "hair-accessories",
    "office-supplies",
    "patches",
    "photo-books",
    "pins",
    "skincare",
    "sports-accessories",
    "toys",
    "watches",
    "yoga-mats",
  ],
  readiness: {
    status: "evidence-blocked",
    reasonCode: "selected-profile-configuration-evidence-incomplete",
    reason:
      "The category's size, quantity, fit, page, or configuration axes have not been materialized as a complete exact selected-profile contract.",
  },
  axes: [],
  stableTupleOrder: [],
  implicitDefaultExclusions: [],
} as const satisfies RepresentativeOptionCategoryPolicy;

export const UNKNOWN_CATEGORY_REPRESENTATIVE_OPTION_POLICY = {
  id: "unknown-category-representative-option",
  version: "2026-07-18.1",
  categorySlugs: ["unknown"],
  readiness: {
    status: "evidence-blocked",
    reasonCode: "primary-category-classification-missing",
    reason:
      "A category-specific option contract cannot be chosen until the canonical has a reviewed primary category.",
  },
  axes: [],
  stableTupleOrder: [],
  implicitDefaultExclusions: [],
} as const satisfies RepresentativeOptionCategoryPolicy;

export const REPRESENTATIVE_OPTION_POLICIES = [
  CANVAS_PRINT_REPRESENTATIVE_OPTION_POLICY,
  POSTER_REPRESENTATIVE_OPTION_POLICY,
  PANEL_PRINT_REPRESENTATIVE_OPTION_POLICY,
  WALL_ART_REPRESENTATIVE_OPTION_POLICY,
  DRINKWARE_REPRESENTATIVE_OPTION_POLICY,
  MULTIPACK_REPRESENTATIVE_OPTION_POLICY,
  T_SHIRT_REPRESENTATIVE_OPTION_POLICY,
  BRANDED_APPAREL_REPRESENTATIVE_OPTION_POLICY,
  HEADWEAR_REPRESENTATIVE_OPTION_POLICY,
  PAPER_SIZE_REPRESENTATIVE_OPTION_POLICY,
  WRAPPING_PAPER_REPRESENTATIVE_OPTION_POLICY,
  PRINT_RUN_REPRESENTATIVE_OPTION_POLICY,
  STICKER_REPRESENTATIVE_OPTION_POLICY,
  NOTEBOOK_REPRESENTATIVE_OPTION_POLICY,
  DEVICE_REPRESENTATIVE_OPTION_POLICY,
  DIMENSIONAL_HOME_REPRESENTATIVE_OPTION_POLICY,
  FLEXIBLE_HOME_REPRESENTATIVE_OPTION_POLICY,
  ORNAMENT_REPRESENTATIVE_OPTION_POLICY,
  DISPLAY_REPRESENTATIVE_OPTION_POLICY,
  CANDLE_REPRESENTATIVE_OPTION_POLICY,
  FACE_MASK_REPRESENTATIVE_OPTION_POLICY,
  GENERIC_APPAREL_REPRESENTATIVE_OPTION_POLICY,
  BAG_REPRESENTATIVE_OPTION_POLICY,
  DEVICE_ADJACENT_REPRESENTATIVE_OPTION_POLICY,
  PET_REPRESENTATIVE_OPTION_POLICY,
  UNSTRUCTURED_DIMENSION_REPRESENTATIVE_OPTION_POLICY,
  HETEROGENEOUS_CATEGORY_REPRESENTATIVE_OPTION_POLICY,
  UNMODELED_PROFILE_CONFIGURATION_REPRESENTATIVE_OPTION_POLICY,
  UNKNOWN_CATEGORY_REPRESENTATIVE_OPTION_POLICY,
] as const satisfies readonly RepresentativeOptionCategoryPolicy[];

const POLICY_BY_CATEGORY = indexPoliciesByCategory(
  REPRESENTATIVE_OPTION_POLICIES
);

export function getRepresentativeOptionPolicy(
  categorySlug: string,
  canonicalSpecs?: SelectedConfigurationClass | null
): RepresentativeOptionCategoryPolicy | null {
  return (
    resolveSelectedConfigurationFamily(categorySlug, canonicalSpecs)
      ?.representative ??
    POLICY_BY_CATEGORY.get(categorySlug) ?? null
  );
}

function indexPoliciesByCategory(
  policies: readonly RepresentativeOptionCategoryPolicy[]
): Map<string, RepresentativeOptionCategoryPolicy> {
  const result = new Map<string, RepresentativeOptionCategoryPolicy>();

  for (const policy of policies) {
    for (const categorySlug of policy.categorySlugs) {
      const existing = result.get(categorySlug);
      if (existing) {
        throw new Error(
          `Representative-option category ${categorySlug} is covered by both ${existing.id} and ${policy.id}.`
        );
      }
      result.set(categorySlug, policy);
    }
  }

  return result;
}

/** A native selector is usable without claiming shared garment fit or inheriting canonical audience. */
export function representativePolicyForCanonical(
  policy: RepresentativeOptionCategoryPolicy | null,
  identity?: { comparisonClass: string }
): RepresentativeOptionCategoryPolicy | null {
  if (identity?.comparisonClass !== "generic" || policy?.canonicalEligibility?.kind !== "verified-branded-identity") return policy;
  const { canonicalEligibility: _eligibility, ...base } = policy;
  return {
    ...base,
    id: `${policy.id}-generic-product-local`,
    version: "2026-11-03.1",
    axes: policy.axes.filter(axis => axis.field !== "audienceAgeGroup" && axis.field !== "audienceGenderFit"),
    stableTupleOrder: policy.stableTupleOrder.filter(field => field !== "audienceAgeGroup" && field !== "audienceGenderFit"),
    requireSupplierProductSize: true,
    implicitDefaultExclusions: [],
  };
}

export function hasOwnedSupplierSize(
  size: string | undefined,
  productId: string
): boolean {
  return Boolean(size?.startsWith(`supplier-size:${productId.toLowerCase()}:`) && size.length > `supplier-size:${productId}:`.length);
}
