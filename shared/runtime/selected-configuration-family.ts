import { isTextValue } from "./text";
import { readUnknownRecord } from "../schemas/record";
import type {
  VariantPickerCategoryPolicy,
  VariantPickerDimension,
} from "./variant-picker-policy";
import type { RepresentativeOptionCategoryPolicy } from "./representative-option-policy";
import type { SelectedSourceVariantMatchingPolicy } from "./selected-source-variant-matching/types";

export type SelectedConfigurationClass = { type?: string; subtype?: string };

export function readSelectedConfigurationClass(specs: unknown): SelectedConfigurationClass | null {
  const record = readUnknownRecord(specs);
  return record && isTextValue(record.type) && isTextValue(record.subtype) ? { type: record.type, subtype: record.subtype } : null;
}

type Family = {
  id: string;
  version?: string;
  category: string;
  type: string;
  subtypes: readonly string[];
  dimensions: readonly VariantPickerDimension[];
  required?: readonly string[];
};
// Literal canonical class facts, not supplier labels or inferred title matches.
const FAMILIES: readonly Family[] = [
  {
    id: "satin-welcome-sign", category: "banners", type: "home-decor",
    subtypes: ["satin-wedding-welcome-banner"], dimensions: ["size", "ribbonOption"], required: ["size", "ribbonOption"],
  },
  {
    id: "card-envelope", category: "cards", type: "stationery",
    subtypes: ["greeting-card"], dimensions: ["size", "envelopeColor"],
  },
  {
    id: "pet-garment", category: "pet-apparel", type: "pet-products",
    subtypes: ["cotton-pet-recovery-suit", "cotton-pet-shirt", "dog-cooling-vest", "dog-raincoat", "fleece-pet-vest", "pet-bandana", "pet-hawaiian-shirt", "pet-hoodie", "polyester-mesh-dog-shirt", "stretch-dog-dress"], dimensions: ["size"], required: ["size"],
  },
  {
    id: "boot", category: "shoes", type: "accessories",
    subtypes: ["boot"], dimensions: ["size", "color"], required: ["size"],
  },
  {
    id: "animal-baby-blanket", category: "blankets", type: "home-decor",
    subtypes: ["hooded-baby-blanket", "security-blanket"], dimensions: ["size", "animalType"], required: ["animalType"],
  },
  {
    id: "shower-curtain", category: "bathroom", type: "home-decor",
    subtypes: ["shower-curtain"], dimensions: ["size", "hangingHardware"],
  },
  {
    id: "pencil-case", category: "office-supplies", type: "stationery",
    subtypes: ["pencil-case", "faux-leather-pencil-case"], dimensions: ["size", "color", "hardwareFinish"],
  },
  {
    id: "scarf", category: "personal-accessories", type: "accessories",
    subtypes: ["scarf"], dimensions: ["size", "tasselColor", "color"],
  },
  {
    id: "belt", category: "personal-accessories", type: "accessories",
    subtypes: ["belt"], dimensions: ["size", "color", "hardwareFinish"], required: ["size"],
  },
  {
    id: "soccer-shoes", category: "shoes", type: "accessories",
    version: "2026-11-03.1", subtypes: ["soccer-shoes"], dimensions: ["size", "color", "trimConfiguration"], required: ["size", "color"],
  },
  {
    id: "slipper-trim", category: "slippers", type: "accessories", version: "2026-11-03.1",
    subtypes: ["slipper"], dimensions: ["size", "color", "trimConfiguration"], required: ["size"],
  },
  {
    id: "handheld-console-case", category: "tech", type: "accessories",
    subtypes: ["eva-handheld-console-carry-case"], dimensions: ["deviceFit", "size", "color"],
  },
  {
    id: "flying-disc", category: "sports-accessories", type: "accessories",
    subtypes: ["flying-disc"], dimensions: ["size", "quantity", "color"],
  },
  {
    id: "framed-puzzle-kit", category: "puzzles", type: "accessories",
    subtypes: ["framed-jigsaw-puzzle-set"], dimensions: ["finish"],
  },
  {
    id: "graduation-stole", category: "personal-accessories", type: "apparel",
    version: "2026-11-06.1", subtypes: ["stole"], dimensions: ["size", "construction"],
  },
  // Measured sizes (width × height with a unit) shared across suppliers; Nov 6.
  {
    id: "car-magnet", category: "magnets", type: "accessories", version: "2026-11-06.1",
    subtypes: ["car-magnet"], dimensions: ["size"], required: ["size"],
  },
  {
    id: "die-cut-magnet", category: "magnets", type: "accessories", version: "2026-11-06.1",
    subtypes: ["magnet-die-cut"], dimensions: ["size"], required: ["size"],
  },
  {
    id: "desk-mat", category: "mouse-pads", type: "accessories", version: "2026-11-06.1",
    subtypes: ["desk-mat"], dimensions: ["size"], required: ["size"],
  },
  // Nov 7: options the unpickable-options health check found, now normalized.
  { id: "patch", category: "patches", type: "accessories", version: "2026-11-07.1", subtypes: ["patch"], dimensions: ["shape", "size"], required: ["size"] },
  { id: "pet-feeding-mat", category: "pet-products", type: "pet-products", version: "2026-11-07.1", subtypes: ["feeding-mat"], dimensions: ["shape", "size"], required: ["size"] },
  { id: "jigsaw-puzzle", category: "puzzles", type: "accessories", version: "2026-11-07.1", subtypes: ["jigsaw-puzzle"], dimensions: ["size"], required: ["size"] },
  { id: "work-pants", category: "pants", type: "apparel", version: "2026-11-07.1", subtypes: ["pants"], dimensions: ["size", "color"], required: ["size"] },
  { id: "car-floor-mat", category: "car-accessories", type: "accessories", version: "2026-11-07.1", subtypes: ["car-floor-mat"], dimensions: ["size"], required: ["size"] },
  { id: "duffel-bag", category: "duffel-bags", type: "bags", version: "2026-11-07.1", subtypes: ["duffel-bag"], dimensions: ["size", "color"], required: ["size"] },
  { id: "suitcase", category: "luggage", type: "bags", version: "2026-11-07.1", subtypes: ["suitcase"], dimensions: ["size", "color"], required: ["size"] },
  { id: "sports-headband", category: "sports-accessories", type: "accessories", version: "2026-11-07.1", subtypes: ["headband"], dimensions: ["size"], required: ["size"] },
  { id: "hair-headband", category: "hair-accessories", type: "accessories", version: "2026-11-07.1", subtypes: ["headband"], dimensions: ["size"], required: ["size"] },
  { id: "jewelry-ring", category: "jewelry", type: "accessories", version: "2026-11-07.1", subtypes: ["jewelry-ring"], dimensions: ["size"], required: ["size"] },
  { id: "round-pin-magnet", category: "pins", type: "accessories", version: "2026-11-07.1", subtypes: ["magnet"], dimensions: ["size"], required: ["size"] },
  {
    id: "watch-band",
    category: "watch-bands",
    type: "accessories",
    subtypes: ["watch-band"],
    dimensions: ["deviceFit", "color"],
    required: ["deviceFit"],
  },
  {
    id: "earphone-case",
    category: "earphone-cases",
    type: "accessories",
    subtypes: ["earphone-case"],
    dimensions: ["deviceFit", "color"],
    required: ["deviceFit"],
  },
  {
    id: "gift-bag",
    category: "bags",
    type: "bags",
    subtypes: ["gift-bag", "clear-pvc-gift-bag"],
    dimensions: ["size", "ribbonOption"],
    required: ["size"],
  },
  {
    id: "poker-playmat",
    category: "toys",
    type: "accessories",
    subtypes: ["poker-table-playmat"],
    dimensions: ["size", "shipmentPresentation"],
    required: ["size"],
  },
  {
    id: "halloween-witch-hat",
    category: "hats",
    type: "headwear",
    subtypes: ["halloween-witch-hat"],
    dimensions: ["quantity"],
  },
  {
    id: "mahjong-tiles",
    category: "toys",
    type: "accessories",
    subtypes: ["mahjong-tiles"],
    dimensions: ["bundleOption", "color"],
  },
  {
    id: "mahjong-mat",
    category: "sports-accessories",
    type: "accessories",
    subtypes: ["mahjong-table-mat"],
    dimensions: [
      "size",
      "thicknessMm",
      "storageBagColor",
      "shipmentPresentation",
    ],
  },
  {
    id: "lamp-shade",
    category: "home-decor",
    type: "accessories",
    subtypes: [
      "arc-floor-lampshade",
      "upright-floor-lampshade",
      "tripod-floor-lampshade",
      "shelf-floor-lampshade",
    ],
    dimensions: ["shadeRingIncluded", "finish", "quantity"],
  },
  {
    id: "fabric-pet-harness",
    category: "pet-products",
    type: "pet-products",
    subtypes: ["fabric-pet-harness"],
    dimensions: ["size", "leashIncluded"],
    required: ["size"],
  },
  {
    id: "guitar-pick",
    category: "accessories",
    type: "accessories",
    subtypes: ["guitar-pick"],
    dimensions: ["thicknessMm"],
  },
  // Complete source profile proof: exact/equivalent self-match, no cheaper different-selection substitution.
  // Evidence: scraper/state/printkk/profile-readiness/picker-policy-inventory/family-proof.json.
  {"id": "catalog-accessories-ffe644c3", "category": "accessories", "type": "accessories", "subtypes": ["luggage-cover", "tablet-case"], "dimensions": ["size"], "required": ["size"]},
  {"id": "catalog-activewear-eef06750", "category": "apparel", "type": "apparel", "subtypes": ["cheerleading-set", "romper"], "dimensions": ["size"], "required": ["size"]},
  {"id": "catalog-apparel-04458145", "category": "apparel", "type": "apparel", "subtypes": ["jumpsuit", "top-skirt-set", "cape"], "dimensions": ["size"], "required": ["size"]},
  {"id": "catalog-apparel-e85853b1", "category": "apparel", "type": "apparel", "subtypes": ["youth-hooded-cloak"], "dimensions": ["size"], "required": ["size"]},
  {"id": "catalog-aprons-84a9444d", "category": "aprons", "type": "apparel", "subtypes": ["cross-back-apron", "youth-canvas-cross-back-apron"], "dimensions": ["size", "color"], "required": ["size"]},
  {"id": "catalog-backpacks-0738aaa1", "category": "backpacks", "type": "bags", "subtypes": ["canvas-backpack"], "dimensions": ["size"], "required": ["size"]},
  {"id": "catalog-bags-9563de5b", "category": "bags", "type": "bags", "subtypes": ["padded-laptop-shoulder-bag"], "dimensions": ["size"], "required": ["size"]},
  {"id": "catalog-bags-fa6ce270", "category": "bags", "type": "bags", "subtypes": ["cosmetic-bag", "garden-tool-bag"], "dimensions": ["size", "color"], "required": ["size"]},
  {"id": "catalog-bags-791071e8", "category": "bags", "type": "bags", "subtypes": ["laundry-bag"], "dimensions": ["size", "quantity"], "required": []},
  {"id": "catalog-bathroom-6fd47e3f", "category": "bathroom", "type": "home-decor", "subtypes": ["diatomaceous-absorbent-mat"], "dimensions": ["size"], "required": ["size"]},
  {"id": "catalog-button-up-shirts-3191b686", "category": "button-up-shirts", "type": "apparel", "subtypes": ["hawaiian-shirt", "button-shirt", "blouse"], "dimensions": ["size"], "required": ["size"]},
  {"id": "catalog-car-accessories-f7fbb1b1", "category": "car-accessories", "type": "accessories", "subtypes": ["metal-car-hanging-charm"], "dimensions": ["hardwareFinish", "size"], "required": ["size"]},
  {"id": "catalog-car-accessories-364bd891", "category": "car-accessories", "type": "accessories", "subtypes": ["car-air-freshener"], "dimensions": ["scent", "size"], "required": []},
  {"id": "catalog-car-accessories-4e300a63", "category": "car-accessories", "type": "accessories", "subtypes": ["stretch-car-hood-cover", "car-sun-shade", "fabric-spare-tire-cover"], "dimensions": ["size"], "required": ["size"]},
  {"id": "catalog-car-accessories-09ef0582", "category": "car-accessories", "type": "accessories", "subtypes": ["car-seat-cover"], "dimensions": ["size", "quantity"], "required": []},
  {"id": "catalog-coolers-ad3f62c8", "category": "coolers", "type": "bags", "subtypes": ["wine-bag"], "dimensions": ["size", "color"], "required": ["size"]},
  {"id": "catalog-crossbody-sling-bags-3ea1f7ab", "category": "crossbody-sling-bags", "type": "bags", "subtypes": ["crossbody-bag", "faux-leather-crossbody-bag"], "dimensions": ["size", "color"], "required": ["size"]},
  {"id": "catalog-drawstring-bags-83d00a66", "category": "drawstring-bags", "type": "bags", "subtypes": ["drawstring-bag"], "dimensions": ["size"], "required": ["size"]},
  {"id": "catalog-dresses-6f49812d", "category": "dresses", "type": "apparel", "subtypes": ["skater-dress", "dress", "blazer-dress", "bodycon-dress", "t-shirt-dress"], "dimensions": ["size"], "required": ["size"]},
  {"id": "catalog-jerseys-93d850fd", "category": "jerseys", "type": "apparel", "subtypes": ["soccer-jersey", "jersey", "basketball-jersey", "jersey-short-set"], "dimensions": ["size"], "required": ["size"]},
  {"id": "catalog-jewelry-5ab24987", "category": "jewelry", "type": "accessories", "subtypes": ["photo-cuban-link-bracelet", "rhinestone-photo-pendant-necklace"], "dimensions": ["hardwareFinish", "size"], "required": ["size"]},
  {"id": "catalog-jewelry-bce85033", "category": "jewelry", "type": "accessories", "subtypes": ["jewelry-cufflinks"], "dimensions": ["size"], "required": ["size"]},
  {"id": "catalog-keychains-0b3dc89f", "category": "keychains", "type": "accessories", "subtypes": ["keychain"], "dimensions": ["size"], "required": ["size"]},
  {"id": "catalog-laptop-sleeves-46085f14", "category": "laptop-sleeves", "type": "bags", "subtypes": ["laptop-sleeve"], "dimensions": ["size"], "required": ["size"]},
  {"id": "catalog-leggings-3ddb4e24", "category": "leggings", "type": "apparel", "subtypes": ["leggings", "flare-leggings"], "dimensions": ["size"], "required": ["size"]},
  {"id": "catalog-luggage-cd368aa4", "category": "accessories", "type": "accessories", "subtypes": ["luggage-tag"], "dimensions": ["size", "quantity"], "required": []},
  {"id": "catalog-lunch-bags-fb39efda", "category": "lunch-bags", "type": "bags", "subtypes": ["lunch-bag"], "dimensions": ["size", "color"], "required": ["size"]},
  {"id": "catalog-magnets-e250208a", "category": "magnets", "type": "home-decor", "subtypes": ["acrylic-fridge-magnet"], "dimensions": ["size"], "required": ["size"]},
  {"id": "catalog-mouse-pads-8fa8d6e6", "version": "2026-11-07.1", "category": "mouse-pads", "type": "accessories", "subtypes": ["mouse-pad"], "dimensions": ["size", "shape", "quantity"], "required": []},
  {"id": "catalog-office-supplies-e3d02102", "category": "office-supplies", "type": "accessories", "subtypes": ["acrylic-badge-reel"], "dimensions": ["size"], "required": ["size"]},
  {"id": "catalog-office-supplies-ce9c8b6d", "category": "office-supplies", "type": "bags", "subtypes": ["mesh-zipper-document-pouch"], "dimensions": ["size", "color"], "required": ["size"]},
  {"id": "catalog-office-supplies-171c1fda", "category": "office-supplies", "type": "home-decor", "subtypes": ["acrylic-pen-holder"], "dimensions": ["size"], "required": ["size"]},
  {"id": "catalog-office-supplies-301c47b5", "category": "office-supplies", "type": "stationery", "subtypes": ["metal-bookmark"], "dimensions": ["size"], "required": ["size"]},
  {"id": "catalog-office-supplies-231fe27f", "category": "office-supplies", "type": "stationery", "subtypes": ["wooden-bookmark"], "dimensions": ["size", "color"], "required": ["size"]},
  {"id": "catalog-pants-11487e68", "category": "pants", "type": "apparel", "subtypes": ["wide-leg-pants"], "dimensions": ["size"], "required": ["size"]},
  {"id": "catalog-party-supplies-0d97a54c", "category": "party-supplies", "type": "home-decor", "subtypes": ["photo-face-cutout-stick"], "dimensions": ["size"], "required": ["size"]},
  {"id": "catalog-personal-accessories-562a5b4b", "category": "personal-accessories", "type": "accessories", "subtypes": ["bandana", "cold-therapy-foot-sleeve"], "dimensions": ["size"], "required": ["size"]},
  {"id": "catalog-personal-accessories-639f602f", "category": "personal-accessories", "type": "accessories", "subtypes": ["led-compact-makeup-mirror"], "dimensions": ["size", "color"], "required": ["size"]},
  {"id": "catalog-personal-accessories-a767b513", "category": "personal-accessories", "type": "bags", "subtypes": ["protective-eyeglass-pouch"], "dimensions": ["size"], "required": ["size"]},
  {"id": "catalog-personal-accessories-feffe2d9", "category": "personal-accessories", "type": "bags", "subtypes": ["aluminum-rfid-card-wallet"], "dimensions": ["size", "color"], "required": ["size"]},
  {"id": "catalog-personal-accessories-ef72686d", "category": "personal-accessories", "type": "home-decor", "subtypes": ["fabric-sleep-mask"], "dimensions": ["size", "color"], "required": ["size"]},
  {"id": "catalog-pet-products-d86cf9eb", "category": "pet-products", "type": "accessories", "subtypes": ["dog-car-seat-protector"], "dimensions": ["size"], "required": ["size"]},
  {"id": "catalog-pet-products-48fd1f21", "category": "pet-products", "type": "pet-products", "subtypes": ["heated-pet-pad"], "dimensions": ["electricalConfiguration"], "required": ["electricalConfiguration"]},
  {"id": "catalog-pet-products-8395c64a", "category": "pet-products", "type": "pet-products", "subtypes": ["pet-feeding-mat", "cat-grooming-wrap", "dog-ear-wrap", "plastic-dog-fetch-disc", "polyester-pet-blanket", "fabric-pet-hammock"], "dimensions": ["size"], "required": ["size"]},
  {"id": "catalog-pet-products-993d724b", "category": "pet-products", "type": "pet-products", "subtypes": ["pet-tag", "pet-bandana", "soft-pet-recovery-collar"], "dimensions": ["size", "color"], "required": ["size"]},
  {"id": "catalog-pins-43a54859", "version": "2026-11-07.1", "category": "pins", "type": "accessories", "subtypes": ["pin-button"], "dimensions": ["size", "quantity"], "required": ["size"]},
  {"id": "catalog-sandals-e11354b1", "category": "sandals", "type": "accessories", "subtypes": ["sandal"], "dimensions": ["size"], "required": ["size"]},
  {"id": "catalog-seasonal-26885423", "category": "bags", "type": "bags", "subtypes": ["gift-sack"], "dimensions": ["size"], "required": ["size"]},
  {"id": "catalog-seasonal-b8dc3223", "category": "home-decor", "type": "home-decor", "subtypes": ["porch-goose-costume"], "dimensions": ["decorForm"], "required": []},
  {"id": "catalog-seasonal-50fd1ce9", "category": "bags", "type": "bags", "subtypes": ["fabric-halloween-candy-basket"], "dimensions": ["size", "color"], "required": ["size"]},
  {"id": "catalog-shoes-6257a1fc", "category": "shoes", "type": "accessories", "subtypes": ["clog"], "dimensions": ["size"], "required": ["size"]},
  {"id": "catalog-shoes-64bcda6a", "category": "shoes", "type": "accessories", "subtypes": ["sneaker"], "dimensions": ["size", "color"], "required": ["size"]},
  {"id": "catalog-shorts-709a5d9f", "category": "shorts", "type": "apparel", "subtypes": ["compression-shorts", "bike-shorts"], "dimensions": ["size"], "required": ["size"]},
  {"id": "catalog-shorts-604f5a5b", "category": "shorts", "type": "apparel", "subtypes": ["shorts"], "dimensions": ["size", "color"], "required": ["size"]},
  {"id": "catalog-skirts-7de5d1ec", "category": "skirts", "type": "apparel", "subtypes": ["skort", "skirt"], "dimensions": ["size"], "required": ["size"]},
  {"id": "catalog-sleepwear-345b1a71", "category": "sleepwear", "type": "apparel", "subtypes": ["sleep-sack", "nightgown", "pajamas", "pajama-pants", "pajama-shorts"], "dimensions": ["size"], "required": ["size"]},
  {"id": "catalog-socks-6ae2d5bf", "version": "2026-11-03.1", "category": "socks", "type": "apparel", "subtypes": ["socks"], "dimensions": ["size", "color", "trimConfiguration"], "required": ["size"]},
  {"id": "catalog-sports-accessories-1d883919", "category": "sports-accessories", "type": "accessories", "subtypes": ["basketball"], "dimensions": ["size"], "required": ["size"]},
  {"id": "catalog-sports-accessories-aed89869", "category": "sports-accessories", "type": "accessories", "subtypes": ["pickleball-paddle"], "dimensions": ["size", "color"], "required": ["size"]},
  {"id": "catalog-sports-accessories-fc8fd7b3", "category": "sports-accessories", "type": "apparel", "subtypes": ["arm-sleeve"], "dimensions": ["size"], "required": ["size"]},
  {"id": "catalog-sports-accessories-b1e805c8", "category": "sports-accessories", "type": "bags", "subtypes": ["faux-leather-golf-ball-pouch"], "dimensions": ["size", "color"], "required": ["size"]},
  {"id": "catalog-sports-accessories-22a88d18", "category": "sports-accessories", "type": "home-decor", "subtypes": ["fiberglass-pickleball-paddle-set"], "dimensions": ["size", "color"], "required": ["size"]},
  {"id": "catalog-sports-bras-c8df059b", "category": "sports-bras", "type": "apparel", "subtypes": ["sports-bra"], "dimensions": ["size"], "required": ["size"]},
  {"id": "catalog-sweaters-4d192e52", "category": "sweaters", "type": "apparel", "subtypes": ["sweater", "kimono-cardigan", "cardigan"], "dimensions": ["size"], "required": ["size"]},
  {"id": "catalog-swimwear-cb2445fa", "category": "swimwear", "type": "apparel", "subtypes": ["bikini", "swim-cover-up", "two-piece-swimsuit", "swimsuit", "one-piece-swimsuit", "rash-guard", "sarong"], "dimensions": ["size"], "required": ["size"]},
  {"id": "catalog-swimwear-3e45a242", "category": "swimwear", "type": "apparel", "subtypes": ["swim-trunks"], "dimensions": ["size", "color"], "required": ["size"]},
  {"id": "catalog-tableware-187beae7", "category": "tableware", "type": "accessories", "subtypes": ["stirrer"], "dimensions": ["size"], "required": ["size"]},
  {"id": "catalog-tableware-d8406db2", "category": "tableware", "type": "home-decor", "subtypes": ["tablecloth", "ceramic-decorative-plate"], "dimensions": ["size"], "required": ["size"]},
  {"id": "catalog-tableware-c8840d0f", "category": "tableware", "type": "home-decor", "subtypes": ["placemat"], "dimensions": ["size", "quantity"], "required": []},
  {"id": "catalog-tableware-eaa66455", "category": "tableware", "type": "home-decor", "subtypes": ["diatomaceous-earth-coaster", "napkin"], "dimensions": ["size", "quantity"], "required": ["size", "quantity"]},
  {"id": "catalog-tableware-50540471", "category": "tableware", "type": "home-decor", "subtypes": ["picnic-table-bench-cover-set"], "dimensions": ["size", "quantity"], "required": ["size"]},
  {"id": "catalog-tank-tops-7f29fb93", "category": "tank-tops", "type": "apparel", "subtypes": ["tube-top"], "dimensions": ["size"], "required": ["size"]},
  {"id": "catalog-tank-tops-0dfcb6f0", "category": "tank-tops", "type": "apparel", "subtypes": ["tank-top"], "dimensions": ["size", "color"], "required": ["size"]},
  {"id": "catalog-tech-491060df", "category": "tech", "type": "accessories", "subtypes": ["phone-stand"], "dimensions": ["size", "color"], "required": ["size"]},
  {"id": "catalog-tote-bags-43710593", "category": "tote-bags", "type": "bags", "subtypes": ["tote-bag", "faux-leather-tote-pouch-set", "faux-leather-tote-bag"], "dimensions": ["size", "color"], "required": ["size"]},
  {"id": "catalog-toys-ae5bf920", "category": "toys", "type": "accessories", "subtypes": ["faux-leather-dice-tray"], "dimensions": ["size"], "required": ["size"]},
  {"id": "catalog-underwear-8fb61e87", "category": "underwear", "type": "apparel", "subtypes": ["thong", "bralette"], "dimensions": ["size"], "required": ["size"]},
  {"id": "catalog-underwear-381a6e4f", "category": "underwear", "type": "apparel", "subtypes": ["briefs", "boxer-briefs", "underwear"], "dimensions": ["size", "color"], "required": ["size"]},
  {"id": "catalog-vests-cb799021", "category": "vests", "type": "apparel", "subtypes": ["fleece-vest", "suit-vest"], "dimensions": ["size"], "required": ["size"]},
  {"id": "catalog-vests-18561192", "category": "vests", "type": "apparel", "subtypes": ["reflective-safety-vest"], "dimensions": ["size", "color"], "required": ["size"]},
  {"id": "catalog-visors-ef1a59e1", "category": "visors", "type": "headwear", "subtypes": ["visor"], "dimensions": ["size", "color"], "required": ["size"]},
  {"id": "catalog-wall-tapestries-4a61d55b", "category": "wall-tapestries", "type": "home-decor", "subtypes": ["tapestry"], "dimensions": ["size"], "required": ["size"]},
];
const BUNDLES = FAMILIES.map(family => ({
  family,
  picker: {
    id: `family-${family.id}`,
    label: family.id,
    specType: family.type,
    categorySlugs: [family.category],
    dimensions: family.dimensions,
  } satisfies VariantPickerCategoryPolicy,
  representative: {
    id: `family-${family.id}-representative`,
    version: family.version ?? "2026-11-02.1",
    categorySlugs: [family.category],
    readiness: { status: "ready" },
    axes: family.dimensions.map(field => ({
      field,
      requirement: family.required?.includes(field)
        ? "required"
        : "when-selectable",
      equivalence: "exact",
    })),
    minimumTupleAxisCount: 0,
    stableTupleOrder: family.dimensions,
    implicitDefaultExclusions: [],
  } satisfies RepresentativeOptionCategoryPolicy,
  matching: {
    id: `family-${family.id}-selected-source`,
    version: family.version ?? "2026-11-02.1",
    categorySlugs: [family.category],
    fields: family.dimensions.map(field => ({
      field,
      role: family.required?.includes(field) ? "required" : "conditional",
      fallback: "none",
    })),
  } satisfies SelectedSourceVariantMatchingPolicy,
}));

export function resolveSelectedConfigurationFamily(
  categorySlug: string,
  specs: SelectedConfigurationClass | null | undefined
): (typeof BUNDLES)[number] | null {
  const record = specs;
  return (
    BUNDLES.find(
      ({ family }) =>
        family.category === categorySlug &&
        family.type === record?.type &&
        family.subtypes.some(subtype => subtype === record?.subtype)
    ) ?? null
  );
}

/** Resolve only a known recorded family policy, with category and version checks at the caller. */
export function getRecordedFamilyRepresentativePolicy(
  categorySlug: string,
  policyId: string
): RepresentativeOptionCategoryPolicy | null {
  return (
    BUNDLES.find(
      bundle =>
        bundle.family.category === categorySlug &&
        bundle.representative.id === policyId
    )?.representative ?? null
  );
}

export function getRecordedSelectedConfigurationFamily(
  categorySlug: string,
  representativePolicyId: string
) {
  return (
    BUNDLES.find(
      bundle =>
        bundle.family.category === categorySlug &&
        bundle.representative.id === representativePolicyId
    ) ?? null
  );
}

export function getRecordedFamilyMatchingPolicy(
  policyId: string
): SelectedSourceVariantMatchingPolicy | null {
  return (
    BUNDLES.find(bundle => bundle.matching.id === policyId)?.matching ?? null
  );
}
