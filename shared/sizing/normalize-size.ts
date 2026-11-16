import {
	ADULT_APPAREL_SIZES,
	ADULT_TALL_APPAREL_SIZES,
	APPROVED_APPAREL_ONE_SIZE_VALUES,
	type ApparelSizeBucket,
	BABY_APPAREL_SIZES,
	CANONICAL_SIZES,
	type CanonicalSize,
	SIZE_ALIASES,
	TODDLER_APPAREL_SIZES,
	YOUTH_APPAREL_SIZES,
} from "../data/size-aliases";
import { createClosedStringLookup } from "../kernel/closed-string-lookup";

export type UnknownSizeLogContext = {
	supplierId?: string | null;
	categorySlug?: string | null;
};

type ApparelAgeGroupHint = "baby" | "toddler" | "youth";

export type NormalizeSizeOptions = {
	unknownSizeLogContext?: UnknownSizeLogContext | null;
	apparelAgeGroupHint?: ApparelAgeGroupHint | null;
	allowYouthFallbackFromToddlerContext?: boolean;
};

type UnknownSizeReporter = (
	size: string,
	context?: UnknownSizeLogContext | null,
) => void;

let unknownSizeReporter: UnknownSizeReporter | null = null;

const canonicalSizeSet: ReadonlySet<string> = new Set(CANONICAL_SIZES);
const isCanonicalSize = (value: string): value is CanonicalSize =>
	canonicalSizeSet.has(value);
const lookupSizeAlias = createClosedStringLookup(SIZE_ALIASES);
const adultApparelSizeSet: ReadonlySet<string> = new Set(ADULT_APPAREL_SIZES);
const adultTallApparelSizeSet: ReadonlySet<string> = new Set(ADULT_TALL_APPAREL_SIZES);
const youthApparelSizeSet: ReadonlySet<string> = new Set(YOUTH_APPAREL_SIZES);
const toddlerApparelSizeSet: ReadonlySet<string> = new Set(TODDLER_APPAREL_SIZES);
const babyApparelSizeSet: ReadonlySet<string> = new Set(BABY_APPAREL_SIZES);
const approvedApparelOneSizeSet: ReadonlySet<string> = new Set(APPROVED_APPAREL_ONE_SIZE_VALUES);
const monthSizedApparelRe = /^\d+(?:[-/]\d+)?\s*(?:m|months?)$/i;
const toddlerSizedApparelRe = /^(?:toddler\s+)?\d+t$/i;
const newbornSizedApparelRe = /^(?:n\/?b|newborn)$/i;
const parenthesizedBabyOrToddlerSizeRe = /^\s*[0-9]+\s*\(([^()]+)\)\s*$/i;
const YEAR_SUFFIX_RE = /\s*(?:years?|yrs?|yr|y)\s*$/i;
const WHITESPACE_RE = /\s+/g;
const DIMENSIONAL_LIKE_SIZE_RE =
	/^\d+(?:\.\d+)?\s*[×x]\s*\d+(?:\.\d+)?\s*(?:mm|cm|in|inch|inches)?$/i;
const unknownSizeSummaryByScope = new Map<string, Map<string, number>>();
let unknownSizeSummaryHookRegistered = false;

const TODDLER_CONTEXTUAL_SIZE_MAP = new Map<string, CanonicalSize>([
	["1-2", "1-2T"],
	["2", "2T"],
	["2-3", "2-3T"],
	["3", "3T"],
	["3-4", "3-4T"],
	["4", "4T"],
	["4-5", "4-5T"],
	["5", "5T"],
	["5-6", "5-6T"],
	["6", "6T"],
]);

const BABY_CONTEXTUAL_SIZE_MAP = new Map<string, CanonicalSize>([
	["0-3", "0-3M"],
	["0-6", "0-6M"],
	["3-6", "3-6M"],
	["6-9", "6-9M"],
	["6-12", "6-12M"],
	["9-12", "9-12M"],
	["12-18", "12-18M"],
	["18-23", "18-23M"],
	["18-24", "18-24M"],
	["24-36", "24-36M"],
]);

const YOUTH_EXPLICIT_RANGE_SIZE_MAP = new Map<string, CanonicalSize>([
	["3-4", "3-4Y"],
	["5-6", "5-6Y"],
	["6-8", "6-8Y"],
	["7-8", "7-8Y"],
	["9-10", "9-10Y"],
	["9-11", "9-11Y"],
	["11-12", "11-12Y"],
	["12-13", "12-13Y"],
	["12-14", "12-14Y"],
]);

const YOUTH_CONTEXTUAL_SINGLE_SIZE_MAP = new Map<string, CanonicalSize>([
	["4a", "4Y"],
	["6", "6Y"],
	["6a", "6Y"],
	["6x", "6X"],
	["7", "7Y"],
	["8", "8Y"],
	["8a", "8Y"],
	["10", "10Y"],
	["10a", "10Y"],
	["12", "12Y"],
	["12a", "12Y"],
	["14", "14Y"],
	["14a", "14Y"],
	["16", "16Y"],
	["18", "18Y"],
	["20", "20Y"],
]);

function normalizeChildSizeToken(size: string): string {
	return size
		.trim()
		.replace(YEAR_SUFFIX_RE, "")
		.replace(WHITESPACE_RE, "")
		.replace(/\//g, "-")
		.toLowerCase();
}

function resolveContextualApparelSize(
	size: string,
	options: NormalizeSizeOptions,
): CanonicalSize | null {
	const normalizedToken = normalizeChildSizeToken(size);
	const hasExplicitYearSuffix = YEAR_SUFFIX_RE.test(size);
	const hint = options.apparelAgeGroupHint ?? null;

	// Explicit year labels describe toddler/youth sizing even when a broad
	// canonical category is currently tagged as baby. Keep this ahead of the
	// baby-context return so values such as "2-3 yrs" do not become unknown.
	if (
		hasExplicitYearSuffix &&
		(normalizedToken === "1-2" || normalizedToken === "2-3")
	) {
		return TODDLER_CONTEXTUAL_SIZE_MAP.get(normalizedToken) ?? null;
	}
	if (hint === "baby") {
		return BABY_CONTEXTUAL_SIZE_MAP.get(normalizedToken) ?? null;
	}

	if (hint === "toddler") {
		const toddlerSize = TODDLER_CONTEXTUAL_SIZE_MAP.get(normalizedToken) ?? null;
		if (toddlerSize) return toddlerSize;
		if (options.allowYouthFallbackFromToddlerContext) {
			return YOUTH_CONTEXTUAL_SINGLE_SIZE_MAP.get(normalizedToken) ?? null;
		}
		return null;
	}

	const explicitYouthRange = YOUTH_EXPLICIT_RANGE_SIZE_MAP.get(normalizedToken) ?? null;
	if (explicitYouthRange) {
		return explicitYouthRange;
	}

	if (normalizedToken === "1-2") {
		return "1-2T";
	}

	if (normalizedToken === "2-3") {
		return "2-3T";
	}

	if (hint === "youth") {
		return YOUTH_CONTEXTUAL_SINGLE_SIZE_MAP.get(normalizedToken) ?? null;
	}

	return null;
}

function isDimensionalLikeSize(size: string): boolean {
	const normalized = size
		.trim()
		.replace(/["″“”'']/g, "")
		.replace(/[′‘’]/g, "")
		.replace(/\s+/g, " ");

	return DIMENSIONAL_LIKE_SIZE_RE.test(normalized);
}

function buildUnknownSizeScopeKey(context: UnknownSizeLogContext): string | null {
	const supplierId = context.supplierId?.trim();
	const categorySlug = context.categorySlug?.trim();
	if (!supplierId || !categorySlug) {
		return null;
	}

	return `${supplierId}\u0000${categorySlug}`;
}

function ensureUnknownSizeSummaryExitHook(): void {
	if (
		unknownSizeSummaryHookRegistered ||
		typeof process === "undefined" ||
		typeof process.once !== "function"
	) {
		return;
	}

	process.once("exit", () => {
		flushUnknownSizeSummary();
	});
	unknownSizeSummaryHookRegistered = true;
}

function recordUnknownSizeSummary(size: string, context: UnknownSizeLogContext | null | undefined): void {
	if (!context) {
		return;
	}

	const scopeKey = buildUnknownSizeScopeKey(context);
	if (!scopeKey) {
		return;
	}

	ensureUnknownSizeSummaryExitHook();

	const scopedEntries = unknownSizeSummaryByScope.get(scopeKey) ?? new Map<string, number>();
	scopedEntries.set(size, (scopedEntries.get(size) ?? 0) + 1);
	unknownSizeSummaryByScope.set(scopeKey, scopedEntries);
}

export function setUnknownSizeReporter(reporter: UnknownSizeReporter | null): void {
	unknownSizeReporter = reporter;
}

function reportUnknownSize(
	size: string,
	context: UnknownSizeLogContext | null | undefined,
): void {
	unknownSizeReporter?.(size, context);
}

export function resetUnknownSizeSummary(): void {
	unknownSizeSummaryByScope.clear();
}

export function flushUnknownSizeSummary(
	logger: (message: string) => void = console.warn,
): void {
	if (unknownSizeSummaryByScope.size === 0) {
		return;
	}

	logger("[normalize-size] Unknown size summary");

	const sortedScopes = Array.from(unknownSizeSummaryByScope.entries()).sort(([leftKey], [rightKey]) =>
		leftKey.localeCompare(rightKey),
	);

	for (const [scopeKey, values] of sortedScopes) {
		const [supplierId, categorySlug] = scopeKey.split("\u0000");
		const sortedValues = Array.from(values.entries()).sort((left, right) => {
			if (right[1] !== left[1]) {
				return right[1] - left[1];
			}

			return left[0].localeCompare(right[0]);
		});
		const totalCount = sortedValues.reduce((sum, [, count]) => sum + count, 0);

		logger(
			`  - supplier=${supplierId} category=${categorySlug} total=${totalCount} unique=${sortedValues.length}`,
		);
		for (const [value, count] of sortedValues) {
			logger(`    - "${value}" × ${count}`);
		}
	}

	resetUnknownSizeSummary();
}

const resolveCanonicalSize = (
	size: string,
	options: NormalizeSizeOptions = {},
): CanonicalSize | null => {
	const trimmed = size.trim();
	const lowerTrimmed = trimmed.toLowerCase();

	const directAlias = lookupSizeAlias(trimmed);
	if (directAlias) {
		return directAlias;
	}

	const lowerAlias = lookupSizeAlias(lowerTrimmed);
	if (lowerAlias) {
		return lowerAlias;
	}

	if (isCanonicalSize(trimmed)) {
		return trimmed;
	}

	const contextualCanonicalSize = resolveContextualApparelSize(trimmed, options);
	if (contextualCanonicalSize) {
		return contextualCanonicalSize;
	}

	const parenthesizedMatch = trimmed.match(parenthesizedBabyOrToddlerSizeRe);
	if (!parenthesizedMatch) {
		return null;
	}

	const innerSize = parenthesizedMatch[1]?.trim();
	if (!innerSize) {
		return null;
	}

	const resolvedInnerSize = resolveCanonicalSize(innerSize, options);
	if (!resolvedInnerSize) {
		return null;
	}

	return babyApparelSizeSet.has(resolvedInnerSize) || toddlerApparelSizeSet.has(resolvedInnerSize)
		? resolvedInnerSize
		: null;
};

export const normalizeSize = (
	size: string | null | undefined,
	options: NormalizeSizeOptions = {},
): string | null => {
	if (!size || size.trim() === "") {
		return null;
	}

	const trimmed = size.trim();
	const canonicalSize = resolveCanonicalSize(trimmed, options);
	if (canonicalSize) {
		return canonicalSize;
	}

	const isDimensional = isDimensionalLikeSize(trimmed);
	const isCapacity = /^\d+oz/.test(trimmed);
	const isMonthSizedApparel = monthSizedApparelRe.test(trimmed);
	const isToddlerSizedApparel = toddlerSizedApparelRe.test(trimmed);
	const isNewbornSizedApparel = newbornSizedApparelRe.test(trimmed);

	if (
		!isDimensional &&
		!isCapacity &&
		!isMonthSizedApparel &&
		!isToddlerSizedApparel &&
		!isNewbornSizedApparel
	) {
		recordUnknownSizeSummary(trimmed, options.unknownSizeLogContext);
		reportUnknownSize(trimmed, options.unknownSizeLogContext);
	}

	return trimmed;
};

export const isKnownSize = (
	size: string,
	options: NormalizeSizeOptions = {},
): boolean => {
	return resolveCanonicalSize(size, options) !== null;
};

export const getApparelSizeBucket = (
	size: string | null | undefined,
	options: NormalizeSizeOptions = {},
): ApparelSizeBucket | null => {
	const normalized = normalizeSize(size, options);
	if (!normalized) {
		return null;
	}

	if (adultApparelSizeSet.has(normalized)) {
		return "adult";
	}

	if (adultTallApparelSizeSet.has(normalized)) {
		return "adult-tall";
	}

	if (youthApparelSizeSet.has(normalized)) {
		return "youth";
	}

	if (toddlerApparelSizeSet.has(normalized)) {
		return "toddler";
	}

	if (babyApparelSizeSet.has(normalized)) {
		return "baby";
	}

	if (approvedApparelOneSizeSet.has(normalized)) {
		return "one-size";
	}

	return null;
};
