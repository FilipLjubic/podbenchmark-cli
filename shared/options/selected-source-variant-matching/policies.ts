import { resolveSelectedConfigurationFamily, type SelectedConfigurationClass } from "../selected-configuration-family";
import {
  BRANDED_APPAREL_PICKER_CATEGORIES,
  CANVAS_PRINT_PICKER_CATEGORIES,
  HEADWEAR_MATCHING_CATEGORIES,
  OTHER_WALL_ART_PICKER_CATEGORIES,
  PANEL_PRINT_PICKER_CATEGORIES,
  POSTER_PICKER_CATEGORIES,
  T_SHIRT_PICKER_CATEGORIES,
} from "../variant-picker-policy";
import type { SelectedSourceVariantMatchingPolicy } from "./types";

export const CANVAS_PRINT_SELECTED_SOURCE_MATCHING_POLICY = {
  id: "canvas-print-selected-source",
  version: "2026-11-08.2",
  ignoreUnpickedConditionalFields: true,
  categorySlugs: CANVAS_PRINT_PICKER_CATEGORIES,
  fields: [
    { field: "frameProfile", role: "conditional", fallback: "none" },
    { field: "color", role: "conditional", fallback: "color-family-nearest" },
    { field: "backboardIncluded", role: "conditional", fallback: "none" },
    { field: "size", role: "required", fallback: "wall-art-size-nearest" },
    // An expressed pack count requires evidence on both sides; no count is assumed.
    { field: "quantity", role: "defaultable", defaultValue: [] },
    { field: "finish", role: "conditional", valueFamily: true },
    { field: "canvasStretchAllowance", role: "conditional" },
    { field: "canvasBorderStyle", role: "conditional" },
    { field: "mountType", role: "conditional" },
    { field: "standIncluded", role: "conditional" },
    { field: "materialOption", role: "conditional" },
    { field: "printPosition", role: "unsupported" },
    { field: "deviceFit", role: "unsupported" },
  ],
} as const satisfies SelectedSourceVariantMatchingPolicy;

// One print or frame is the standard version of an Artelo listing that also
// sells sets and kits (see WALL_ART_VARIANT_PICKER_DIMENSIONS): quantity one,
// and a frame sold assembled. Frame grade and hanging hardware are not compared.
const SINGLE_ITEM_QUANTITIES = ["quantity:pack:1", "quantity:print-run:1"] as const;

export const WALL_ART_SELECTED_SOURCE_MATCHING_POLICY = {
  id: "wall-art-selected-source",
  version: "2026-11-08.2",
  ignoreUnpickedConditionalFields: true,
  categorySlugs: OTHER_WALL_ART_PICKER_CATEGORIES,
  fields: [
    { field: "size", role: "required", fallback: "wall-art-size-nearest" },
    { field: "quantity", role: "defaultable", defaultValue: SINGLE_ITEM_QUANTITIES, standardOnly: true },
    { field: "matIncluded", role: "conditional" },
    { field: "frameAssemblyIncluded", role: "defaultable", defaultValue: ["true"], standardOnly: true },
    { field: "finish", role: "conditional", valueFamily: true },
    { field: "mountType", role: "conditional" },
    { field: "standIncluded", role: "conditional" },
    { field: "edgeTreatment", role: "conditional" },
    { field: "paperType", role: "conditional", valueFamily: true },
    { field: "materialOption", role: "conditional" },
    { field: "color", role: "conditional", fallback: "color-family-nearest" },
    { field: "printPosition", role: "unsupported" },
    { field: "deviceFit", role: "unsupported" },
  ],
} as const satisfies SelectedSourceVariantMatchingPolicy;

export const POSTER_SELECTED_SOURCE_MATCHING_POLICY = {
  id: "poster-selected-source",
  version: "2026-11-08.2",
  ignoreUnpickedConditionalFields: true,
  categorySlugs: POSTER_PICKER_CATEGORIES,
  fields: WALL_ART_SELECTED_SOURCE_MATCHING_POLICY.fields.filter(
    field => field.field !== "paperType"
  ),
} as const satisfies SelectedSourceVariantMatchingPolicy;

const PANEL_PRINT_SELECTED_SOURCE_MATCHING_POLICY = {
  id: "panel-print-selected-source",
  version: "2026-11-08.2",
  ignoreUnpickedConditionalFields: true,
  categorySlugs: PANEL_PRINT_PICKER_CATEGORIES,
  fields: WALL_ART_SELECTED_SOURCE_MATCHING_POLICY.fields,
} as const satisfies SelectedSourceVariantMatchingPolicy;

const ORDERED_QUANTITY_SELECTED_SOURCE_MATCHING_POLICY = {
  id: "card-pack-selected-source",
  version: "2026-11-07.2",
  categorySlugs: ["cards", "greeting-cards", "postcards"],
  // Paper is not compared (see MULTIPACK_VARIANT_PICKER_DIMENSIONS).
  fields: [
    { field: "size", role: "required", fallback: "none" },
    { field: "quantity", role: "required", fallback: "ordered-count-nearest" },
    { field: "finish", role: "conditional" },
    { field: "shape", role: "conditional" },
  ],
} as const satisfies SelectedSourceVariantMatchingPolicy;

export const NOTEBOOK_SELECTED_SOURCE_MATCHING_POLICY = {
  id: "notebook-size-page-count-selected-source",
  version: "2026-11-07.2",
  categorySlugs: ["notebooks"],
  // Cover finish is not compared (see NOTEBOOK_VARIANT_PICKER_DIMENSIONS).
  fields: [
    { field: "size", role: "required", fallback: "none" },
    {
      field: "pageCount",
      role: "required",
      fallback: "ordered-count-nearest",
    },
    { field: "pageStyle", role: "required", fallback: "none" },
    { field: "paperType", role: "conditional" },
    { field: "color", role: "conditional", fallback: "color-family-nearest" },
  ],
} as const satisfies SelectedSourceVariantMatchingPolicy;

const PROTECTED_PAPER_STANDARD_SELECTED_SOURCE_MATCHING_POLICY = {
  id: "protected-paper-standard-selected-source",
  version: "2026-11-02.1",
  categorySlugs: [
    "brochures",
    "calendars",
    "commercial",
    "flyers",
    "paper-products",
    "stationery",
  ],
  fields: [
    { field: "size", role: "required", fallback: "none" },
    { field: "quantity", role: "conditional" },
    { field: "pageCount", role: "conditional", fallback: "none" },
    { field: "finish", role: "conditional" },
    { field: "paperType", role: "conditional" },
    { field: "printSides", role: "conditional" },
    { field: "shape", role: "conditional" },
  ],
} as const satisfies SelectedSourceVariantMatchingPolicy;

const WRAPPING_PAPER_SELECTED_SOURCE_MATCHING_POLICY = {
  id: "wrapping-paper-selected-source",
  version: "2026-10-09.1",
  categorySlugs: ["wrapping-paper"],
  fields: [
    { field: "size", role: "required", fallback: "none" },
    { field: "quantity", role: "conditional" },
    { field: "printSides", role: "conditional" },
  ],
} as const satisfies SelectedSourceVariantMatchingPolicy;

export const PRINT_RUN_SELECTED_SOURCE_MATCHING_POLICY = {
  id: "print-run-selected-source",
  version: "2026-11-07.1",
  categorySlugs: ["business-cards"],
  fields: [
    { field: "size", role: "required", fallback: "none" },
    { field: "quantity", role: "required", fallback: "ordered-count-nearest" },
    { field: "printSides", role: "conditional" },
    { field: "shape", role: "conditional" },
  ],
} as const satisfies SelectedSourceVariantMatchingPolicy;

const STICKER_SELECTED_SOURCE_MATCHING_POLICY = {
  id: "sticker-selected-source",
  version: "2026-10-09.1",
  categorySlugs: ["stickers"],
  fields: [
    { field: "size", role: "required", fallback: "none" },
    { field: "quantity", role: "conditional" },
    { field: "finish", role: "conditional" },
    { field: "printSides", role: "conditional" },
    { field: "shape", role: "conditional" },
  ],
} as const satisfies SelectedSourceVariantMatchingPolicy;

const DRINKWARE_CAPACITY_SELECTED_SOURCE_MATCHING_POLICY = {
  id: "drinkware-capacity-selected-source",
  version: "2026-11-07.1",
  categorySlugs: [
    "drinkware",
    "glassware",
    "mugs",
    "tumblers",
    "water-bottles",
  ],
  fields: [
    { field: "strawKit", role: "conditional", fallback: "none" },

    { field: "capacity", role: "required", fallback: "none" },
    // A bulk bundle (36 mugs for one price) is a different purchase from one mug,
    // so only a single mug, or a listing that states no count, is compared.
    { field: "quantity", role: "defaultable", defaultValue: SINGLE_ITEM_QUANTITIES, standardOnly: true },
    { field: "color", role: "conditional", fallback: "color-family-nearest" },
    { field: "finish", role: "conditional" },
    { field: "lidIncluded", role: "conditional" },
    { field: "materialOption", role: "conditional" },
  ],
} as const satisfies SelectedSourceVariantMatchingPolicy;

const APPAREL_SIZE_SELECTED_SOURCE_MATCHING_POLICY = {
  id: "apparel-size-selected-source",
  version: "2026-06-08.1",
  categorySlugs: [
    "activewear",
    "apparel",
    "dresses",
    "footwear",
    "jerseys",
    "joggers",
    "leggings",
    "pants",
    "sandals",
    "shoes",
    "shorts",
    "skirts",
    "socks",
    "swimwear",
    "tank-tops",
  ],
  fields: [{ field: "size", role: "required", fallback: "none" }],
} as const satisfies SelectedSourceVariantMatchingPolicy;

const BRANDED_APPAREL_SIZE_COLOR_SELECTED_SOURCE_MATCHING_POLICY = {
  id: "branded-apparel-size-color-selected-source",
  version: "2026-07-31.1",
  categorySlugs: BRANDED_APPAREL_PICKER_CATEGORIES.filter(
    category =>
      !HEADWEAR_MATCHING_CATEGORIES.some(headwear => headwear === category)
  ),
  fields: [
    { field: "size", role: "required", fallback: "none" },
    { field: "color", role: "required", fallback: "color-family-nearest" },
  ],
} as const satisfies SelectedSourceVariantMatchingPolicy;

const HEADWEAR_SELECTED_SOURCE_MATCHING_POLICY = {
  ...BRANDED_APPAREL_SIZE_COLOR_SELECTED_SOURCE_MATCHING_POLICY,
  id: "headwear-size-color-foam-selected-source",
  version: "2026-10-22.1",
  categorySlugs: HEADWEAR_MATCHING_CATEGORIES,
  fields: [
    ...BRANDED_APPAREL_SIZE_COLOR_SELECTED_SOURCE_MATCHING_POLICY.fields,
    { field: "embroideryFoam", role: "conditional", fallback: "none" },
  ],
} as const satisfies SelectedSourceVariantMatchingPolicy;

// Matching can protect the selected cut/family without admitting a generic
// apparel picker or borrowing audience from a canonical product.
const SLEEPWEAR_SELECTED_SOURCE_MATCHING_POLICY = {
  id: "sleepwear-size-cut-selected-source",
  version: "2026-10-22.1",
  categorySlugs: ["sleepwear"],
  fields: [
    { field: "size", role: "required", fallback: "none" },
    { field: "audienceGenderFit", role: "conditional", fallback: "none" },
    { field: "audienceAgeGroup", role: "conditional", fallback: "none" },
  ],
} as const satisfies SelectedSourceVariantMatchingPolicy;

const T_SHIRT_SIZE_COLOR_SELECTED_SOURCE_MATCHING_POLICY = {
  id: "t-shirt-size-color-selected-source",
  version: "2026-07-31.1",
  categorySlugs: T_SHIRT_PICKER_CATEGORIES,
  fields: [
    { field: "size", role: "required", fallback: "none" },
    { field: "color", role: "required", fallback: "color-family-nearest" },
  ],
} as const satisfies SelectedSourceVariantMatchingPolicy;

const DEVICE_FIT_SELECTED_SOURCE_MATCHING_POLICY = {
  id: "phone-device-fit-selected-source",
  version: "2026-07-31.1",
  categorySlugs: ["phone-cases"],
  fields: [
    { field: "deviceFit", role: "required", fallback: "none" },
    { field: "finish", role: "conditional" },
    { field: "color", role: "conditional", fallback: "color-family-nearest" },
    { field: "materialOption", role: "conditional" },
  ],
} as const satisfies SelectedSourceVariantMatchingPolicy;

const DIMENSIONAL_HOME_SELECTED_SOURCE_MATCHING_POLICY = {
  id: "dimensional-home-selected-source",
  version: "2026-11-07.1",
  categorySlugs: ["bedding", "blankets", "pillows", "rugs", "towels"],
  fields: [
    { field: "tasselColor", role: "conditional", fallback: "none" },
    { field: "borderColor", role: "conditional", fallback: "none" },

    { field: "size", role: "required", fallback: "none" },
    { field: "color", role: "conditional", fallback: "color-family-nearest" },
    { field: "fillIncluded", role: "conditional" },
    { field: "finish", role: "conditional" },
    { field: "closure", role: "conditional" },
    { field: "materialOption", role: "conditional" },
    { field: "liningOption", role: "conditional" },
    { field: "quantity", role: "conditional" },
    { field: "printSides", role: "conditional" },
  ],
} as const satisfies SelectedSourceVariantMatchingPolicy;

const FLEXIBLE_HOME_SELECTED_SOURCE_MATCHING_POLICY = {
  id: "flexible-home-selected-source",
  version: "2026-11-07.1",
  categorySlugs: ["home-decor", "kitchen-accessories"],
  fields: [
    { field: "electricalConfiguration", role: "conditional", fallback: "none" },
    { field: "size", role: "conditional" },
    { field: "quantity", role: "defaultable", defaultValue: SINGLE_ITEM_QUANTITIES, standardOnly: true },
    { field: "color", role: "conditional", fallback: "color-family-nearest" },
    { field: "finish", role: "conditional" },
    { field: "matIncluded", role: "conditional" },
    { field: "frameAssemblyIncluded", role: "defaultable", defaultValue: ["true"], standardOnly: true },
    { field: "fillIncluded", role: "conditional" },
    { field: "designStyle", role: "conditional", fallback: "none" },
    { field: "closure", role: "conditional" },
    { field: "materialOption", role: "conditional" },
    { field: "lampStyle", role: "conditional" },
    { field: "liningOption", role: "conditional" },
    { field: "standIncluded", role: "conditional" },
    { field: "printSides", role: "conditional" },
  ],
} as const satisfies SelectedSourceVariantMatchingPolicy;

const ORNAMENT_SELECTED_SOURCE_MATCHING_POLICY = {
  id: "ornament-selected-source",
  version: "2026-11-07.2",
  categorySlugs: ["ornaments"],
  // Finish is not compared (see ORNAMENT_VARIANT_PICKER_DIMENSIONS).
  fields: [
    { field: "hardwareFinish", role: "conditional", fallback: "none" },
    { field: "shape", role: "required", fallback: "none" },
    { field: "size", role: "conditional" },
    { field: "quantity", role: "conditional" },
    { field: "color", role: "conditional", fallback: "color-family-nearest" },
    { field: "designStyle", role: "conditional" },
    { field: "thicknessType", role: "conditional" },
    { field: "materialOption", role: "conditional" },
    { field: "printSides", role: "conditional" },
  ],
} as const satisfies SelectedSourceVariantMatchingPolicy;

const DISPLAY_SELECTED_SOURCE_MATCHING_POLICY = {
  id: "display-selected-source",
  version: "2026-11-07.1",
  categorySlugs: ["banners", "flags", "signage"],
  fields: [
    { field: "ribbonIncluded", role: "conditional", fallback: "none" },

    { field: "size", role: "required", fallback: "none" },
    { field: "standIncluded", role: "conditional" },
    { field: "finish", role: "conditional" },
    { field: "closure", role: "conditional" },
    { field: "printSides", role: "conditional" },
    { field: "quantity", role: "conditional" },
    { field: "color", role: "conditional", fallback: "color-family-nearest" },
    { field: "materialOption", role: "conditional" },
  ],
} as const satisfies SelectedSourceVariantMatchingPolicy;

const CANDLE_SELECTED_SOURCE_MATCHING_POLICY = {
  id: "candle-scent-selected-source",
  version: "2026-07-31.1",
  categorySlugs: ["candles"],
  fields: [
    { field: "scent", role: "required", fallback: "none" },
    { field: "size", role: "conditional" },
    { field: "color", role: "conditional", fallback: "color-family-nearest" },
    { field: "finish", role: "conditional" },
  ],
} as const satisfies SelectedSourceVariantMatchingPolicy;

const FACE_MASK_SELECTED_SOURCE_MATCHING_POLICY = {
  id: "face-mask-selected-source",
  version: "2026-07-31.1",
  categorySlugs: ["face-masks"],
  fields: [
    { field: "size", role: "required", fallback: "none" },
    { field: "color", role: "conditional", fallback: "color-family-nearest" },
    { field: "fit", role: "conditional" },
    { field: "construction", role: "conditional" },
  ],
} as const satisfies SelectedSourceVariantMatchingPolicy;

export const SELECTED_SOURCE_VARIANT_MATCHING_POLICIES = [
  CANVAS_PRINT_SELECTED_SOURCE_MATCHING_POLICY,
  POSTER_SELECTED_SOURCE_MATCHING_POLICY,
  PANEL_PRINT_SELECTED_SOURCE_MATCHING_POLICY,
  WALL_ART_SELECTED_SOURCE_MATCHING_POLICY,
  ORDERED_QUANTITY_SELECTED_SOURCE_MATCHING_POLICY,
  NOTEBOOK_SELECTED_SOURCE_MATCHING_POLICY,
  PROTECTED_PAPER_STANDARD_SELECTED_SOURCE_MATCHING_POLICY,
  WRAPPING_PAPER_SELECTED_SOURCE_MATCHING_POLICY,
  PRINT_RUN_SELECTED_SOURCE_MATCHING_POLICY,
  STICKER_SELECTED_SOURCE_MATCHING_POLICY,
  DRINKWARE_CAPACITY_SELECTED_SOURCE_MATCHING_POLICY,
  T_SHIRT_SIZE_COLOR_SELECTED_SOURCE_MATCHING_POLICY,
  BRANDED_APPAREL_SIZE_COLOR_SELECTED_SOURCE_MATCHING_POLICY,
  HEADWEAR_SELECTED_SOURCE_MATCHING_POLICY,
  APPAREL_SIZE_SELECTED_SOURCE_MATCHING_POLICY,
  SLEEPWEAR_SELECTED_SOURCE_MATCHING_POLICY,
  DEVICE_FIT_SELECTED_SOURCE_MATCHING_POLICY,
  DIMENSIONAL_HOME_SELECTED_SOURCE_MATCHING_POLICY,
  FLEXIBLE_HOME_SELECTED_SOURCE_MATCHING_POLICY,
  ORNAMENT_SELECTED_SOURCE_MATCHING_POLICY,
  DISPLAY_SELECTED_SOURCE_MATCHING_POLICY,
  CANDLE_SELECTED_SOURCE_MATCHING_POLICY,
  FACE_MASK_SELECTED_SOURCE_MATCHING_POLICY,
] as const satisfies readonly SelectedSourceVariantMatchingPolicy[];

function indexSelectedSourcePoliciesByCategory(
  policies: readonly SelectedSourceVariantMatchingPolicy[]
): Map<string, SelectedSourceVariantMatchingPolicy> {
  const policiesByCategory = new Map<
    string,
    SelectedSourceVariantMatchingPolicy
  >();

  for (const policy of policies) {
    for (const slug of policy.categorySlugs) {
      const existing = policiesByCategory.get(slug);
      if (existing) {
        throw new Error(
          `Selected-source category ${slug} is covered by both ${existing.id} and ${policy.id}.`
        );
      }
      policiesByCategory.set(slug, policy);
    }
  }

  return policiesByCategory;
}

const SELECTED_SOURCE_VARIANT_MATCHING_POLICY_BY_CATEGORY =
  indexSelectedSourcePoliciesByCategory(
    SELECTED_SOURCE_VARIANT_MATCHING_POLICIES
  );

export function getSelectedSourceVariantMatchingPolicy(
  categorySlug: string,
  canonicalSpecs?: SelectedConfigurationClass | null
): SelectedSourceVariantMatchingPolicy | null {
  return (
    resolveSelectedConfigurationFamily(categorySlug, canonicalSpecs)
      ?.matching ??
    SELECTED_SOURCE_VARIANT_MATCHING_POLICY_BY_CATEGORY.get(categorySlug) ??
    null
  );
}
