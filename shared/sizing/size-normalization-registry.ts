import { PRINTKK_REVIEWED_SIZE_SELECTORS } from "../data/printkk-size-selectors";
import { createClosedStringLookup } from "../kernel/closed-string-lookup";
import type { ReviewedSizeEquivalencePolicySlice } from "./size-equivalence-policy";

export const DIMENSIONAL_SIZE_NORMALIZATION_CATEGORIES = [
	"posters",
	"canvas-prints",
	"metal-prints",
	"acrylic-prints",
	"framed-prints",
	"wood-prints",
	"photo-tiles",
	"wall-art",
] as const;

const ACTIVE_SIZE_NORMALIZATION_CLASSES = [
	"apparel",
	"capacity",
	"device-fit",
	"footwear",
	"home-stationery",
	"pet",
] as const;

type ActiveSizeNormalizationClass =
	(typeof ACTIVE_SIZE_NORMALIZATION_CLASSES)[number];

const DEFERRED_SIZE_NORMALIZATION_BUCKETS = [
	"footwear-audit-only",
	"pack-count-deferred",
] as const;

type DeferredSizeNormalizationBucket =
	(typeof DEFERRED_SIZE_NORMALIZATION_BUCKETS)[number];

export type SizeNormalizationNamespace = ActiveSizeNormalizationClass | "wall-art";

export type SizeNormalizationResolverInput =
	| string
	| {
			readonly categorySlug?: string | null;
			readonly specType?: string | null;
			readonly supplierId?: string | null;
			readonly productId?: string | null;
			readonly productName?: string | null;
			readonly audienceAgeGroup?: string | null;
	  }
	| null
	| undefined;

type ProductScopedSizeNormalizationRule = {
	readonly supplierId: string;
	readonly model: string;
	readonly sourceUrl: string;
	readonly supportedLabels: readonly string[];
	/** Opaque, reviewed selector tokens; absence keeps the existing nominal-label encoding. */
	readonly labelTokens?: Readonly<Record<string, string>>;
};

const APLIIQ_UNSTATED_KIDS_SIZES = ["2", "4"] as const;

// Reviewed selector identities, not category-wide aliases or fit equivalence.
// Evidence: docs/reports/2026-10-22-inkthreadable-option-normalization.md.
// NN500's guide does not explicitly bind [L] to an inseam. Plain waist labels
// on bottoms ("30") now share apparel:waist tokens (variant-size-normalization).
// Product aliases that change the size token's class (adult-tall, device fit)
// are reviewed in reviewed-product-size-aliases.ts, not here.
export const PRODUCT_SCOPED_SIZE_NORMALIZATION_RULES = {
  // Nov 6, 2026: single-listing selectors the unpickable-options health check
  // found (nominal bag/accessory letters, regular-length shirt sizes, women's
  // numeric trousers, ring sizes, mat and can variants). Choice identity only.
  "printify:4073": {
    supplierId: "printify", model: "CS20",
    sourceUrl: "https://printify.com/app/products/4073/red-kap/short-sleeve-striped-industrial-work-shirt",
    supportedLabels: ["SR", "MR", "LR", "XLR", "2XLR", "3XLR", "4XLR"],
  },
  "printify:5472": {
    supplierId: "printify", model: "MM4001",
    sourceUrl: "https://printify.com/app/products/5472/mercer-mettletm/womens-trousers",
    supportedLabels: ["0", "2", "4", "6", "8", "10", "12", "14", "16", "18", "20"],
  },
  "printify:1630": {
    supplierId: "printify", model: "1630",
    sourceUrl: "https://printify.com/app/products/1630/generic-brand/bible-cover",
    supportedLabels: ["M", "L", "XL", "2XL"],
  },
  "printify:356": {
    supplierId: "printify", model: "356",
    sourceUrl: "https://printify.com/app/products/356/generic-brand/accessory-pouch",
    supportedLabels: ["Small", "Large"],
  },
  "printify:357": {
    supplierId: "printify", model: "357",
    sourceUrl: "https://printify.com/app/products/357/generic-brand/accessory-pouch-w-t-bottom",
    supportedLabels: ["Small", "Large"],
  },
  "printify:372": {
    supplierId: "printify", model: "372",
    sourceUrl: "https://printify.com/app/products/372/generic-brand/duffel-bag",
    supportedLabels: ["Small", "Large"],
  },
  "printful:891": {
    supplierId: "printful", model: "891",
    sourceUrl: "https://www.printful.com/custom/bags/personalized/suitcase",
    supportedLabels: ["Small", "Medium", "Large"],
  },
  "printify:957": {
    supplierId: "printify", model: "957",
    sourceUrl: "https://printify.com/app/products/957/generic-brand/car-floor-mats-1pc",
    supportedLabels: ["Front mat", "Rear mat"],
  },
  "printify:1411": {
    supplierId: "printify", model: "1411",
    sourceUrl: "https://printify.com/app/products/1411/generic-brand/car-sun-shades",
    supportedLabels: ["28'' × 28'' (2pcs)", "30'' × 55'' (1pc)"],
  },
  "printify:951": {
    supplierId: "printify", model: "951",
    sourceUrl: "https://printify.com/app/products/951/generic-brand/can-cooler",
    supportedLabels: ["Regular Can", "Slim Can"],
  },
  "printful:350": {
    supplierId: "printful", model: "350",
    sourceUrl: "https://www.printful.com/custom/bags/fanny-packs/all-over-print-fanny-pack",
    supportedLabels: ["S/M", "M/L"],
  },
  "fourthwall:pro_22456d0504af4ae38f": {
    supplierId: "fourthwall", model: "605",
    sourceUrl: "https://fourthwall.com/products/all-over-print-fanny-pack-all-over-print",
    supportedLabels: ["S/M", "M/L"],
  },
  "printful:545": {
    supplierId: "printful", model: "545",
    sourceUrl: "https://www.printful.com/custom/hair-accessories/personalized/all-over-print-headband",
    supportedLabels: ["M", "L"],
  },
  "fourthwall:pro_6df4f9b3f9214e08ac": {
    supplierId: "fourthwall", model: "654",
    sourceUrl: "https://fourthwall.com/products/all-over-print-headband",
    supportedLabels: ["M", "L"],
  },
  "printful:630": {
    supplierId: "printful", model: "630",
    sourceUrl: "https://www.printful.com/custom/hair-accessories/personalized/all-over-print-bandana",
    supportedLabels: ["S", "M", "L"],
  },
  "fourthwall:pro_7n9yvqibssavluovj3vafq": {
    supplierId: "fourthwall", model: "655",
    sourceUrl: "https://fourthwall.com/products/all-over-print-bandana",
    supportedLabels: ["S", "M", "L"],
  },
  "printify:10689": {
    supplierId: "printify", model: "10689",
    sourceUrl: "https://printify.com/app/products/10689/generic-brand/unisex-arm-sleeve",
    supportedLabels: ["S/M", "L/XL"],
  },
  "fourthwall:pro_367": {
    supplierId: "fourthwall", model: "EC8000",
    sourceUrl: "https://fourthwall.com/products/econscious-eco-friendly-tote-bag",
    supportedLabels: ["One Size"],
  },
  "printify:365": {
    supplierId: "printify", model: "365",
    sourceUrl: "https://printify.com/app/products/365/generic-brand/crew-socks",
    supportedLabels: ["Ankle", "3/4 Crew", "Crew"],
  },
  // SKUs PIN-BDG-SML* and PIN-BDG-LRG*; Prodigi labels the large badge "l" or
  // "large" depending on the pack size, so both are one size.
  "prodigi:pin-badges": {
    supplierId: "prodigi", model: "PIN-BDG",
    sourceUrl: "https://www.prodigi.com/products/accessories/patches-and-badges/pin-badges/",
    supportedLabels: ["s", "l", "large"],
    labelTokens: { s: "small", l: "large", large: "large" },
  },
  "printify:2943": {
    supplierId: "printify", model: "2943",
    sourceUrl: "https://printify.com/app/products/2943/generic-brand/stainless-steel-square-signet-ring-engraving",
    supportedLabels: ["6", "7", "8"],
  },
  "printify:2944": {
    supplierId: "printify", model: "2944",
    sourceUrl: "https://printify.com/app/products/2944/generic-brand/stainless-steel-heart-signet-ring-engraving",
    supportedLabels: ["6", "7", "8"],
  },
  "printkk:keyv8e": {
    supplierId: "printkk", model: "KEYV8E",
    sourceUrl: "https://www.printkk.com/product/info/floor-lamp-with-shelves-made-in-usa",
    supportedLabels: ["One Size"],
  },
  "printkk:wjm82": {
    supplierId: "printkk", model: "WJM82",
    sourceUrl: "https://www.printkk.com/product/info/christmas-gift-bag",
    supportedLabels: ["S", "M"],
  },
  "printkk:sx81vt": {
    supplierId: "printkk", model: "SX81VT",
    sourceUrl: "https://www.printkk.com/product/info/clear-pvc-gift-bags-with-handle",
    supportedLabels: ["20x20cm", "28x28cm"],
  },
  "printkk:7stpmv": {
    supplierId: "printkk", model: "7STPMV",
    sourceUrl: "https://www.printkk.com/product/info/poker-table-top",
    supportedLabels: ['47"x24"'],
  },
  // Single quoted side lengths do not prove a second dimension or a shared format.
  "printkk:ac8b54": {
    supplierId: "printkk",
    model: "AC8B54",
    sourceUrl:
      "https://www.printkk.com/product/info/mahjong-mat-ship-rolled-up",
    supportedLabels: ["34in", "42in"],
  },
  "printkk:ghxrjb": {
    supplierId: "printkk",
    model: "GHXRJB",
    sourceUrl: "https://www.printkk.com/product/info/round-mahjong-mat",
    supportedLabels: ["34in", "42in"],
  },
  "printkk:n9y41": {
    supplierId: "printkk",
    model: "N9Y41",
    sourceUrl:
      "https://www.printkk.com/product/info/dog-harness-with-accessories",
    supportedLabels: ["S", "M", "L", "XL"],
  },

	// Preserve both halves of the 5000B/JC007J selectors: neither establishes
	// literal years. JH030J's reviewed manufacturer aliases live in
	// reviewed-product-size-aliases.ts instead.
	"inkthreadable:44191886": {
		supplierId: "inkthreadable",
		model: "GD05B",
		sourceUrl: "https://www.inkthreadable.co.uk/gildan-heavy-youth-t-shirt",
		supportedLabels: ["XS / 3-4", "S / 5-6", "M / 7-8", "L / 9-11", "XL / 12-13"],
	},
	"inkthreadable:46738422": {
		supplierId: "inkthreadable",
		model: "JC07J",
		sourceUrl: "https://www.inkthreadable.co.uk/awdis-just-cool-kids-cool-vest",
		supportedLabels: ["XS / 3-4", "S / 5-6", "M / 7-8", "L / 9-11", "XL / 12-13"],
	},
	// The exact BC615 tab states this adjustable range. Preserve the full label
	// without introducing a shared headwear range or One Size equivalence.
	"inkthreadable:25419090": {
		supplierId: "inkthreadable",
		model: "BC615",
		sourceUrl: "https://www.inkthreadable.co.uk/youth-cotton-rapper-snapback-cap-2",
		supportedLabels: ["Adjustable youth sizing (53 - 58cm)"],
	},
	"inkthreadable:49779649": {
		supplierId: "inkthreadable",
		model: "NN500",
		sourceUrl: "https://www.inkthreadable.co.uk/onna-relentless-stretch-cargo-pants",
		supportedLabels: [
			"Small [L]", "Medium [L]", "Large [L]", "X-Large [L]", "2X-Large [L]", "3X-Large [L]",
		],
	},
	"inkthreadable:45960862": {
		supplierId: "inkthreadable",
		model: "BG882",
		sourceUrl: "https://www.inkthreadable.co.uk/sundae-accessory-case",
		supportedLabels: ["M", "L"],
	},
	"inkthreadable:47987250": {
		supplierId: "inkthreadable",
		model: "W544",
		sourceUrl: "https://www.inkthreadable.co.uk/dipped-base-canvas-accessory-bag",
		supportedLabels: ["M", "L"],
	},
	"inkthreadable:25682268": {
		supplierId: "inkthreadable",
		model: "TR085",
		sourceUrl: "https://www.inkthreadable.co.uk/womens-cropped-oversized-hoodie",
		supportedLabels: ["S/M", "L/XL"],
	},
	// Apliiq's retained SizeOptions are bare supplier labels with no unit. Each
	// rule lists only labels the shared normalizers leave unresolved, so kids
	// "6"/"8" years, "2 toddler", alpha sizes and LT/XLT keep their shared tokens.
	// Bare 30-40 are nominal waists, not inches or alpha fit.
	// Kids "2" and "4" are not stated as years or toddler sizes, so only the
	// literal selector is kept.
	"apliiq:1112": {
		supplierId: "apliiq",
		model: "3007",
		sourceUrl: "https://www.apliiq.com/customize/kids-babies/long-sleeves/KIDS-STAPLE-L-S-TEE",
		supportedLabels: APLIIQ_UNSTATED_KIDS_SIZES,
	},
	"apliiq:1411": {
		supplierId: "apliiq",
		model: "3036",
		sourceUrl: "https://www.apliiq.com/customize/kids-babies/hoodies/Kids-Relax-Hood",
		supportedLabels: APLIIQ_UNSTATED_KIDS_SIZES,
	},
	"apliiq:1412": {
		supplierId: "apliiq",
		model: "3038",
		sourceUrl: "https://www.apliiq.com/customize/kids-babies/hoodies/Kids-Relax-Zip-Hood",
		supportedLabels: APLIIQ_UNSTATED_KIDS_SIZES,
	},
	"apliiq:1647": {
		supplierId: "apliiq",
		model: "3070",
		sourceUrl: "https://www.apliiq.com/customize/kids-babies/tshirts/Kids-Heavy-Faded-Tee",
		supportedLabels: APLIIQ_UNSTATED_KIDS_SIZES,
	},
	"apliiq:475": {
		supplierId: "apliiq",
		model: "US2001K",
		sourceUrl: "https://www.apliiq.com/customize/kids-babies/tshirts/Organic-Kids-T-Shirt",
		supportedLabels: APLIIQ_UNSTATED_KIDS_SIZES,
	},
	// "4 youth" and "6 youth" sit beside "2 toddler" as literal supplier labels;
	// no source ties them to the shared youth-year scale.
	"apliiq:697": {
		supplierId: "apliiq",
		model: "PRM10TSBZ",
		sourceUrl:
			"https://www.apliiq.com/customize/kids-babies/hoodies/Toddler-Lightweight-Special-Blend-Raglan-Zip-Hood",
		supportedLabels: ["4 youth", "6 youth"],
	},
	// Hoodies are not an approved grouped-range category, so S/M and L/XL stay
	// supplier selectors, as for the Inkthreadable hoodie above. TriDri publishes
	// this as TD085 in North America and TR085 in Europe with a different size
	// range and no statement that they are one SKU (docs/research/2026-11-07),
	// so fit across the two is unproved. The shared xs and xxl tokens are unchanged.
	"apliiq:868": {
		supplierId: "apliiq",
		model: "TD085",
		sourceUrl:
			"https://www.apliiq.com/customize/womens/hoodies/Ladies-Cropped-Oversize-Hooded-Sweatshirt",
		supportedLabels: ["S/M", "L/XL"],
	},
	// Apliiq labels the tall sizes 2XT-4XT. No retained source states they are the
	// shared 2XLT-4XLT, and the canonical research flags the LT-4XT range as
	// conflicting, so they stay opaque while LT and XLT keep the shared tall tokens.
	"apliiq:1003": {
		supplierId: "apliiq",
		model: "SHMHSST",
		sourceUrl: "https://www.apliiq.com/customize/mens/tshirts/Tall-Heavyweight-T-Shirt",
		supportedLabels: ["2XT", "3XT", "4XT"],
	},
} as const satisfies Record<string, ProductScopedSizeNormalizationRule>;

const lookupPrintkkSizeSelector = createClosedStringLookup<ProductScopedSizeNormalizationRule>(PRINTKK_REVIEWED_SIZE_SELECTORS);

// Product ids are matched lowercased; key the lookup the same way so a rule
// written with the id's original casing still applies.
const PRODUCT_SCOPED_RULES_BY_LOWERCASE_ID: Readonly<
	Record<string, ProductScopedSizeNormalizationRule>
> = Object.fromEntries(
	Object.entries(PRODUCT_SCOPED_SIZE_NORMALIZATION_RULES).map(([id, rule]) => [
		id.toLowerCase(),
		rule,
	]),
);
const lookupProductScopedSizeNormalizationRule = createClosedStringLookup(
	PRODUCT_SCOPED_RULES_BY_LOWERCASE_ID,
);

export function resolveProductScopedSizeNormalizationRule(
	input: SizeNormalizationResolverInput,
): ProductScopedSizeNormalizationRule | null {
	if (!input || typeof input === "string") return null;
	const id = input.productId?.trim().toLowerCase() ?? "";
	const existing = lookupProductScopedSizeNormalizationRule(id);
	const literal = lookupPrintkkSizeSelector(id);
	const rule = existing && literal
		? { ...existing, supportedLabels: [...new Set([...existing.supportedLabels, ...literal.supportedLabels])], labelTokens: literal.labelTokens }
		: existing ?? literal;
	return rule && rule.supplierId === input.supplierId?.trim().toLowerCase() ? rule : null;
}

function resolveSpecTypeFallbackEntry(
	specType: string | null | undefined,
): SizeNormalizationRegistryEntry | null {
	switch (specType) {
		case "apparel":
			return getSizeNormalizationRegistryEntry("apparel");
		case "headwear":
			return getSizeNormalizationRegistryEntry("hats");
		case "drinkware":
			return getSizeNormalizationRegistryEntry("drinkware");
		case "phone-cases":
			return getSizeNormalizationRegistryEntry("phone-cases");
		case "pet-products":
			return getSizeNormalizationRegistryEntry("pet-products");
		case "stationery":
			return getSizeNormalizationRegistryEntry("stationery");
		case "home-decor":
			return getSizeNormalizationRegistryEntry("blankets");
		default:
			return null;
	}
}

const PREDECESSOR_COMPLETE_SIZE_NORMALIZATION_BUCKET =
	"predecessor-complete-wall-art" as const;

export type SizeNormalizationRegistryEntry =
	| {
			readonly category: string;
			readonly status: "active";
			readonly normalizationClass: ActiveSizeNormalizationClass;
			readonly reviewedPolicySlice?: ReviewedSizeEquivalencePolicySlice;
			readonly supportedExamples: readonly string[];
			readonly nullKeyExamples: readonly string[];
			readonly sourceOfTruthSignals: readonly string[];
			readonly rationale: string;
	  }
	| {
			readonly category: string;
			readonly status: "deferred";
			readonly deferralBucket: DeferredSizeNormalizationBucket;
			readonly supportedExamples: readonly string[];
			readonly deferredExamples: readonly string[];
			readonly sourceOfTruthSignals: readonly string[];
			readonly rationale: string;
	  }
	| {
			readonly category: string;
			readonly status: "predecessor-complete";
			readonly predecessorBucket: typeof PREDECESSOR_COMPLETE_SIZE_NORMALIZATION_BUCKET;
			readonly reviewedPolicySlice?: ReviewedSizeEquivalencePolicySlice;
			readonly supportedExamples: readonly string[];
			readonly sourceOfTruthSignals: readonly string[];
			readonly rationale: string;
	  };

const APPAREL_SIZE_NORMALIZATION_CATEGORIES = [
	"t-shirts",
	"tank-tops",
	"hoodies",
	"sweatshirts",
	"long-sleeve-shirts",
	"polo-shirts",
	"leggings",
	"shorts",
	"joggers",
	"dresses",
	"kids-clothing",
	"baby-clothing",
	"swimwear",
	"activewear",
	"underwear",
	"socks",
	"crop-tops",
	"eco-friendly",
	"jackets",
	"sweaters",
	"quarter-zips",
	"sweatpants",
	"vests",
	"jerseys",
	"button-up-shirts",
	"bodysuits",
	"sleepwear",
	"skirts",
	"pants",
	"bottoms",
	"apparel",
	"hats",
	"beanies",
	"bucket-hats",
	"visors",
	"snapbacks",
	"trucker-hats",
	"dad-hats",
	"baseball-caps",
	"golf-caps",
] as const;

const CAPACITY_SIZE_NORMALIZATION_CATEGORIES = [
	"mugs",
	"tumblers",
	"glassware",
	"water-bottles",
	"bottles",
	"wine-tumblers",
	"drinkware",
] as const;

const CANDLE_SIZE_NORMALIZATION_CATEGORIES = ["candles"] as const;

const DEVICE_FIT_SIZE_NORMALIZATION_CATEGORIES = [
	"watch-bands",
	"phone-cases",
	"earphone-cases",
	"laptop-cases",
	"laptop-sleeves",
	"tablet-cases",
	"tech",
] as const;

export const HOME_STATIONERY_SIZE_NORMALIZATION_CATEGORIES = [
	"blankets",
	"pillows",
	"towels",
	"bedding",
	"rugs",
	"notebooks",
	"cards",
	"postcards",
	"calendars",
	"photo-books",
	"books",
	"wrapping-paper",
	"stationery",
	"office-supplies",
] as const;

const DISPLAY_SIZE_NORMALIZATION_CATEGORIES = [
	"banners",
	"flags",
	"signage",
] as const;

const FACE_MASK_DIMENSION_SIZE_NORMALIZATION_CATEGORIES = [
	"face-masks",
] as const;

const PET_SIZE_NORMALIZATION_CATEGORIES = [
	"pet-products",
	"pet-apparel",
	"dog-bandanas",
	"pet-bowls",
] as const;

const FOOTWEAR_SIZE_NORMALIZATION_CATEGORIES = [
	"sandals",
	"shoes",
	"slippers",
	"footwear",
] as const;

const FOOTWEAR_AUDIT_ONLY_CATEGORIES = [] as const;

const PACK_COUNT_DEFERRED_CATEGORIES = ["puzzles"] as const;

const PREDECESSOR_COMPLETE_WALL_ART_CATEGORIES =
	DIMENSIONAL_SIZE_NORMALIZATION_CATEGORIES;

function createEntries<const TCategory extends string>(
	categories: readonly TCategory[],
	createEntry: (category: TCategory) => SizeNormalizationRegistryEntry,
): Record<string, SizeNormalizationRegistryEntry> {
	return Object.fromEntries(
		categories.map(
			(category) => [category, createEntry(category)] as const,
		),
	);
}

const HEADWEAR_RANGE_LABEL_CATEGORIES = new Set<string>([
	"hats",
	"bucket-hats",
	"baseball-caps",
	"snapbacks",
]);

const GROUPED_APPAREL_LABEL_CATEGORIES = new Set<string>([
	"aprons",
	"jackets",
	"vests",
	"dresses",
	"sleepwear",
	"crop-tops",
]);

const HEADWEAR_ONE_SIZE_CATEGORIES = new Set<string>([
	"hats",
	"beanies",
	"visors",
	"trucker-hats",
	"dad-hats",
	"golf-caps",
]);

function readApparelSupportedExamples(category: string): string[] {
	if (HEADWEAR_RANGE_LABEL_CATEGORIES.has(category)) {
		return ["One Size", "S/M", "M/L", "L/XL", "XL/2XL"];
	}
	if (category === "socks") {
		return ["M", "One Size", "S/M", "L/XL"];
	}
	if (GROUPED_APPAREL_LABEL_CATEGORIES.has(category)) {
		return ["M", "XS/S", "M/L", "3XL/4XL"];
	}
	if (HEADWEAR_ONE_SIZE_CATEGORIES.has(category)) {
		return ["One Size"];
	}
	return ["M", "2T", "0-3M"];
}

function readApparelNullKeyExamples(category: string): string[] {
	return HEADWEAR_RANGE_LABEL_CATEGORIES.has(category) ||
		category === "socks" ||
		GROUPED_APPAREL_LABEL_CATEGORIES.has(category)
		? []
		: ["S/M", "M/L"];
}

function readApparelRationale(category: string): string {
	if (HEADWEAR_RANGE_LABEL_CATEGORIES.has(category)) {
		return "Headwear range labels are exact, category-scoped option identities. They do not collapse into simple apparel sizes; circumference-based nearest matching remains separate work.";
	}
	if (category === "socks" || GROUPED_APPAREL_LABEL_CATEGORIES.has(category)) {
		return "Reviewed grouped labels are preserved as exact category-scoped option identities. No size-chart conversion or nearest-size claim is implied.";
	}
	return "Post-wall-art apparel scope includes adult apparel, baby/kids apparel, and approved one-size headwear tokens.";
}

export const SIZE_NORMALIZATION_CATEGORY_REGISTRY = {
	...createEntries(APPAREL_SIZE_NORMALIZATION_CATEGORIES, (category) => ({
		category,
		status: "active",
		normalizationClass: "apparel",
		supportedExamples: readApparelSupportedExamples(category),
		nullKeyExamples: readApparelNullKeyExamples(category),
		sourceOfTruthSignals: [
			"reviewed normalization policy uses M for apparel and One Size for headwear",
			"categoryToSpecType maps apparel and headwear categories into the same deterministic size family",
			"size-aliases already normalizes One Size, toddler, and baby apparel tokens",
		],
		rationale: readApparelRationale(category),
	})),
	...createEntries(CAPACITY_SIZE_NORMALIZATION_CATEGORIES, (category) => ({
		category,
		status: "active",
		normalizationClass: "capacity",
		reviewedPolicySlice: "capacity",
		supportedExamples: ["11oz", "15oz"],
		nullKeyExamples: [],
		sourceOfTruthSignals: [
			"reviewed normalization policy uses 11oz for drinkware",
			"categoryToSpecType maps drinkware categories to drinkware",
			"drinkware product specs expose capacity as the deterministic comparison signal",
			"reviewed size-equivalence policy owns approved nominal and paired capacity aliases",
		],
		rationale:
			"Drinkware stays in a dedicated capacity class instead of sharing labels with apparel or pet sizes.",
	})),
	...createEntries(CANDLE_SIZE_NORMALIZATION_CATEGORIES, (category) => ({
		category,
		status: "active",
		normalizationClass: "capacity",
		reviewedPolicySlice: "capacity",
		supportedExamples: ["4oz", "9oz"],
		nullKeyExamples: ["Unscented"],
		sourceOfTruthSignals: [
			"reviewed candle variants expose fluid-ounce fill volumes as exact option labels",
			"current candle products use 4oz and 9oz capacity labels across Printful and Printify",
			"Unscented is derived as candle scent from the legacy size column and is not a physical size",
		],
		rationale:
			"Candle ounce labels represent fill capacity; scent labels remain null-key cases instead of being coerced into capacity.",
	})),
	...createEntries(DEVICE_FIT_SIZE_NORMALIZATION_CATEGORIES, (category) => ({
		category,
		status: "active",
		normalizationClass: "device-fit",
		supportedExamples:
			category === "earphone-cases"
				? ["AirPods Gen 2", "AirPods Pro"]
				: category === "laptop-cases"
					? ["MacBook Air 13.6"]
					: category === "tablet-cases"
						? ["iPad Pro 11inch (M4)"]
						: ["iPhone 15"],
		nullKeyExamples: [],
		sourceOfTruthSignals: [
			"supplier variant selectors expose exact buyer-visible device compatibility labels",
			"matching labels recur across Fourthwall, Printful, and Printify for AirPods and Apple case families",
			"device identity currently lives in the variant size string, not a separate spec field",
		],
		rationale:
			"Only exact phone, earphone, laptop, and reviewed tablet compatibility identities are normalized; generationless or compound labels without a reviewed identity remain unknown.",
	})),
	...createEntries(HOME_STATIONERY_SIZE_NORMALIZATION_CATEGORIES, (category) => ({
		category,
		status: "active",
		normalizationClass: "home-stationery",
		reviewedPolicySlice: "home-stationery",
		supportedExamples:
			category === "blankets" ||
			category === "pillows" ||
			category === "towels" ||
			category === "bedding" ||
			category === "rugs"
				? ["50x60"]
				: ["A5", "Letter"],
		nullKeyExamples: [],
		sourceOfTruthSignals: [
			"reviewed normalization policy uses 50x60 for deterministic home dimensions and A5 for stationery",
			"categoryToSpecType splits home-decor and stationery away from other semantics",
			"stationery product and variant specs already expose page/pageRange signals for format-aware review",
			"reviewed size-equivalence policy owns approved paper-family guardrails and mixed-label negatives",
		],
		rationale:
			"Home and stationery share deterministic dimensional-or-format semantics here, while Standard-only home/living categories stay out of rollout.",
	})),
	...createEntries(DISPLAY_SIZE_NORMALIZATION_CATEGORIES, (category) => ({
		category,
		status: "active",
		normalizationClass: "home-stationery",
		supportedExamples: ["12x18"],
		nullKeyExamples: [],
		sourceOfTruthSignals: [
			"display comparison policies require an exact selected size",
			"supplier display rows expose explicit two-dimensional size labels",
			"normalization preserves measured dimensions instead of treating all displays as one format",
		],
		rationale:
			"Banners, flags, and signs use the same exact dimensional tokens as other measured products without inheriting stationery paper aliases.",
	})),
	...createEntries(
		FACE_MASK_DIMENSION_SIZE_NORMALIZATION_CATEGORIES,
		(category) => ({
			category,
			status: "active",
			normalizationClass: "home-stationery",
			supportedExamples: ['7.3" x 4.5"'],
			nullKeyExamples: ["One Size"],
			sourceOfTruthSignals: [
				"face-mask comparison policy requires the selected physical size",
				"supplier size guides expose exact mask-panel width and height",
				"adult and child masks must not share an unmeasured One Size token",
			],
			rationale:
				"Measured mask-panel dimensions are exact comparison evidence, while an unmeasured One Size label stays unknown.",
		}),
	),
	...createEntries(PET_SIZE_NORMALIZATION_CATEGORIES, (category) => ({
		category,
		status: "active",
		normalizationClass: "pet",
		supportedExamples:
			category === "pet-bowls" ? ["18oz", "32oz"] : ["Medium"],
		nullKeyExamples: [
			"S-L",
			"S (64 x 20cm), M (80 x 25cm), L (85 x 28cm)",
		],
		sourceOfTruthSignals: [
			"reviewed normalization policy uses Medium for pet-products and pet-apparel",
			"categoryToSpecType maps dog-bandanas and pet-bowls into pet-products",
			"pet variant specs already expose sizeRange so range-style values can stay null-key",
		],
		rationale:
			"Pet rollout is limited to deterministic single-value pet sizes; range-style and overlap values remain null-key cases.",
	})),
	...createEntries(FOOTWEAR_SIZE_NORMALIZATION_CATEGORIES, (category) => ({
		category,
		status: "active",
		normalizationClass: "footwear",
		supportedExamples: ["S", "Kid's 13", "US 9", "US 10 (Men's)", "US 7 - 8"],
		nullKeyExamples: [],
		sourceOfTruthSignals: [
			"supplier footwear pickers expose buyer-visible alpha, regional, audience-scoped, or explicit range labels",
			"exact source labels are useful without claiming US/EU/UK or men's/women's equivalence",
			"supplier size guides remain the authority for any future nearest-size or cross-system conversion",
		],
		rationale:
			"Footwear gets exact, system- and audience-scoped option keys; cross-system conversion and nearest-size matching remain unimplemented.",
	})),
	...createEntries(FOOTWEAR_AUDIT_ONLY_CATEGORIES, (category) => ({
		category,
		status: "deferred",
		deferralBucket: "footwear-audit-only",
		supportedExamples: [],
		deferredExamples: ["US 9"],
		sourceOfTruthSignals: [
			"reviewed normalization policy uses US 9 for footwear",
			"repo category docs still mix US, EU, UK, and audience-specific footwear systems",
		],
		rationale:
			"Footwear stays audit-only until the repo has evidence for deterministic cross-system equivalence.",
	})),
	...createEntries(PACK_COUNT_DEFERRED_CATEGORIES, (category) => ({
		category,
		status: "deferred",
		deferralBucket: "pack-count-deferred",
		supportedExamples: [],
		deferredExamples: ["500 pieces", "2-pack"],
		sourceOfTruthSignals: [
			"reviewed normalization policy uses 500 pieces for puzzles",
			"pack and count values are quantity semantics, not deterministic single-size equivalence",
		],
		rationale:
			"Pack and count semantics are explicitly deferred instead of being coerced into a size class.",
	})),
	...createEntries(PREDECESSOR_COMPLETE_WALL_ART_CATEGORIES, (category) => ({
		category,
		status: "predecessor-complete",
		predecessorBucket: PREDECESSOR_COMPLETE_SIZE_NORMALIZATION_BUCKET,
		reviewedPolicySlice: "wall-art",
		supportedExamples: ["12x16"],
		sourceOfTruthSignals: [
			"wall-art dimensional categories already ship through normalized size value",
			"variant-size-normalization tests still restrict active normalization to wall-art predecessor scope",
			"reviewed size-equivalence policy records exact and supplier-declared wall-art pairings without enabling new runtime behavior here",
		],
		rationale:
			"Wall-art stays represented as already complete work, not as new rollout scope for this plan.",
	})),
} as const satisfies Record<string, SizeNormalizationRegistryEntry>;

const lookupSizeNormalizationRegistryEntry = createClosedStringLookup(
	SIZE_NORMALIZATION_CATEGORY_REGISTRY,
);

export function getSizeNormalizationRegistryEntry(
	categorySlug: string | null | undefined,
): SizeNormalizationRegistryEntry | null {
	if (typeof categorySlug !== "string") {
		return null;
	}

	return lookupSizeNormalizationRegistryEntry(categorySlug) ?? null;
}

export function resolveSizeNormalizationRegistryEntry(
	input: SizeNormalizationResolverInput,
): SizeNormalizationRegistryEntry | null {
	if (typeof input === "string") {
		return getSizeNormalizationRegistryEntry(input);
	}

	if (!input) {
		return null;
	}

  // Measured accessory sizes may use dimensional tokens. This establishes no
  // category picker or fit equivalence; only reviewed families admit a picker.
  if (
    input.categorySlug === "sports-accessories" &&
    input.specType === "accessories"
  ) {
    return getSizeNormalizationRegistryEntry("blankets");
	}

	const categoryEntry = getSizeNormalizationRegistryEntry(input.categorySlug);
	if (categoryEntry) {
		return categoryEntry;
	}

	const specTypeFallbackEntry = resolveSpecTypeFallbackEntry(input.specType);
	if (specTypeFallbackEntry) {
		return specTypeFallbackEntry;
	}

	if (input.specType === "wall-art") {
		return getSizeNormalizationRegistryEntry("wall-art");
	}

	return null;
}
