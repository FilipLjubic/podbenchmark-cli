const PROFILE_FACT_CARDINALITIES = [
  "product-invariant",
  "profile-scoped",
  "component-scoped",
  "unresolved",
] as const;

export type ProfileFactCardinality =
  (typeof PROFILE_FACT_CARDINALITIES)[number];

type ProfileFactCardinalityPolicy = {
  cardinality: ProfileFactCardinality;
  reason: string;
};

const PRODUCT_INVARIANT_FIELDS = new Set([
  "type",
  "subtype",
  "brand",
  "model",
  "ecoFriendly",
  "careInstructions",
  "material",
  "fabric",
  "weight",
  "neckline",
  "sleeve",
  "yarnType",
  "fabricBlendCategory",
  "labelType",
  "insulated",
  "doubleWall",
  "dishwasherSafe",
  "microwaveSafe",
  "paperWeightGsm",
  "bindingType",
  "weatherproof",
  "caseType",
  "protection",
  "magSafeCompatible",
  "wirelessCharging",
  "coverage",
  "compartments",
  "style",
  "structured",
  "brimStyle",
  "profile",
  "panels",
  "knitPattern",
  "baseMetal",
  "plating",
  "paperClass",
  "inkType",
  "archivalGrade",
  "canvasThicknessType",
]);

const PROFILE_SCOPED_FIELDS = new Set([
  "shipmentPresentation",
	"electricalConfiguration",
  "size",
  "shape",
  "color",
  "capacity",
  "quantity",
  "pageCount",
  "pages",
  "pageStyle",
  "pageRange",
  "audienceAgeGroup",
  "audienceGenderFit",
  "fit",
  "deviceFit",
  "configuration",
  "boardConfiguration",
  "bundleOption",
  "frameIncluded",
  "fillIncluded",
  "embroideryFoam",
  "finish",
  "edgeTreatment",
  "paperType",
  "closure",
  "construction",
  "fabricWeightOz",
  "fabricOption",
  "thicknessType",
  "materialOption",
  "lidIncluded",
  "mugStyle",
  "designStyle",
  "animalType",
  "decorForm",
  "lampStyle",
  "liningOption",
  "printSides",
  "printMethod",
  "printTechnology",
  "printType",
  "printPosition",
  "printDecoration",
  "sizeRange",
  "scent",
  "shapeOption",
  "stoneType",
  "grindType",
  "substrateWeightGsm",
  "thicknessMm",
  "wrapDepthMm",
  "canvasStretchAllowance",
  "canvasBorderStyle",
]);

const COMPONENT_SCOPED_FIELDS = new Set([
  "trimConfiguration",
  "envelopeColor",
  "strawKit",
  "ribbonIncluded",
  "tasselColor",
  "borderColor",
  "ribbonOption",
  "leashIncluded",
  "storageBagColor",
  "shadeRingIncluded",

	"backboardIncluded",
  "frameProfile",
  "matIncluded",
  "hangingPinsIncluded",
  "frameAssemblyIncluded",
  "frameMaterial",
  "hangingHardware",
  "mountType",
  "standIncluded",
  "hardwareFinish",
]);

export const SELECTED_PROFILE_SEMANTIC_FIELDS = [
  "trimConfiguration",
  "strawKit",
  "ribbonIncluded",
  "tasselColor",
  "borderColor",
  "ribbonOption",
  "leashIncluded",
  "storageBagColor",
  "shadeRingIncluded",
  "shipmentPresentation",

	"electricalConfiguration",
	"backboardIncluded",
  "hangingPinsIncluded",
  "matIncluded",
  "frameAssemblyIncluded",
  "canvasStretchAllowance",
  "canvasBorderStyle",
  "embroideryFoam",
  "shape",
  "capacity",
  "quantity",
  "pageCount",
  "pages",
  "audienceAgeGroup",
  "audienceGenderFit",
  "fit",
  "deviceFit",
  "frameIncluded",
  "fillIncluded",
  "finish",
  "edgeTreatment",
  "paperType",
  "substrateWeightGsm",
  "wrapDepthMm",
  "printType",
  "closure",
  "construction",
] as const;

export function getProfileFactCardinalityPolicy(
  field: string
): ProfileFactCardinalityPolicy {
  if (PROFILE_SCOPED_FIELDS.has(field)) {
    return {
      cardinality: "profile-scoped",
      reason:
        "The value can change between sellable variants and must resolve from the selected profile.",
    };
  }
  if (COMPONENT_SCOPED_FIELDS.has(field)) {
    return {
      cardinality: "component-scoped",
      reason:
        "The value describes an owned component and is safe only when that component remains explicit.",
    };
  }
  if (PRODUCT_INVARIANT_FIELDS.has(field)) {
    return {
      cardinality: "product-invariant",
      reason:
        "The normalized field is expected to describe every sellable profile of the supplier product.",
    };
  }
  return {
    cardinality: "unresolved",
    reason:
      "No reviewed cardinality contract exists; comparison consumers must not infer product-wide union semantics.",
  };
}

export function fieldRequiresSelectedProfile(field: string): boolean {
  const cardinality = getProfileFactCardinalityPolicy(field).cardinality;
  return cardinality === "profile-scoped" || cardinality === "component-scoped";
}
