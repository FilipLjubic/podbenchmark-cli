import { createClosedStringLookup } from "../kernel/closed-string-lookup";

/**
 * Reviewed product-scoped size aliases that change the size token itself
 * (apparel comparison class or device fit).
 *
 * This is deliberately separate from
 * `PRODUCT_SCOPED_SIZE_NORMALIZATION_RULES` in `size-normalization-registry.ts`:
 * that registry names opaque supplier selector identities for one listing
 * (choice identity), while these rules translate a reviewed label into the
 * shared apparel/device-fit namespace. Keep a new rule in the table its
 * evidence belongs to instead of mixing the two mechanisms.
 */
type ReviewedProductSizeAliasClass = "apparel" | "device-fit";

type ReviewedProductSizeAliasRule = {
	readonly sizeClass: ReviewedProductSizeAliasClass;
	readonly supplierId: string;
	readonly model: string;
	/** Where the labels and their reading were reviewed. */
	readonly evidence: string;
	/** Observed supplier labels; the aliases translate only these. */
	readonly supportedLabels: readonly string[];
	/**
	 * Keyed by the label after this rule class's normalization: apparel keys are
	 * the trimmed, lowercased label; device-fit keys are
	 * `normalizeReviewedIphoneCompatibilityLabel` output.
	 */
	readonly aliases: Readonly<Record<string, string>>;
	readonly categorySlug?: string;
	/**
	 * The inline rule this replaces also required this exact supplier. Rules
	 * without it keep their product-id-only guard.
	 */
	readonly requiresSupplierMatch?: boolean;
};

export const REVIEWED_PRODUCT_SIZE_ALIAS_RULES = {
	// The exact 5620/5983 UK and US manufacturer guides use the same nominal
	// columns as these supplier selectors. This is a label identity only:
	// elastic garment measurements are not body-waist inches or alpha sizes.
	"inkthreadable:50260185": {
		sizeClass: "apparel",
		supplierId: "inkthreadable",
		model: "AS-5620",
		evidence:
			"https://ascolour.co.uk/active-shorts-18-5620/ and https://ascolour.com/active-shorts-18-5620/ — manufacturer 5620 nominal columns 30–40 match the retained Waist selectors; docs/research/2026-11-12-new-supplier-option-normalization.md",
		supportedLabels: ["Waist 30", "Waist 32", "Waist 34", "Waist 36", "Waist 38", "Waist 40"],
		aliases: { "waist 30": "30", "waist 32": "32", "waist 34": "34", "waist 36": "36", "waist 38": "38", "waist 40": "40" },
		categorySlug: "shorts",
		requiresSupplierMatch: true,
	},
	"inkthreadable:50783855": {
		sizeClass: "apparel",
		supplierId: "inkthreadable",
		model: "AS-5983",
		evidence:
			"https://ascolour.co.uk/mens-canvas-shorts/ and https://ascolour.com/mens-canvas-shorts/ — manufacturer 5983 nominal columns 28/30/32/34/36/40 match the retained Waist selectors; docs/research/2026-11-12-new-supplier-option-normalization.md",
		supportedLabels: ["Waist 28", "Waist 30", "Waist 32", "Waist 34", "Waist 36", "Waist 40"],
		aliases: { "waist 28": "28", "waist 30": "30", "waist 32": "32", "waist 34": "34", "waist 36": "36", "waist 40": "40" },
		categorySlug: "shorts",
		requiresSupplierMatch: true,
	},
	// All five chest, body and sleeve columns in the supplier guide match
	// JH030J's manufacturer chart, including the paired alpha/age labels.
	"inkthreadable:15078803": {
		sizeClass: "apparel",
		supplierId: "inkthreadable",
		model: "JH030J",
		evidence:
			"https://awdis.com/products/kids-awdis-sweat-jh030j/ — XS (3-4yrs) through XL (12-13yrs), matching the retained supplier guide measurements; docs/research/2026-11-12-new-supplier-option-normalization.md",
		supportedLabels: ["XS / 3-4", "S / 5-6", "M / 7-8", "L / 9-11", "XL / 12-13"],
		aliases: { "xs / 3-4": "YXS", "s / 5-6": "YS", "m / 7-8": "YM", "l / 9-11": "YL", "xl / 12-13": "YXL" },
		categorySlug: "sweatshirts",
		requiresSupplierMatch: true,
	},
	// Printify's exact 1318 blueprint is model 2000T and is titled Tall. Its
	// current option labels are XL/2XL/3XL, while the reviewed comparison class
	// is the adult-tall namespace. Only those observed labels are translated.
	"printify:1318": {
		sizeClass: "apparel",
		supplierId: "printify",
		model: "2000T",
		evidence:
			"https://printify.com/app/products/1318/gildan/unisex-ultra-cotton-tall-t-shirt — model 2000T, titled Tall; options read XL/2XL/3XL",
		supportedLabels: ["XL", "2XL", "3XL"],
		aliases: { xl: "XLT", "2xl": "2XLT", "3xl": "3XLT" },
	},
	// The exact CSJ504 manufacturer guide has the same measurements under
	// 2/3XL and 4/5XL as Printify's abbreviated 2/3X and 4/5X columns.
	"printify:4196": {
		sizeClass: "apparel",
		supplierId: "printify",
		model: "CSJ504",
		evidence:
			"https://printify.com/app/products/4196/cornerstone/ansi-107-class-3-rain-jacket — CSJ504 guide matches 2/3XL and 4/5XL to the 2/3X and 4/5X options under jackets",
		supportedLabels: ["2/3X", "4/5X"],
		aliases: { "2/3x": "2XL/3XL", "4/5x": "4XL/5XL" },
		categorySlug: "jackets",
	},
	// Printful sells one clear case listing across several iPhone generations,
	// so its bare "iPhone SE" label was reviewed as the 2020 SE (2nd generation)
	// for this listing only. Other listings and generations keep their own fit.
	"printful:181": {
		sizeClass: "device-fit",
		supplierId: "printful",
		model: "Clear Case for iPhone",
		evidence:
			"Printful Clear Case for iPhone® (printful:181): the bare iPhone SE compatibility label is the 2020 iPhone SE (2nd generation)",
		supportedLabels: ["iPhone SE"],
		aliases: { "iphone se": "iphone-se-2nd-generation" },
		requiresSupplierMatch: true,
	},
} as const satisfies Readonly<Record<string, ReviewedProductSizeAliasRule>>;

const lookupReviewedProductSizeAliasRule =
	createClosedStringLookup<ReviewedProductSizeAliasRule>(
		REVIEWED_PRODUCT_SIZE_ALIAS_RULES,
	);

export function resolveReviewedProductSizeAliasRule(input: {
	readonly sizeClass: ReviewedProductSizeAliasClass;
	readonly productId?: string | null;
	readonly supplierId?: string | null;
	readonly categorySlug?: string | null;
}): ReviewedProductSizeAliasRule | null {
	const productId = input.productId?.trim().toLowerCase() ?? "";
	const rule = lookupReviewedProductSizeAliasRule(productId);
	if (!rule || rule.sizeClass !== input.sizeClass) return null;
	if (
		rule.requiresSupplierMatch &&
		input.supplierId?.trim().toLowerCase() !== rule.supplierId
	) {
		return null;
	}
	if (
		rule.categorySlug !== undefined &&
		input.categorySlug?.trim().toLowerCase() !== rule.categorySlug
	) {
		return null;
	}
	return rule;
}
