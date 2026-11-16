import { createClosedStringLookup } from "../kernel/closed-string-lookup";
import { convertToMm, parseDimensions } from "./extract-dimensions";
import {
	lengthSizeToken,
	puzzlePiecesSizeToken,
	sizeKeyTenthsMm,
	slugifyOpaqueToken,
	supplierSizeToken,
} from "./size-token";
import {
	getApparelSizeBucket,
	isKnownSize,
	type NormalizeSizeOptions,
	normalizeSize,
} from "./normalize-size";
import type {
	SizeNormalizationNamespace,
	SizeNormalizationRegistryEntry,
	SizeNormalizationResolverInput,
} from "./size-normalization-registry";
import {
	DIMENSIONAL_SIZE_NORMALIZATION_CATEGORIES,
	HOME_STATIONERY_SIZE_NORMALIZATION_CATEGORIES,
	resolveProductScopedSizeNormalizationRule,
	resolveSizeNormalizationRegistryEntry,
} from "./size-normalization-registry";
import { resolveReviewedProductSizeAliasRule } from "./reviewed-product-size-aliases";
import {
	hasReviewedPaperFamilySignal,
	resolveReviewedCapacityMixedLabelTokenForMl,
	resolveReviewedCapacityNominalTokenForMl,
	resolveReviewedPaperFamilyToken,
	resolveReviewedSizeEquivalenceToken,
} from "./size-equivalence-policy";
import { captureGroup } from "../kernel/required";
import { soleMember } from "../kernel/sole-member";

const dimensionalSizeNormalizationCategorySet = new Set<string>(
	DIMENSIONAL_SIZE_NORMALIZATION_CATEGORIES,
);
const homeStationerySizeNormalizationCategorySet = new Set<string>(
	HOME_STATIONERY_SIZE_NORMALIZATION_CATEGORIES,
);

const SIMPLE_DIMENSION_RE =
	/^\s*\d+(?:\.\d+)?\s*[×x]\s*\d+(?:\.\d+)?\s*(?:mm|cm|in|inch|inches)?\s*$/i;
const THREE_DIMENSION_RE =
	/^\s*\d+(?:\.\d+)?\s*[×x]\s*\d+(?:\.\d+)?\s*[×x]\s*\d+(?:\.\d+)?\s*(?:mm|cm|in|inch|inches)?\s*$/i;
const ISO_DIMENSION_ALIAS_RE = /\ba[0-5]\b/i;
const ISO_DIMENSION_RE = /^\s*a[0-5]\s*$/i;
const US_PAPER_SIZES = new Set(["letter", "legal", "tabloid", "ledger"]);
const APPAREL_MULTI_SIZE_TOKENS = new Set(["S/M", "M/L", "L/XL", "Standard"]);
// Suppliers use plain alpha labels for youth garments. Keep those labels in
// the resolved product age context, including kids listings under an all-ages
// generic canonical. Other products retain the adult alpha-size default.
const YOUTH_ALPHA_SIZE_ALIASES = new Map<string, string>([
	["2xs", "Y2XS"],
	["xxs", "Y2XS"],
	["xs", "YXS"],
	["s", "YS"],
	["m", "YM"],
	["l", "YL"],
	["xl", "YXL"],
	["2xl", "Y2XL"],
	["xxl", "Y2XL"],
]);
// These retained Inkthreadable size guides explicitly label the numeric half
// as age/years. Preserve that literal range, without equating youth alpha fit.
const REVIEWED_INKTHREADABLE_DUAL_AGE_PRODUCTS = new Set([
	"inkthreadable:49061508", // AT002J: Age, years
	"inkthreadable:2296290", // JH001B: Age
	"inkthreadable:2301293", // GD01B: Age, years
	"inkthreadable:28028929", // Mini Bolter: Years / Height
]);
const REVIEWED_HEADWEAR_RANGE_CATEGORIES = new Set([
	"hats",
	"baseball-caps",
	"bucket-hats",
	"snapbacks",
	"trucker-hats",
]);
const REVIEWED_GROUPED_APPAREL_RANGE_CATEGORIES = new Set([
	"aprons",
	"jackets",
	"vests",
	"crop-tops",
	"dresses",
	"sleepwear",
	"socks",
]);
const GROUPED_APPAREL_SIZE_RE = /^([a-z0-9]+)\s*[\/-]\s*([a-z0-9]+)$/i;
const ORDERED_GROUPED_APPAREL_SIZES = [
	"XXS",
	"XS",
	"S",
	"M",
	"L",
	"XL",
	"2XL",
	"3XL",
	"4XL",
	"5XL",
	"6XL",
] as const;
const PET_APPAREL_SIZE_TOKENS = new Set([
	"XXS",
	"XS",
	"S",
	"M",
	"L",
	"XL",
	"2XL",
	"3XL",
]);
const PET_WEARABLE_EXACT_ALIASES = new Map<string, string>([["XXS", "XXS"]]);
const PACK_COUNT_RE =
	/^(?:\d+\s*[- ]?pack|pack\s+of\s+\d+|\d+\s*(?:pc|pcs|piece|pieces))$/i;
const CAPACITY_PACK_COUNT_RE =
	/\b(?:\d+\s*[- ]?pack|pack\s+of\s+\d+|\d+\s*(?:pc|pcs|piece|pieces))\b/i;
const FOOTWEAR_SYSTEM_AUDIENCE_SIZE_RE =
	/^(US|UK|EU)\s*(\d+(?:\.\d+)?)(?:\s*[-–]\s*(\d+(?:\.\d+)?))?(?:\s*\((men(?:'|’)?s|women(?:'|’)?s|kid(?:'|’)?s|kids|youth|unisex)\))?$/i;
const FOOTWEAR_SYSTEM_SIZE_RE = /^(US|UK|EU)\s*(\d+(?:\.\d+)?)(?:\s*([A-Z]+))?$/i;
const FOOTWEAR_ALPHA_SIZE_RE = /^(XS|S|M|L|XL)$/i;
const FOOTWEAR_US_KIDS_SIZE_RE = /^kid(?:'|’)?s?\s*(\d+(?:\.\d+)?)$/i;
const CAPACITY_OZ_RE = /(\d+(?:\.\d+)?)\s*-?\s*oz\b/gi;
const CAPACITY_ML_RE = /(\d+(?:\.\d+)?)\s*-?\s*ml\b/gi;
const MULTI_CAPACITY_RE =
	/\b\d+(?:\.\d+)?\s*(?:\/|[-–])\s*\d+(?:\.\d+)?\s*(?:oz|ml)\b/i;
const DEVICE_MULTI_DELIMITER_RE = /[\/,;&]|\band\b/i;
const DEVICE_AMBIGUOUS_TERM_RE =
	/\b(?:series|models|compatible|compatibility|fits|fit|case\s+for|devices?)\b/i;
const DEVICE_VENDOR_PREFIX_RE = /^(?:apple|samsung|google)\s+/i;
const DIMENSION_ORIENTATION_SUFFIX_RE = /\s*\((?:vertical|horizontal|square)\)\s*$/i;
const ISO_DIMENSION_WITH_DETAILS_RE = /^\s*(a[0-5])\s*\([^)]*\)\s*$/i;
const WALL_ART_SUPPLIER_METRIC_IMPERIAL_PAIR_RE =
	/^\s*\d+(?:\.\d+)?\s*[x×]\s*\d+(?:\.\d+)?\s*-?\s*mm\s*-\s*(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*-?\s*(?:in|inch|inches)\s*$/i;
const WALL_ART_SUPPLIER_DISPLAY_PAIR_RE =
	/^\s*(?:a[0-5]\s+)?\d+(?:\.\d+)?\s*[x×]\s*\d+(?:\.\d+)?\s*cm\s*\/\s*(?:xl\s*)?\(?\s*(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(?:["″“”]|in(?:ch(?:es)?)?)\s*\)?\s*$/i;
const GELATO_HOME_STATIONERY_EMBEDDED_DIMENSION_RE =
	/(?:^|\()\s*(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(mm|cm|in(?:ch(?:es)?)?|["″“”])(?=\s*(?:\)|\(|$))/i;

const GELATO_HOME_STATIONERY_FORMAT_ALIASES = new Map<string, string>([
	["sm", "4.25 x 5.5 in"],
	["5r", "5 x 7 in"],
	["a6", "10.5 x 14.8 cm"],
	["dl", "9.9 x 21 cm"],
	["a5l", "paper:a5-long"],
	// Gelato's cached FormatSize selector provides these exact dimensions.
	["lt", "8.5 x 11 in"],
	["lg", "5.5 x 8.5 in"],
	["dx", "3.67 x 8.5 in"],
	["b5", "17.6 x 25 cm"],
	["sq148x148", "14.8 x 14.8 cm"],
	["sq210x210", "21 x 21 cm"],
	["slim148x400-mm", "14.8 x 40 cm"],
	["slim5-5x16-5-inch", "5.5 x 16.5 in"],
	["sq8-5x8-5", "8.5 x 8.5 in"],
	["xl11x16-5-inch", "11 x 16.5 in"],
]);

// The exact live selector UIDs and retained selected FormatSize metadata agree.
// These card codes are not general stationery or cross-supplier aliases.
const GELATO_BUSINESS_CARD_FORMAT_ALIASES = new Map<string, string>([
	["bb", "5.0 x 9.0 cm"],
	["bc", "5.5 x 9.0 cm"],
	["bd", "5.5 x 8.5 cm"],
	["bx", "2 x 3.5 in"],
]);

const GELATO_HOME_STATIONERY_US_CA_FORMAT_ALIASES = new Map<string, string>([
	["sq", "5.25 x 5.25 in"],
	["sx", "14.1 x 14.1 cm"],
]);

const GELATO_HOME_STATIONERY_EU_FORMAT_ALIASES = new Map<string, string>([
	["sq", "14.1 x 14.1 cm"],
]);

const PET_BOWL_ML_TO_OZ_ALIASES = new Map<number, readonly string[]>([
	[532, ["18oz"]],
	[946, ["32oz"]],
]);

const REVIEWED_LEGACY_IPHONE_COMPATIBILITY_SETS = {
	"iphone 5/5s/5se": "iphone-5-5s-5se",
	"iphone 6/6s": "iphone-6-6s",
	"iphone 6/6s plus": "iphone-6-6s-plus",
	"iphone 7/8": "iphone-7-8",
	"iphone 7 plus/8 plus": "iphone-7-plus-8-plus",
	"iphone 7 plus, iphone 8 plus": "iphone-7-plus-8-plus",
	"iphone 7, iphone 8, iphone se": "iphone-7-8-se",
	"iphone 12/12 pro": "iphone-12-12-pro",
	"iphone x/xs": "iphone-x-xs",
} satisfies Record<string, string>;
const lookupReviewedLegacyIphoneCompatibilitySet = createClosedStringLookup(
	REVIEWED_LEGACY_IPHONE_COMPATIBILITY_SETS,
);

const REVIEWED_IPAD_DEVICE_FIT_ALIASES = {
	"ipad (a16/10th gen)": "apple-ipad-a16-10th-generation",
	"ipad air 11inch (m3/m2/5th/4th gen)":
		"apple-ipad-air-11-inch-m3-m2-5th-4th-generation",
	"ipad air 13inch (m3/m2)": "apple-ipad-air-13-inch-m3-m2",
	"ipad mini (a17 pro)": "apple-ipad-mini-a17-pro",
	"ipad pro 11": "apple-ipad-pro-11",
	"ipad pro 11inch (m4)": "apple-ipad-pro-11-inch-m4",
	"ipad pro 12.9": "apple-ipad-pro-12-9",
	"ipad pro 13inch (m4)": "apple-ipad-pro-13-inch-m4",
} satisfies Record<string, string>;
const lookupReviewedIpadDeviceFitAlias = createClosedStringLookup(
	REVIEWED_IPAD_DEVICE_FIT_ALIASES,
);

export function isDimensionalSizeNormalizationCategory(
	categorySlug: string | null | undefined,
): categorySlug is (typeof DIMENSIONAL_SIZE_NORMALIZATION_CATEGORIES)[number] {
	return (
		typeof categorySlug === "string" &&
		dimensionalSizeNormalizationCategorySet.has(categorySlug)
	);
}

function isNamedPaperSize(rawSize: string): boolean {
	const normalized = rawSize.trim().toLowerCase();
	return ISO_DIMENSION_RE.test(normalized) || US_PAPER_SIZES.has(normalized);
}

function isStrictTwoDimensionalSize(rawSize: string): boolean {
	return isNamedPaperSize(rawSize) || SIMPLE_DIMENSION_RE.test(rawSize);
}

function formatOzNumber(rawValue: string): string | null {
	const numericValue = Number(rawValue);
	if (!Number.isFinite(numericValue)) {
		return null;
	}

	return `${numericValue}oz`;
}

function formatOzValue(rawValue: string): string | null {
	const normalized = rawValue.trim().toLowerCase().replace(/\s+/g, "");
	const ounces = normalized.match(/^(\d+(?:\.\d+)?)-?oz$/)?.[1];
	if (ounces === undefined) {
		return null;
	}

	return formatOzNumber(ounces);
}

function normalizeDimensionCandidate(rawSize: string): string {
	const isoDimension = rawSize.match(ISO_DIMENSION_WITH_DETAILS_RE)?.[1];
	if (isoDimension !== undefined) {
		return isoDimension;
	}

	return rawSize
		.trim()
		.replace(DIMENSION_ORIENTATION_SUFFIX_RE, "")
		.replace(/["″“”'']/g, "")
		.replace(/[′‘’]/g, "")
		.replace(/[‐‑‒–—―]/g, "-")
		.replace(/\s+/g, " ");
}

function extractCapacityTokens(rawValue: string, pattern: RegExp): string[] {
	return Array.from(rawValue.matchAll(pattern), (match) => match[1] ?? "").filter(
		(value) => value !== "",
	);
}

function getSingleUniqueToken(tokens: readonly string[]): string | null {
	const uniqueTokens = [...new Set(tokens)];
	return uniqueTokens.length === 1 ? (uniqueTokens[0] ?? null) : null;
}

function createDeterministicDrinkwareMlToken(
	rawSize: string,
	mode: "nominal-only" | "mixed-label" = "nominal-only",
): string | null {
	const mlTokens = extractCapacityTokens(rawSize, CAPACITY_ML_RE);
	if (mlTokens.length === 0) {
		return null;
	}

	const mlAliases = mlTokens.map((token) => {
		const numericToken = Number(token);
		if (!Number.isFinite(numericToken)) {
			return null;
		}

		return mode === "mixed-label"
			? resolveReviewedCapacityMixedLabelTokenForMl(Math.round(numericToken))
			: resolveReviewedCapacityNominalTokenForMl(Math.round(numericToken));
	});
	if (mlAliases.some((alias) => alias === null)) {
		return null;
	}

	return getSingleUniqueToken(mlAliases.filter((alias): alias is string => alias !== null));
}

function createDeterministicPetMlToken(rawSize: string): string | null {
	const mlTokens = extractCapacityTokens(rawSize, CAPACITY_ML_RE);
	if (mlTokens.length === 0) {
		return null;
	}

	const mlAliases = mlTokens.map((token) => {
		const numericToken = Number(token);
		if (!Number.isFinite(numericToken)) {
			return null;
		}

		return PET_BOWL_ML_TO_OZ_ALIASES.get(Math.round(numericToken)) ?? null;
	});
	if (mlAliases.some((aliases) => aliases === null || aliases.length !== 1)) {
		return null;
	}

	return getSingleUniqueToken(
		mlAliases.flatMap((aliases) => aliases ?? []),
	);
}

function createNamespacedNormalizedValue(
	namespace: SizeNormalizationNamespace,
	token: string,
): string | null {
	return token ? `${namespace}:${token}` : null;
}

function createDimensionalToken(rawSize: string): string | null {
	const normalizedRawSize = normalizeDimensionCandidate(rawSize);
	if (THREE_DIMENSION_RE.test(normalizedRawSize)) {
		return null;
	}

	if (ISO_DIMENSION_ALIAS_RE.test(normalizedRawSize) && !isNamedPaperSize(normalizedRawSize)) {
		return null;
	}

	if (!isStrictTwoDimensionalSize(normalizedRawSize)) {
		return null;
	}

	const parsed = parseDimensions(normalizedRawSize);
	if (!parsed) {
		return null;
	}

	const inMillimeters = convertToMm(parsed);
	return `dim:${sizeKeyTenthsMm(inMillimeters.width)}x${sizeKeyTenthsMm(inMillimeters.height)}`;
}

function createWallArtSupplierDimensionPairToken(rawSize: string): string | null {
	const normalizedRawSize = normalizeDimensionCandidate(rawSize);
	const match =
		normalizedRawSize.match(WALL_ART_SUPPLIER_METRIC_IMPERIAL_PAIR_RE) ??
		rawSize.match(WALL_ART_SUPPLIER_DISPLAY_PAIR_RE);
	if (!match) {
		return null;
	}

	return createDimensionalToken(`${match[1]}x${match[2]} in`);
}

function createHomeStationeryPaperFormatToken(rawSize: string): string | null {
	const reviewedCaseToken = resolveReviewedSizeEquivalenceToken(
		"home-stationery",
		rawSize,
	);
	if (reviewedCaseToken) {
		return reviewedCaseToken;
	}

	const normalizedRawSize = normalizeDimensionCandidate(rawSize);
	const aliasToken = resolveReviewedPaperFamilyToken(normalizedRawSize);
	if (aliasToken) {
		return aliasToken;
	}

	return null;
}

function createGelatoHomeStationeryFormatToken(
	rawSize: string,
	context: SizeNormalizationResolverInput,
): string | null {
	if (!context || typeof context === "string") {
		return null;
	}
	if (context.supplierId?.trim().toLowerCase() !== "gelato") {
		return null;
	}
	const categorySlug = context.categorySlug?.trim().toLowerCase() ?? "";
	const specType = context.specType?.trim().toLowerCase() ?? "";
	if (
		specType !== "stationery" &&
		!homeStationerySizeNormalizationCategorySet.has(categorySlug)
	) {
		return null;
	}
	const embeddedDimensions = rawSize.match(
		GELATO_HOME_STATIONERY_EMBEDDED_DIMENSION_RE,
	);
	if (embeddedDimensions) {
		const rawUnit = captureGroup(embeddedDimensions, 3).toLowerCase();
		const unit = /^(?:["″“”]|in)/i.test(rawUnit) ? "in" : rawUnit;
		return createDimensionalToken(
			`${embeddedDimensions[1]} x ${embeddedDimensions[2]} ${unit}`,
		);
	}

	const normalizedRawSize = rawSize.trim().toLowerCase();
	const alias =
		(categorySlug === "business-cards"
			? GELATO_BUSINESS_CARD_FORMAT_ALIASES.get(normalizedRawSize)
			: null) ??
		GELATO_HOME_STATIONERY_FORMAT_ALIASES.get(normalizedRawSize) ??
		(isGelatoUsCaHomeStationeryProduct(context)
			? GELATO_HOME_STATIONERY_US_CA_FORMAT_ALIASES.get(normalizedRawSize)
			: isGelatoEuHomeStationeryProduct(context)
				? GELATO_HOME_STATIONERY_EU_FORMAT_ALIASES.get(normalizedRawSize)
				: null);
	if (!alias) {
		return null;
	}
	if (alias.startsWith("paper:")) {
		return alias;
	}
	return createDimensionalToken(alias);
}

// This card's FormatSize selector and Gelato's matching-envelope guide identify
// A5. Preserve its protected format before reading the display dimensions.
// Source and scope: docs/research/2026-11-12-residual-format-normalization.md.
function createGelatoCardPaperFormatToken(
	rawSize: string,
	context: SizeNormalizationResolverInput,
): string | null {
	if (!context || typeof context === "string") return null;
	if (context.supplierId?.trim().toLowerCase() !== "gelato") return null;
	if (context.productId?.trim().toLowerCase() !== "gelato:pack-of-10-greeting-cards-eu") return null;
	if (rawSize.trim().toLowerCase() !== "a5 (14.8 x 21 cm)") return null;
	return createHomeStationeryPaperFormatToken("A5");
}

// Inkthreadable's greeting card 42939450 labels its two selectable sizes "Regular - A6" and
// "Large - A5"; its size guide states 105 x 148 mm and 148 x 210 mm. Route each label to the
// representation other suppliers already use for that format (Gelato's A6 is dimensional, bare
// A5 is a paper size), so the comparison keeps one key per format. Product-scoped: "Regular"
// and "Large" are not sizes.
function createInkthreadableCardFormatToken(
	rawSize: string,
	context: SizeNormalizationResolverInput,
): string | null {
	if (!context || typeof context === "string") return null;
	if (context.supplierId?.trim().toLowerCase() !== "inkthreadable") return null;
	if (context.productId?.trim().toLowerCase() !== "inkthreadable:42939450") return null;
	const categorySlug = context.categorySlug?.trim().toLowerCase() ?? "";
	if (
		context.specType?.trim().toLowerCase() !== "stationery" &&
		!homeStationerySizeNormalizationCategorySet.has(categorySlug)
	) {
		return null;
	}
	switch (rawSize.trim().toLowerCase().replace(/\s+/g, " ")) {
		case "regular - a6":
			return createDimensionalToken("105 x 148 mm");
		case "large - a5":
			return createHomeStationeryPaperFormatToken("A5");
		default:
			return null;
	}
}

function createPrintifyHomeStationeryFormatToken(
	rawSize: string,
	context: SizeNormalizationResolverInput,
): string | null {
	if (!context || typeof context === "string") return null;
	if (context.supplierId?.trim().toLowerCase() !== "printify") return null;
	if (context.productId?.trim().toLowerCase() !== "printify:1041") return null;
	if (rawSize.trim().toLowerCase() !== "b5") return null;

	// Printify's cached size guide for blueprint 1041 gives a closed width of
	// 176 mm and height of 246 mm. Keep the alias product-scoped because bare
	// B5 is ambiguous between incompatible paper standards.
	return createDimensionalToken("176 x 246 mm");
}

function isGelatoUsCaHomeStationeryProduct(
	context: Exclude<SizeNormalizationResolverInput, string | null | undefined>,
): boolean {
	return /\bus\s*&\s*ca\b/i.test(context.productName?.trim() ?? "");
}

function isGelatoEuHomeStationeryProduct(
	context: Exclude<SizeNormalizationResolverInput, string | null | undefined>,
): boolean {
	const productId = context.productId?.trim().toLowerCase() ?? "";
	const productName = context.productName?.trim() ?? "";
	return (
		productId.endsWith("-eu") ||
		/\beu\b\s*(?:[&+]\s*(?:row|rest\s+of\s+world))?/i.test(productName)
	);
}

function createApparelToken(
	rawSize: string,
	context: SizeNormalizationResolverInput,
	normalizeOptions: NormalizeSizeOptions = {},
): string | null {
	const categorySlug =
		typeof context === "string"
			? context.trim().toLowerCase()
			: context?.categorySlug?.trim().toLowerCase();
	// C809's checked supplier options are fitted-cap ranges. Other dad hats
	// can carry fixed SKU size codes, so keep this exception product-scoped.
	if (
		typeof context === "object" && context !== null &&
		context.productId?.trim().toLowerCase() === "printify:5183" &&
		categorySlug === "dad-hats" && /^(?:s\/m|l\/xl)$/i.test(rawSize.trim())
	) {
		return createReviewedGroupedApparelToken(rawSize, "baseball-caps");
	}
	const productScopedRawSize = reviewedProductScopedApparelSize(rawSize, context);
	const groupedRange = createReviewedGroupedApparelToken(productScopedRawSize, categorySlug);
	if (groupedRange) {
		return groupedRange;
	}
	if (!isKnownSize(productScopedRawSize, normalizeOptions)) {
		return null;
	}

	const normalized = normalizeSize(productScopedRawSize, normalizeOptions);
	if (!normalized) {
		return null;
	}
	if (APPAREL_MULTI_SIZE_TOKENS.has(normalized)) {
		return null;
	}

	const bucket = getApparelSizeBucket(normalized);
	if (!bucket) {
		return null;
	}

	if (bucket === "one-size") {
		return "one-size";
	}

	return `${bucket}:${slugifyOpaqueToken(normalized)}`;
}

function reviewedInkthreadableDualAgeSize(
	rawSize: string,
	context: SizeNormalizationResolverInput,
): string | null {
	if (!context || typeof context === "string" || context.supplierId !== "inkthreadable") return null;
	if (!REVIEWED_INKTHREADABLE_DUAL_AGE_PRODUCTS.has(context.productId?.trim().toLowerCase() ?? "")) return null;
	const age = rawSize.trim().match(/^(?:xs|s|m|l|xl)\s*\/\s*(3-4|5-6|7-8|9-11|12-13|12-14)$/i);
	return age ? `${age[1]}Y` : null;
}

function reviewedProductScopedApparelSize(
	rawSize: string,
	context: SizeNormalizationResolverInput,
): string {
	if (!context) {
		return rawSize;
	}

	const reviewedAge = reviewedInkthreadableDualAgeSize(rawSize, context);
	if (reviewedAge !== null) return reviewedAge;
	const normalizedRawSize = rawSize.trim().toLowerCase();
	if (typeof context !== "string") {
		const aliasRule = resolveReviewedProductSizeAliasRule({
			sizeClass: "apparel",
			productId: context.productId,
			supplierId: context.supplierId,
			categorySlug: context.categorySlug,
		});
		const aliased = aliasRule?.aliases[normalizedRawSize];
		if (aliased) return aliased;
	}
	// These exact Gelato junior styles expose nominal year ranges. Preserve
	// the range in the existing youth namespace, without inferring alpha fit.
	if (
		typeof context !== "string" &&
		(context.productId === "gelato:kids-hooded-sweatshirt-tee-jays-5152b" ||
			context.productId === "gelato:kids-regular-fit-t-shirt-tee-jays-1140b") &&
		(normalizedRawSize === "4-6" || normalizedRawSize === "8-10")
	) {
		return `${normalizedRawSize}Y`;
	}
	const options = resolveNormalizeSizeOptions(context);
	if (options.apparelAgeGroupHint === "youth" || options.allowYouthFallbackFromToddlerContext) {
		return YOUTH_ALPHA_SIZE_ALIASES.get(normalizedRawSize) ?? rawSize;
	}
	return rawSize;
}

// Inkthreadable labels the only size of its single-variant products "One" or
// "ONE". Keep the reading supplier-scoped: bare "One" is not a universal alias.
function reviewedSupplierOneSizeLabel(
	context: SizeNormalizationResolverInput,
	rawSize: string,
): string | null {
	if (!context || typeof context === "string") return null;
	const supplierId = context.supplierId?.trim().toLowerCase();
	// merchOne's size ladder runs "S to XL", "2X", "3X" … on the same garments
	// it labels 2XL, 3XL elsewhere (Gildan 5000 US): "2X" there is 2XL.
	if (supplierId === "merchone") {
		const plus = /^([2-5])X$/i.exec(rawSize.trim());
		return plus ? `${plus[1]}XL` : null;
	}
	if (supplierId !== "inkthreadable") return null;
	return rawSize.trim().toLowerCase() === "one" ? "One Size" : null;
}

function createReviewedGroupedApparelToken(
	rawSize: string,
	categorySlug: string | null | undefined,
): string | null {
	if (
		!categorySlug ||
		(!REVIEWED_HEADWEAR_RANGE_CATEGORIES.has(categorySlug) &&
			!REVIEWED_GROUPED_APPAREL_RANGE_CATEGORIES.has(categorySlug))
	) {
		return null;
	}
	const match = rawSize.trim().match(GROUPED_APPAREL_SIZE_RE);
	if (!match) return null;
	const inheritedXlLeft =
		/^\d+$/.test(captureGroup(match, 1)) && /^\d+xl$/i.test(captureGroup(match, 2))
			? `${match[1]}XL`
			: captureGroup(match, 1);
	// A hyphenated single size such as "one-size" is not a grouped range.
	// Probe without reporting its fragments as unknown supplier sizes.
	if (!isKnownSize(inheritedXlLeft) || !isKnownSize(captureGroup(match, 2))) return null;
	const left = normalizeSize(inheritedXlLeft);
	const right = normalizeSize(captureGroup(match, 2));
	const leftIndex = ORDERED_GROUPED_APPAREL_SIZES.findIndex(size => size === left);
	const rightIndex = ORDERED_GROUPED_APPAREL_SIZES.findIndex(size => size === right);
	if (leftIndex < 0 || rightIndex <= leftIndex) return null;
	const token = slugifyOpaqueToken(`${left}/${right}`);
	if (REVIEWED_HEADWEAR_RANGE_CATEGORIES.has(categorySlug)) {
		return `headwear:${token}`;
	}
	return categorySlug === "socks" ? `sock-range:${token}` : `adult-range:${token}`;
}

function createFootwearToken(
	rawSize: string,
	context: SizeNormalizationResolverInput,
): string | null {
	const alphaMatch = rawSize.trim().match(FOOTWEAR_ALPHA_SIZE_RE);
	if (alphaMatch) {
		return `alpha:${captureGroup(alphaMatch, 1).toLowerCase()}`;
	}

	const kidsMatch = rawSize.trim().match(FOOTWEAR_US_KIDS_SIZE_RE);
	if (kidsMatch) {
		return `us-kids:${kidsMatch[1]}`;
	}

	const audienceMatch = rawSize.trim().match(FOOTWEAR_SYSTEM_AUDIENCE_SIZE_RE);
	if (audienceMatch) {
		const system = captureGroup(audienceMatch, 1).toLowerCase();
		const audience =
			normalizeFootwearAudience(audienceMatch[4]) ??
			inferFootwearAudienceFromContext(context);
		const systemToken = audience ? `${system}-${audience}` : system;
		const token = audienceMatch[3]
			? `${audienceMatch[2]}-${audienceMatch[3]}`
			: captureGroup(audienceMatch, 2);
		return `${systemToken}:${token}`;
	}

	const systemMatch = rawSize.trim().match(FOOTWEAR_SYSTEM_SIZE_RE);
	if (!systemMatch) return null;
	const system = captureGroup(systemMatch, 1).toLowerCase();
	const token = [captureGroup(systemMatch, 2), systemMatch[3]?.toLowerCase()]
		.filter(Boolean)
		.join("-");
	return `${system}:${token}`;
}

function inferFootwearAudienceFromContext(
	context: SizeNormalizationResolverInput,
): string | null {
	if (!context || typeof context === "string") return null;
	const productName = context.productName?.trim() ?? "";
	if (/\bwomen(?:['’]s)?\b/i.test(productName)) return "womens";
	if (/\bmen(?:['’]s)?\b/i.test(productName)) return "mens";
	if (/\b(?:kid(?:['’]s)?|kids|children|youth)\b/i.test(productName)) return "kids";
	return null;
}

function normalizeFootwearAudience(rawAudience: string | undefined): string | null {
	if (!rawAudience) return null;
	const normalized = rawAudience.toLowerCase().replace(/[’']/g, "");
	if (normalized === "mens") return "mens";
	if (normalized === "womens") return "womens";
	if (normalized === "kids" || normalized === "kid") return "kids";
	if (normalized === "youth") return "youth";
	if (normalized === "unisex") return "unisex";
	return null;
}

function isReviewedNonSizeApparelAxis(
	context: SizeNormalizationResolverInput,
	rawSize: string,
): boolean {
	const categorySlug =
		typeof context === "string"
			? context.trim().toLowerCase()
			: context?.categorySlug?.trim().toLowerCase();
	const normalizedValue = rawSize.trim().toLowerCase();

	if (
		categorySlug &&
		[
			"baseball-caps",
			"caps",
			"dad-hats",
			"hats",
			"snapbacks",
			"trucker-hats",
			"visors",
		].includes(categorySlug) &&
		normalizedValue === "adjustable"
	) {
		return true;
	}

	return (
		categorySlug === "socks" &&
		["3/4 crew", "ankle", "crew"].includes(normalizedValue)
	);
}

function createDrinkwareCapacityToken(rawSize: string): string | null {
	if (
		CAPACITY_PACK_COUNT_RE.test(rawSize) ||
		MULTI_CAPACITY_RE.test(rawSize)
	) {
		return null;
	}

	const reviewedCaseToken = resolveReviewedSizeEquivalenceToken("capacity", rawSize);
	if (reviewedCaseToken) {
		return reviewedCaseToken;
	}

	const ozMatches = extractCapacityTokens(rawSize, CAPACITY_OZ_RE);
	const mlMatches = extractCapacityTokens(rawSize, CAPACITY_ML_RE);
	const ozToken = getSingleUniqueToken(
		ozMatches
			.map((token) => formatOzNumber(token))
			.filter((token): token is string => token !== null),
	);
	const mlToken = createDeterministicDrinkwareMlToken(
		rawSize,
		ozMatches.length > 0 ? "mixed-label" : "nominal-only",
	);

	if (ozToken && mlToken) {
		return ozToken === mlToken ? ozToken : null;
	}

	if (ozToken) {
		return ozToken;
	}

	if (mlMatches.length > 0) {
		return mlToken;
	}

	const fallbackOzToken = formatOzValue(rawSize);
	if (!fallbackOzToken) {
		return null;
	}

	return fallbackOzToken;
}

function createPetCapacityToken(rawSize: string): string | null {
	if (CAPACITY_PACK_COUNT_RE.test(rawSize)) {
		return null;
	}

	const ozMatches = extractCapacityTokens(rawSize, CAPACITY_OZ_RE);
	const mlMatches = extractCapacityTokens(rawSize, CAPACITY_ML_RE);
	const ozToken = getSingleUniqueToken(
		ozMatches
			.map((token) => formatOzNumber(token))
			.filter((token): token is string => token !== null),
	);
	const mlToken = createDeterministicPetMlToken(rawSize);

	if (ozMatches.length > 0 && ozToken === null) {
		return null;
	}

	if (mlMatches.length > 0 && mlToken === null && ozMatches.length === 0) {
		return null;
	}

	if (ozToken && mlToken) {
		return ozToken === mlToken ? ozToken : null;
	}

	if (ozToken) {
		return ozToken;
	}

	if (mlMatches.length > 0) {
		return mlToken;
	}

	return null;
}

function normalizeDeviceFitCandidate(rawSize: string): string {
	return stripSourceLocalDeviceFitSuffix(rawSize)
		.replace(/[®™]/g, "")
		.replace(/[‐‑‒–—―]/g, "-")
		.replace(/\+/g, " plus ")
		.replace(/\s+/g, " ")
		.trim();
}

function stripSourceLocalDeviceFitSuffix(rawSize: string): string {
	return rawSize.replace(/\s+with\s+gift\s+packaging\s*$/i, "").trim();
}

function formatOrdinal(numericValue: string): string {
	const parsed = Number(numericValue);
	if (!Number.isInteger(parsed)) {
		return numericValue;
	}

	const lastTwoDigits = parsed % 100;
	if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
		return `${parsed}th`;
	}

	switch (parsed % 10) {
		case 1:
			return `${parsed}st`;
		case 2:
			return `${parsed}nd`;
		case 3:
			return `${parsed}rd`;
		default:
			return `${parsed}th`;
	}
}

function createIphoneDeviceFitToken(rawSize: string): string | null {
	const normalized = normalizeDeviceFitCandidate(rawSize)
		.toLowerCase()
		.replace(DEVICE_VENDOR_PREFIX_RE, "");
	// Apple calls this model "iPhone Air" while POD suppliers commonly expose
	// the same case fit as "iPhone 17 Air". Preserve the established token so
	// both exact selector labels remain comparable across suppliers.
	if (normalized === "iphone air") {
		return "iphone-17-air";
	}

	const xFamilyMatch = normalized.match(/^iphone[\s-]+(x|xr|xs)(?:[\s-]*(max))?$/i);
	if (xFamilyMatch) {
		const model = xFamilyMatch[1];
		const suffix = xFamilyMatch[2]?.replace(/[\s-]+/g, "-") ?? null;
		return suffix ? `iphone-${model}-${suffix}` : `iphone-${model}`;
	}

	const seMatch = normalized.match(/^iphone[\s-]+se\s*(?:\(?\s*(\d+)(?:st|nd|rd|th)?\s*(?:gen(?:eration)?)?\s*\)?)?$/i);
	if (seMatch) {
		const generationNumber = seMatch[1];
		if (!generationNumber) {
			return null;
		}

		return `iphone-se-${formatOrdinal(generationNumber)}-generation`;
	}

	const match = normalized.match(
		/^iphone[\s-]*(\d+)(?:[\s-]*(e|air|mini|plus|pro(?:[\s-]*max)?))?$/i,
	);
	if (!match) {
		return null;
	}

	const modelNumber = match[1];
	// Gelato writes "iphone-15promax"; every other supplier separates Pro Max.
	const suffix = match[2]?.toLowerCase().replace(/^pro[\s-]*max$/, "pro max").replace(/[\s-]+/g, "-") ?? null;
	if (suffix === "e") {
		return `iphone-${modelNumber}e`;
	}
	return suffix ? `iphone-${modelNumber}-${suffix}` : `iphone-${modelNumber}`;
}

function createGalaxyDeviceFitToken(rawSize: string): string | null {
	const normalized = normalizeDeviceFitCandidate(rawSize)
		.toLowerCase()
		.replace(DEVICE_VENDOR_PREFIX_RE, "");

	const sOrAMatch = normalized.match(
		/^galaxy[\s-]+([sa])[\s-]*(\d+)(?:[\s-]*(e|fe|fan[\s-]*edition|plus|ultra|5g))?$/i,
	);
	if (sOrAMatch) {
		const series = sOrAMatch[1];
		const modelNumber = sOrAMatch[2];
		const rawSuffix = sOrAMatch[3]?.replace(/[\s-]+/g, "-") ?? null;
		const suffix = rawSuffix === "fan-edition" ? "fe" : rawSuffix;
		const family = suffix === "e" ? `${series}${modelNumber}e` : `${series}${modelNumber}`;
		if (!suffix || suffix === "e") {
			return `samsung-galaxy-${family}`;
		}

		return `samsung-galaxy-${family}-${suffix}`;
	}

	const noteMatch = normalized.match(
		/^galaxy[\s-]+note[\s-]*(\d+)(?:[\s-]*(plus|ultra))?$/i,
	);
	if (noteMatch) {
		const modelNumber = noteMatch[1];
		const suffix = noteMatch[2]?.replace(/[\s-]+/g, "-") ?? null;
		return suffix
			? `samsung-galaxy-note-${modelNumber}-${suffix}`
			: `samsung-galaxy-note-${modelNumber}`;
	}

	const zMatch = normalized.match(
		/^galaxy[\s-]+z[\s-]*(flip|fold)[\s-]*(\d+)(?:[\s-]*(5g))?$/i,
	);
	if (!zMatch) {
		return null;
	}

	const formFactor = zMatch[1];
	const modelNumber = zMatch[2];
	const suffix = zMatch[3]?.replace(/[\s-]+/g, "-") ?? null;
	return suffix
		? `samsung-galaxy-z-${formFactor}-${modelNumber}-${suffix}`
		: `samsung-galaxy-z-${formFactor}-${modelNumber}`;
}

function createPixelDeviceFitToken(rawSize: string): string | null {
	const normalized = normalizeDeviceFitCandidate(rawSize)
		.toLowerCase()
		.replace(DEVICE_VENDOR_PREFIX_RE, "");
	if (normalized === "pixel" || normalized === "google pixel") {
		return "google-pixel";
	}
	if (normalized === "pixel xl" || normalized === "google pixel xl") {
		return "google-pixel-xl";
	}
	const match = normalized.match(/^pixel[\s-]*(\d+(?:a)?)(?:[\s-]*(5g|pro(?:[\s-]*xl)?|xl))?$/i);
	if (!match) {
		return null;
	}

	const modelNumber = match[1];
	const suffix = match[2]?.replace(/[\s-]+/g, "-") ?? null;
	return suffix
		? `google-pixel-${modelNumber}-${suffix}`
		: `google-pixel-${modelNumber}`;
}

function createReviewedLegacyIphoneCompatibilitySetToken(rawSize: string): string | null {
	const normalized = normalizeReviewedIphoneCompatibilityLabel(rawSize);
	return lookupReviewedLegacyIphoneCompatibilitySet(normalized) ?? null;
}

function normalizeReviewedIphoneCompatibilityLabel(rawSize: string): string {
	return normalizeDeviceFitCandidate(rawSize)
		.toLowerCase()
		.replace(DEVICE_VENDOR_PREFIX_RE, "")
		.replace(/\s*\/\s*/g, "/")
		.replace(/\s*,\s*/g, ", ")
		.trim();
}

function createReviewedProductDeviceFitToken(
	rawSize: string,
	context: SizeNormalizationResolverInput,
): string | null {
	if (!context || typeof context === "string") {
		return null;
	}

	const normalized = normalizeReviewedIphoneCompatibilityLabel(rawSize);
	const aliasRule = resolveReviewedProductSizeAliasRule({
		sizeClass: "device-fit",
		productId: context.productId,
		supplierId: context.supplierId,
	});
	return aliasRule?.aliases[normalized] ?? null;
}

function createAirpodsDeviceFitToken(rawSize: string): string | null {
	const normalized = normalizeDeviceFitCandidate(rawSize).toLowerCase();
	const namedModel = /^airpods(?:\s+(pro))?\s+(\d+)$/i.exec(normalized);
	if (namedModel) return `apple-airpods${namedModel[1] ? "-pro" : ""}-${namedModel[2]}`;
	const match = normalized.match(
		/^airpods(?:\s+(pro))?(?:\s+gen(?:eration)?\s*(\d+))?$/i,
	);
	if (!match) return null;
	const family = match[1] ? "apple-airpods-pro" : "apple-airpods";
	return match[2] ? `${family}-generation-${Number(match[2])}` : family;
}

function createAppleWatchDeviceFitToken(rawSize: string, context: SizeNormalizationResolverInput): string | null {
	if (!context || typeof context === "string" || context.categorySlug !== "watch-bands") return null;
	// A watch case size or range as labelled ("38mm", "38 - 41 mm"): literal fit,
	// no claim about which other case sizes the band also fits.
	const caseRange = /^(\d{2})\s*(?:-\s*(\d{2})\s*)?mm$/i.exec(rawSize.trim());
	if (caseRange) return `watch-case-${caseRange[1]}${caseRange[2] ? `-${caseRange[2]}` : ""}mm`;
	if (!/apple watch band/i.test(context.productName ?? "")) return null;
	const literalSet = /^\d+mm(?:\/\d+mm)+$/i.test(rawSize);
	return literalSet ? `apple-watch-${rawSize.toLowerCase().replaceAll("/", "-")}` : null;
}

/** A laptop sleeve labelled 13″ fits a 13-inch laptop: the screen class, not a length. */
function createLaptopScreenFitToken(rawSize: string, context: SizeNormalizationResolverInput): string | null {
	if (!context || typeof context === "string" || context.categorySlug !== "laptop-sleeves") return null;
	const inches = /^(\d{1,2}(?:\.\d)?)\s*(?:″|"|''|in|inch|inches)$/i.exec(rawSize.trim());
	return inches ? `laptop-${captureGroup(inches, 1).replace(".", "-")}in` : null;
}

function createMacbookDeviceFitToken(rawSize: string): string | null {
	const normalized = normalizeDeviceFitCandidate(rawSize).toLowerCase();
	const match = normalized.match(/^macbook\s+(air|pro)\s+(\d+(?:\.\d+)?)$/i);
	if (!match) return null;
	return `apple-macbook-${match[1]}-${captureGroup(match, 2).replace(".", "-")}`;
}

function createIpadDeviceFitToken(rawSize: string): string | null {
	const normalized = normalizeDeviceFitCandidate(rawSize).toLowerCase();
	return lookupReviewedIpadDeviceFitAlias(normalized) ?? null;
}

function createDeviceFitToken(
	rawSize: string,
	context: SizeNormalizationResolverInput,
): string | null {
	const trimmed = stripSourceLocalDeviceFitSuffix(rawSize.trim());
	if (
		trimmed === "" ||
		isStrictTwoDimensionalSize(trimmed) ||
		THREE_DIMENSION_RE.test(trimmed)
	) {
		return null;
	}

	const reviewedCompatibilitySet = createReviewedLegacyIphoneCompatibilitySetToken(trimmed);
	if (reviewedCompatibilitySet) {
		return reviewedCompatibilitySet;
	}
	const reviewedProductToken = createReviewedProductDeviceFitToken(
		trimmed,
		context,
	);
	if (reviewedProductToken) {
		return reviewedProductToken;
	}
	const exactNonPhoneDeviceToken =
		createLaptopScreenFitToken(trimmed, context) ??
		createAppleWatchDeviceFitToken(trimmed, context) ??
		createAirpodsDeviceFitToken(trimmed) ??
		createMacbookDeviceFitToken(trimmed) ??
		createIpadDeviceFitToken(trimmed);
	if (exactNonPhoneDeviceToken) {
		return exactNonPhoneDeviceToken;
	}

	if (
		DEVICE_MULTI_DELIMITER_RE.test(trimmed) ||
		DEVICE_AMBIGUOUS_TERM_RE.test(trimmed)
	) {
		return null;
	}

	return (
		createIphoneDeviceFitToken(trimmed) ??
		createGalaxyDeviceFitToken(trimmed) ??
		createPixelDeviceFitToken(trimmed)
	);
}

function createHomeStationeryToken(
	rawSize: string,
	entry: SizeNormalizationRegistryEntry,
	context: SizeNormalizationResolverInput,
): string | null {
	const printifyFormatToken = createPrintifyHomeStationeryFormatToken(
		rawSize,
		context,
	);
	if (printifyFormatToken) {
		return printifyFormatToken;
	}

	const gelatoFormatToken = createGelatoCardPaperFormatToken(rawSize, context) ??
		createGelatoHomeStationeryFormatToken(rawSize, context);
	if (gelatoFormatToken) {
		return gelatoFormatToken;
	}

	const inkthreadableCardToken = createInkthreadableCardFormatToken(rawSize, context);
	if (inkthreadableCardToken) {
		return inkthreadableCardToken;
	}

	const prefersPaperFormat = entry.supportedExamples.some((example) =>
		isNamedPaperSize(example),
	);
	if (prefersPaperFormat) {
		const paperFormatToken = createHomeStationeryPaperFormatToken(rawSize);
		if (paperFormatToken) {
			return paperFormatToken;
		}

		if (hasReviewedPaperFamilySignal(rawSize)) {
			return null;
		}

		return createDimensionalToken(rawSize);
	}

	return createDimensionalToken(rawSize);
}

function createPetWearableToken(
	rawSize: string,
	normalizeOptions: NormalizeSizeOptions = {},
): string | null {
	if (/[(),]/.test(rawSize) || /\b[A-Z]+\s*[-–]\s*[A-Z]+\b/i.test(rawSize)) {
		return null;
	}

	const exactAlias = PET_WEARABLE_EXACT_ALIASES.get(rawSize.trim().toUpperCase()) ?? null;
	if (exactAlias) {
		return `size:${slugifyOpaqueToken(exactAlias)}`;
	}

	if (!isKnownSize(rawSize)) {
		return null;
	}

	const normalized = normalizeSize(rawSize, normalizeOptions);
	if (!normalized || !PET_APPAREL_SIZE_TOKENS.has(normalized)) {
		return null;
	}

	return `size:${slugifyOpaqueToken(normalized)}`;
}

function createPetToken(
	rawSize: string,
	normalizeOptions: NormalizeSizeOptions = {},
): string | null {
	const capacityToken = createPetCapacityToken(rawSize);
	if (capacityToken) {
		return `capacity:${capacityToken}`;
	}

	return createPetWearableToken(rawSize, normalizeOptions);
}

type NormalizeSizeContextFields = {
	audienceAgeGroup: string | null;
	categorySlug: string | null;
	logCategorySlug: string | null;
	productName: string | null;
	supplierId: string | null;
};

function readNormalizeSizeContextFields(
	context: NonNullable<SizeNormalizationResolverInput>,
): NormalizeSizeContextFields {
	if (typeof context === "string") {
		return {
			audienceAgeGroup: null,
			categorySlug: context.trim().toLowerCase(),
			logCategorySlug: context,
			productName: null,
			supplierId: null,
		};
	}

	return {
		audienceAgeGroup: context.audienceAgeGroup?.trim().toLowerCase() ?? null,
		categorySlug: context.categorySlug?.trim().toLowerCase() ?? null,
		logCategorySlug: context.categorySlug ?? null,
		productName: context.productName?.trim().toLowerCase() ?? null,
		supplierId: context.supplierId ?? null,
	};
}

function resolveApparelAgeGroupHint(
	fields: NormalizeSizeContextFields,
): NormalizeSizeOptions["apparelAgeGroupHint"] {
	if (
		fields.audienceAgeGroup === "baby" ||
		fields.audienceAgeGroup === "toddler" ||
		fields.audienceAgeGroup === "youth"
	) {
		return fields.audienceAgeGroup;
	}
	if (fields.categorySlug === "baby-clothing" || fields.categorySlug === "bodysuits") {
		return "baby";
	}
	if (fields.categorySlug === "kids-clothing") {
		return "youth";
	}
	if (fields.productName?.includes("toddler")) {
		return "toddler";
	}
	if (/\b(kids?|youth)\b/.test(fields.productName ?? "")) {
		return "youth";
	}
	return null;
}

function resolveNormalizeSizeOptions(
	context: SizeNormalizationResolverInput,
): NormalizeSizeOptions {
	if (!context) {
		return {};
	}

	const fields = readNormalizeSizeContextFields(context);
	const apparelAgeGroupHint = resolveApparelAgeGroupHint(fields);
	const sourceNameHasKidsContext = /\bkids?\b/.test(fields.productName ?? "");

	return {
		unknownSizeLogContext: {
			supplierId: fields.supplierId,
			categorySlug: fields.logCategorySlug,
		},
		apparelAgeGroupHint,
		allowYouthFallbackFromToddlerContext:
			apparelAgeGroupHint === "toddler" && sourceNameHasKidsContext,
	};
}

function resolveNormalizationNamespace(
	entry: SizeNormalizationRegistryEntry,
): SizeNormalizationNamespace | null {
	if (entry.status === "active") {
		return entry.normalizationClass;
	}

	if (entry.status === "predecessor-complete") {
		return "wall-art";
	}

	return null;
}

const NOMINAL_WAIST_CATEGORIES = new Set([
	"bottoms",
	"joggers",
	"pants",
	"shorts",
	"sweatpants",
	"swimwear",
]);

/**
 * Bottoms sold by nominal waist label: "30" is label 30 and "3032" (work
 * pants) label 30 with a 32 inseam. These labels are not body measurements.
 * Within one canonical every listing is the
 * same garment, so the manufacturer's label is the size identity; the bounds
 * keep kids' numeric sizes (≤ 20) and women's 0–20 out.
 */
function createNominalWaistToken(
	rawSize: string,
	context: SizeNormalizationResolverInput,
): string | null {
	const categorySlug =
		typeof context === "string"
			? context.trim().toLowerCase()
			: context?.categorySlug?.trim().toLowerCase();
	if (!categorySlug || !NOMINAL_WAIST_CATEGORIES.has(categorySlug)) return null;
	const label = rawSize.trim();
	const waistOnly = /^(\d{2})$/.exec(label);
	if (waistOnly) {
		const waist = Number(waistOnly[1]);
		return waist >= 24 && waist <= 60 ? `waist:${waist}` : null;
	}
	const waistInseam = /^(\d{2})(\d{2})$/.exec(label);
	if (!waistInseam || categorySlug !== "pants") return null;
	const waist = Number(waistInseam[1]);
	const inseam = Number(waistInseam[2]);
	return waist >= 24 && waist <= 60 && inseam >= 26 && inseam <= 38
		? `waist:${waist}:inseam:${inseam}`
		: null;
}

/** Inkthreadable labels kids sizes "L / 9-11": the age range is the size. */
function kidsAgeBesideLetterSize(rawSize: string): string | null {
	return /^\d*x{0,3}[sml]\s*\/\s*(\d+\s*-\s*\d+)$/i.exec(rawSize)?.[1] ?? null;
}

function createNormalizedToken(
	namespace: SizeNormalizationNamespace,
	rawSize: string,
	entry: SizeNormalizationRegistryEntry,
	context: SizeNormalizationResolverInput,
	normalizeOptions: NormalizeSizeOptions = {},
): string | null {
	switch (namespace) {
		case "wall-art":
			return (
				resolveReviewedSizeEquivalenceToken("wall-art", rawSize) ??
				createWallArtSupplierDimensionPairToken(rawSize) ??
				createDimensionalToken(rawSize)
			);
		case "apparel": {
			if (isReviewedNonSizeApparelAxis(context, rawSize)) {
				return null;
			}
			// Resolve exact reviewed labels before generic numeric/paired-label
			// parsing; a supplier's age suffix alone is not alpha-size authority.
			const reviewedLabel = reviewedProductScopedApparelSize(rawSize, context);
			const waist = createNominalWaistToken(reviewedLabel, context);
			if (waist) return waist;
			const sizeLabel =
				reviewedSupplierOneSizeLabel(context, reviewedLabel) ??
				kidsAgeBesideLetterSize(reviewedLabel) ??
				reviewedLabel;
			const sizeLabelIsKnown = isKnownSize(sizeLabel, normalizeOptions);
			if (
				sizeLabelIsKnown &&
				normalizeSize(sizeLabel, normalizeOptions) === "One Size" &&
				!entry.supportedExamples.includes("One Size")
			) {
				return null;
			}

			const apparelToken = createApparelToken(sizeLabel, context, normalizeOptions);
			if (!apparelToken && !sizeLabelIsKnown) {
				// Report only values no reviewed range or product alias resolved.
				normalizeSize(sizeLabel, normalizeOptions);
			}
			return apparelToken;
		}
		case "capacity":
			return createDrinkwareCapacityToken(rawSize);
		case "device-fit":
			return createDeviceFitToken(rawSize, context);
		case "footwear":
			return createFootwearToken(rawSize, context);
		case "home-stationery":
			return createHomeStationeryToken(rawSize, entry, context);
		case "pet":
			return createPetToken(rawSize, normalizeOptions);
	}
}

type CreateNormalizedSizeOptions = {
	/**
	 * Off for sizes recovered from a longer label ("Bone shape 19″×14″"): the
	 * rest of that label may be what tells two variants apart.
	 */
	readonly measuredDimension?: boolean;
};

function createNormalizedSizeValue(
	context: SizeNormalizationResolverInput,
	rawSize: string | null | undefined,
	options: CreateNormalizedSizeOptions = {},
): string | null {
	if (typeof rawSize !== "string") {
		return null;
	}

	const trimmedSize = rawSize.trim();
	if (trimmedSize === "") return null;
	if (resolveSizeNormalizationRegistryEntry(context)?.category === "puzzles") {
		return createPuzzlePieceCountValue(trimmedSize);
	}
	if (PACK_COUNT_RE.test(trimmedSize)) {
		return null;
	}

	const productRule = resolveProductScopedSizeNormalizationRule(context);
	if (productRule && context && typeof context !== "string" && context.productId) {
		const reviewedLabel = productRule.supportedLabels.find(
			label => label.toLowerCase() === trimmedSize.toLowerCase(),
		);
		if (reviewedLabel) {
			// A separate opaque namespace keeps bag letters, nominal waists,
			// [L] selectors and supplier ranges out of shared fit/capacity scales.
			return supplierSizeToken(context.productId, productRule.labelTokens?.[reviewedLabel] ?? slugifyOpaqueToken(reviewedLabel));
		}
	}

	const entry = resolveSizeNormalizationRegistryEntry(context);
	const namespace = entry ? resolveNormalizationNamespace(entry) : null;
	if (entry && namespace) {
		const normalizeOptions = resolveNormalizeSizeOptions(context);
		const token = createNormalizedToken(namespace, trimmedSize, entry, context, normalizeOptions);
		if (token) {
			return createNamespacedNormalizedValue(namespace, token);
		}
	}

	return options.measuredDimension === false
		? null
		: createMeasuredDimensionValue(context, entry, trimmedSize);
}

/**
 * A jigsaw's size selector chooses its piece count ("252 pieces",
 * "10″ × 8″ (110 pcs)", "520 pcs (Vertical)"): the count is what a seller picks
 * and what suppliers share; print dimensions and orientation vary by supplier.
 */
function createPuzzlePieceCountValue(rawSize: string): string | null {
	const match = soleMember(rawSize.matchAll(/(\d+)\s*(?:pcs?|pieces?)\b/gi));
	if (!match) return null;
	const count = Number(match[1]);
	return count > 0 ? puzzlePiecesSizeToken(count) : null;
}

const EXPLICIT_DIMENSION_UNIT_RE = /(?:\d\s*(?:mm|cm|in|inch|inches)\b|["″“”]|'')/i;
const FOOT_MARK_RE = /(?<!')'(?!')/;

/**
 * A size printed as width × height with an explicit unit is a physical
 * measurement whatever the product is: a 50" × 4" stole, a 10" × 8" mouse
 * pad, a 15" × 15" tote. Exact unit conversion makes it safe to compare, so
 * when the category's own size class has no reading for it (or the category
 * has none), it gets the shared dimensional token. Matching stays exact; a
 * picker still needs a reviewed policy that asks for size.
 */
function createMeasuredDimensionValue(
	context: SizeNormalizationResolverInput,
	entry: SizeNormalizationRegistryEntry | null,
	rawSize: string,
): string | null {
	if (!hasProductClassContext(context)) return null;
	// Deferred classes (pack counts) and wall art, whose sizes are already decided.
	if (entry?.status === "deferred" || entry?.status === "predecessor-complete") return null;
	if (!EXPLICIT_DIMENSION_UNIT_RE.test(rawSize) || FOOT_MARK_RE.test(rawSize)) return null;

	const length = createSingleLengthToken(rawSize);
	if (length) return length;
	// The home-stationery class already read width × height labels its own way.
	if (entry?.status === "active" && entry.normalizationClass === "home-stationery") return null;
	const candidate = normalizeDimensionCandidate(rawSize);
	if (!SIMPLE_DIMENSION_RE.test(candidate)) return null;
	const token = createDimensionalToken(candidate);
	return token ? createNamespacedNormalizedValue("home-stationery", token) : null;
}

const SINGLE_LENGTH_RE = /^\s*(\d+(?:\.\d+)?)\s*(″|"|“|”|''|in|inch|inches|mm|cm)\s*$/i;

/**
 * One measurement with its unit: a pin's 1.25″ diameter, an award's 8″
 * height. What it measures is the product's own (one canonical sells one kind
 * of thing), so the token only records the length, in tenths of a millimetre.
 */
function createSingleLengthToken(rawSize: string): string | null {
	const match = SINGLE_LENGTH_RE.exec(rawSize);
	if (!match) return null;
	const value = Number(match[1]);
	const unit = captureGroup(match, 2).toLowerCase();
	const millimetres = unit === "mm" ? value : unit === "cm" ? value * 10 : value * 25.4;
	return millimetres > 0 ? lengthSizeToken(Math.round(millimetres * 10)) : null;
}

function hasProductClassContext(context: SizeNormalizationResolverInput): boolean {
	if (!context) return false;
	if (typeof context === "string") return context.trim() !== "";
	return Boolean(context.categorySlug?.trim() || context.specType?.trim());
}

export function createNormalizedVariantSizeValue(
	context: SizeNormalizationResolverInput,
	variantSize: string | null | undefined,
	options?: CreateNormalizedSizeOptions,
): string | null {
	return createNormalizedSizeValue(context, variantSize, options);
}
