const REVIEWED_SIZE_EQUIVALENCE_POLICY_SLICES = [
	"capacity",
	"wall-art",
	"home-stationery",
] as const;

export type ReviewedSizeEquivalencePolicySlice =
	(typeof REVIEWED_SIZE_EQUIVALENCE_POLICY_SLICES)[number];

const REVIEWED_SIZE_EQUIVALENCE_BUCKETS = [
	"exact",
	"supplier-declared-pair",
	"reviewed-nominal-alias",
	"advisory-only",
	"separate-class",
] as const;

type ReviewedSizeEquivalenceBucket =
	(typeof REVIEWED_SIZE_EQUIVALENCE_BUCKETS)[number];

type ReviewedSizeEquivalencePolicyCase = {
	readonly id: string;
	readonly slice: ReviewedSizeEquivalencePolicySlice;
	readonly bucket: Exclude<ReviewedSizeEquivalenceBucket, "advisory-only">;
	readonly normalizedValue: string;
	readonly supportedExamples: readonly string[];
	readonly nullKeyExamples: readonly string[];
	readonly sourceOfTruthSignals: readonly string[];
	readonly provenance: readonly string[];
	readonly rationale: string;
};

type ReviewedSizeEquivalencePolicySliceEntry = {
	readonly rationale: string;
	readonly sourceOfTruthSignals: readonly string[];
	readonly cases: readonly ReviewedSizeEquivalencePolicyCase[];
};

const REVIEWED_SIZE_EQUIVALENCE_POLICY_DOC =
	"docs/architecture/variant-selection.md#reviewed-size-equivalence-policy";

const CAPACITY_ML_EXAMPLE_RE = /^(\d+(?:\.\d+)?)\s*ml$/i;
const CAPACITY_ML_TOKEN_RE = /(\d+(?:\.\d+)?)\s*ml\b/gi;

const REVIEWED_PAPER_FAMILY_ALIASES = new Map<string, string>([
	["a0", "paper:a0"],
	["a1", "paper:a1"],
	["a2", "paper:a2"],
	["a3", "paper:a3"],
	["a4", "paper:a4"],
	["a5", "paper:a5"],
	["letter", "paper:letter"],
	["legal", "paper:legal"],
	["tabloid", "paper:tabloid"],
	["ledger", "paper:ledger"],
]);

const REVIEWED_PAPER_FAMILY_SIGNAL_RE = new RegExp(
	`\\b(?:${[...REVIEWED_PAPER_FAMILY_ALIASES.keys()].join("|")})\\b`,
	"i",
);

function normalizePolicyExample(value: string): string {
	return value
		.trim()
		.replace(/[×]/g, "x")
		.replace(/\s+/g, " ")
		.replace(/(\d+(?:\.\d+)?)\s+(ml|oz)\b/gi, "$1$2")
		.replace(/\s*\/\s*/g, " / ")
		.toLowerCase();
}

function createPolicyLookupKey(slice: ReviewedSizeEquivalencePolicySlice, rawSize: string): string {
	return `${slice}:${normalizePolicyExample(rawSize)}`;
}

function stripSlicePrefix(
	slice: ReviewedSizeEquivalencePolicySlice,
	normalizedValue: string,
): string | null {
	const prefix = `${slice}:`;
	return normalizedValue.startsWith(prefix)
		? normalizedValue.slice(prefix.length)
		: null;
}

function createCapacityMlLookup(
	buckets: readonly ReviewedSizeEquivalenceBucket[],
	options: {
		allowEmbeddedMlTokens: boolean;
	},
): Map<number, string> {
	const allowedBuckets = new Set(buckets);
	const lookup = new Map<number, string>();

	for (const entry of SIZE_EQUIVALENCE_POLICY_SLICE_REGISTRY.capacity.cases) {
		if (!allowedBuckets.has(entry.bucket)) {
			continue;
		}

		const token = stripSlicePrefix("capacity", entry.normalizedValue);
		if (!token) {
			continue;
		}

		for (const example of entry.supportedExamples) {
			const normalizedExample = normalizePolicyExample(example);
			const mlMatches = options.allowEmbeddedMlTokens
				? Array.from(normalizedExample.matchAll(CAPACITY_ML_TOKEN_RE), (match) => match[1])
				: [normalizedExample.match(CAPACITY_ML_EXAMPLE_RE)?.[1] ?? null];

			for (const rawMatch of mlMatches) {
				if (!rawMatch) {
					continue;
				}

				const numericToken = Number(rawMatch);
				if (!Number.isFinite(numericToken)) {
					continue;
				}

				lookup.set(Math.round(numericToken), token);
			}
		}
	}

	return lookup;
}

export const SIZE_EQUIVALENCE_POLICY_SLICE_REGISTRY = {
	capacity: {
		rationale:
			"Capacity policy captures only reviewed ml/oz equivalence decisions and leaves direct unit parsing in the existing runtime until the consumer refactor lands.",
		sourceOfTruthSignals: [
			"shared/sizing/variant-size-normalization.ts currently holds the legacy ml-to-oz alias authority",
			"shared/sizing/variant-size-normalization.test.ts freezes approved strict drinkware aliases and conflict nulls",
			`${REVIEWED_SIZE_EQUIVALENCE_POLICY_DOC} keeps reviewed nominal aliases policy-owned, not parser guesswork`,
		],
		cases: [
			{
				id: "capacity-11oz-reviewed-nominal",
				slice: "capacity",
				bucket: "reviewed-nominal-alias",
				normalizedValue: "capacity:11oz",
				supportedExamples: ["11 oz", "11oz", "325 ml"],
				nullKeyExamples: ["500 ml", "2-pack 11oz mugs"],
				sourceOfTruthSignals: [
					"325 ml already normalizes to capacity:11oz in the runtime",
					"11oz is the current deterministic drinkware reference size for mugs",
				],
				provenance: [
					REVIEWED_SIZE_EQUIVALENCE_POLICY_DOC,
					"shared/sizing/variant-size-normalization.ts:102-116",
					"shared/sizing/variant-size-normalization.test.ts:126-143",
				],
				rationale:
					"325 ml is an approved marketed-equivalent alias for the repo's 11oz drinkware comparison bucket.",
			},
			{
				id: "capacity-15oz-reviewed-nominal",
				slice: "capacity",
				bucket: "reviewed-nominal-alias",
				normalizedValue: "capacity:15oz",
				supportedExamples: ["15 oz", "15oz", "443 ml", "444 ml"],
				nullKeyExamples: [],
				sourceOfTruthSignals: [
					"443 ml and 444 ml are both already approved strict outputs for 15oz offerings",
				],
				provenance: [
					REVIEWED_SIZE_EQUIVALENCE_POLICY_DOC,
					"shared/sizing/variant-size-normalization.ts:102-116",
				],
				rationale:
					"POD drinkware markets 443 ml and 444 ml as the same comparable 15oz offering.",
			},
			{
				id: "capacity-15oz-prodigi-supplier-pair",
				slice: "capacity",
				bucket: "supplier-declared-pair",
				normalizedValue: "capacity:15oz",
				supportedExamples: ["426ml / 15oz", "426 ml / 15 oz"],
				nullKeyExamples: ["426ml", "426 ml"],
				sourceOfTruthSignals: [
					"Prodigi's stored product option declares 426ml and 15oz as one marketed large-mug variant",
					"Prodigi's current product page identifies the same large ceramic mug as 15oz",
				],
				provenance: [
					REVIEWED_SIZE_EQUIVALENCE_POLICY_DOC,
					"https://www.prodigi.com/products/home-and-living/drinkware/large-ceramic-mugs/",
				],
				rationale:
					"The exact supplier-declared pair is safe as a 15oz offering; bare 426ml remains unreviewed so this exception cannot become a global conversion rule.",
			},
			{
				id: "capacity-16oz-prodigi-supplier-pair",
				slice: "capacity",
				bucket: "supplier-declared-pair",
				normalizedValue: "capacity:16oz",
				supportedExamples: ["454ml / 16oz", "454 ml / 16 oz"],
				nullKeyExamples: ["454ml", "454 ml"],
				sourceOfTruthSignals: [
					"Prodigi's stored product option declares 454ml and 16oz as one marketed travel-mug variant",
					"Prodigi's current product page identifies the same metal travel mug as 16oz",
				],
				provenance: [
					REVIEWED_SIZE_EQUIVALENCE_POLICY_DOC,
					"https://www.prodigi.com/products/home-and-living/drinkware/metal-travel-mugs/",
				],
				rationale:
					"The exact supplier-declared pair is safe as a 16oz offering; bare 454ml remains unreviewed so this exception cannot become a global conversion rule.",
			},
			{
				id: "capacity-20oz-reviewed-nominal",
				slice: "capacity",
				bucket: "reviewed-nominal-alias",
				normalizedValue: "capacity:20oz",
				supportedExamples: [
					"20 oz",
					"20oz",
					"590 ml",
					"591 ml",
					"600 ml",
					"20 oz (591 ml)",
				],
				nullKeyExamples: ["650ml / 20oz"],
				sourceOfTruthSignals: [
					"590 ml, 591 ml, and 600 ml are already approved strict outputs for 20oz offerings",
				],
				provenance: [
					REVIEWED_SIZE_EQUIVALENCE_POLICY_DOC,
					"shared/sizing/variant-size-normalization.ts:102-116",
				],
				rationale:
					"The repo already treats 590-600 ml marketed labels as the reviewed 20oz comparison family.",
			},
			{
				id: "capacity-22oz-supplier-pair",
				slice: "capacity",
				bucket: "supplier-declared-pair",
				normalizedValue: "capacity:22oz",
				supportedExamples: ["650ml / 22oz", "650 ml / 22 oz"],
				nullKeyExamples: ["650ml / 20oz", "650 ml / 20 oz"],
				sourceOfTruthSignals: [
					"paired-label capacity inputs are only safe when both sides agree on one reviewed offering",
				],
				provenance: [
					REVIEWED_SIZE_EQUIVALENCE_POLICY_DOC,
					"shared/sizing/variant-size-normalization.test.ts:136-143",
				],
				rationale:
					"A supplier-declared paired label can stay strict when the marketed ml and oz labels agree on one offering.",
			},
		],
	},
	"wall-art": {
		rationale:
			"Wall-art policy keeps the live predecessor-complete dimensional path strict for exact 2D equality, moves approved supplier-paired labels into reviewed policy, and leaves nominal marketed labels review-only until explicitly approved.",
		sourceOfTruthSignals: [
			"shared/sizing/variant-size-normalization.ts preserves deterministic wall-art dimensional equality while policy owns approved mixed-label exceptions",
			"shared/sizing/variant-size-normalization.test.ts freezes exact dimensional equivalence and mixed-label nulls",
			`${REVIEWED_SIZE_EQUIVALENCE_POLICY_DOC} keeps wall-art predecessor-complete with explicit supplier-pair cases only`,
		],
		cases: [
			{
				id: "wall-art-12x16-exact",
				slice: "wall-art",
				bucket: "exact",
				normalizedValue: "wall-art:dim:3048x4064",
				supportedExamples: ["12x16", "12 x 16 in", "12 × 16 in", "30.48 x 40.64 cm"],
				nullKeyExamples: ["16x12", "12x16x1.5"],
				sourceOfTruthSignals: [
					"exact unit conversion already produces one deterministic wall-art token",
					"wall-art remains the existing normalized size predecessor surface",
				],
				provenance: [
					REVIEWED_SIZE_EQUIVALENCE_POLICY_DOC,
					"shared/sizing/variant-size-normalization.test.ts:12-29",
				],
				rationale:
					"Exact metric and imperial dimension conversion stays strict for the same physical wall-art size.",
			},
			{
				id: "wall-art-12x16-supplier-pair",
				slice: "wall-art",
				bucket: "supplier-declared-pair",
				normalizedValue: "wall-art:dim:3048x4064",
				supportedExamples: ["300x400-mm-12x16-inch"],
				nullKeyExamples: [],
				sourceOfTruthSignals: [
					"supplier-declared metric+imperial pair labels are already preserved in wall-art regression tests",
				],
				provenance: [
					REVIEWED_SIZE_EQUIVALENCE_POLICY_DOC,
					"shared/sizing/variant-size-normalization.test.ts:19-29",
				],
				rationale:
					"Explicit paired metric and imperial labels can stay strict for wall-art only when the reviewed policy explicitly approves the supplier-declared pair.",
			},
			{
				id: "wall-art-12x18-supplier-pair",
				slice: "wall-art",
				bucket: "supplier-declared-pair",
				normalizedValue: "wall-art:dim:3048x4572",
				supportedExamples: ["300x450-mm-12x18-inch"],
				nullKeyExamples: [],
				sourceOfTruthSignals: [
					"supplier-declared metric+imperial pair labels are already preserved for wall-art reviewed pairs",
				],
				provenance: [
					"local Gelato canvas ProductVariant size labels use 300x450-mm-12x18-inch for the 12x18 normalized canvas value",
				],
				rationale:
					"Gelato declares the metric and marketed imperial dimensions together; the marketed 12x18 label should match the 12x18 wall-art normalized value.",
			},
			{
				id: "wall-art-gelato-a4-8x12-supplier-pair",
				slice: "wall-art",
				bucket: "supplier-declared-pair",
				normalizedValue: "wall-art:dim:2032x3048",
				supportedExamples: ["a4-8x12-inch"],
				nullKeyExamples: [],
				sourceOfTruthSignals: [
					"Gelato flat and hanger poster UIDs expose a4-8x12-inch as one supplier-declared wall-art size token",
					"Gelato framed-poster UIDs pair 210x297mm-8x12-inch frame dimensions with a4-8x12-inch print dimensions for the same variant size slot",
				],
				provenance: [
					"local Gelato wall-art ProductVariant supplierVariantId values include flat_a4-8x12-inch_* and wall_hanging_poster_*_a4-8x12-inch_* labels",
				],
				rationale:
					"The mixed A4/8x12 Gelato label is approved only as this supplier-declared wall-art pair, using the same marketed 8x12 comparison key as the reviewed 210x297mm-8x12-inch Gelato pair rather than broad ISO-paper collapse.",
			},
			{
				id: "wall-art-5x7-gelato-5r-supplier-pair",
				slice: "wall-art",
				bucket: "supplier-declared-pair",
				normalizedValue: "wall-art:dim:1270x1778",
				supportedExamples: ["130x180-mm-5r"],
				nullKeyExamples: [],
				sourceOfTruthSignals: [
					"Gelato framed-poster UIDs pair 130x180-mm-5x7-inch frame dimensions with 130x180-mm-5r poster dimensions for the same variant size slot",
				],
				provenance: [
					"local Gelato wall-art ProductVariant supplierVariantId values include both 130x180-mm-5x7-inch and 130x180-mm-5r for the same physical 5x7 size family",
				],
				rationale:
					"Gelato's 5R label is accepted only for the observed 130x180-mm supplier pair, mapping to the supplier-declared 5x7 comparison size without broadening arbitrary nominal labels.",
			},
			{
				id: "wall-art-gelato-xl-explicit-metric",
				slice: "wall-art",
				bucket: "exact",
				normalizedValue: "wall-art:dim:2794x4293",
				supportedExamples: ["280x430-mm-xl"],
				nullKeyExamples: [],
				sourceOfTruthSignals: [
					"Gelato flat and hanger poster UIDs expose 280x430-mm-xl with an exact metric dimension before the nominal XL suffix",
				],
				provenance: [
					"local Gelato wall-art ProductVariant supplierVariantId values include flat_280x430-mm-xl_* and wall_hanging_poster_*_280x430-mm-xl_* labels",
				],
				rationale:
					"The XL suffix is ignored only for this reviewed Gelato label because the supplier provides an exact 280 x 430 mm dimensional value in the same size token.",
			},
		],
	},
	"home-stationery": {
		rationale:
			"Home-stationery policy freezes the distinction between deterministic paper-family tokens and generic dimensions so paper standards do not collapse into wall-art-style dimensional aliases.",
		sourceOfTruthSignals: [
			"shared/sizing/variant-size-normalization.ts already keeps paper-family tokens under a paper: namespace",
			"shared/sizing/variant-size-normalization.test.ts freezes home-stationery paper-family behavior",
			`${REVIEWED_SIZE_EQUIVALENCE_POLICY_DOC} protects paper-family standards from generic dimensional aliases`,
		],
		cases: [
			{
				id: "home-stationery-a4-separate-class",
				slice: "home-stationery",
				bucket: "separate-class",
				normalizedValue: "home-stationery:paper:a4",
				supportedExamples: ["A4"],
				nullKeyExamples: ["a4-8x12-inch"],
				sourceOfTruthSignals: [
					"A4 already normalizes into the paper-family namespace rather than generic dimensions",
				],
				provenance: [
					REVIEWED_SIZE_EQUIVALENCE_POLICY_DOC,
					"shared/sizing/variant-size-normalization.ts:123-147",
				],
				rationale:
					"A4 is a reviewed paper-family token that stays strict only inside the home-stationery paper class.",
			},
			{
				id: "home-stationery-letter-separate-class",
				slice: "home-stationery",
				bucket: "separate-class",
				normalizedValue: "home-stationery:paper:letter",
				supportedExamples: ["Letter"],
				nullKeyExamples: ["Letter / 8.5 x 11 in"],
				sourceOfTruthSignals: [
					"US paper standards already normalize into the dedicated paper-family namespace",
				],
				provenance: [
					REVIEWED_SIZE_EQUIVALENCE_POLICY_DOC,
					"shared/sizing/variant-size-normalization.ts:130-147",
				],
				rationale:
					"Letter remains a paper-family token instead of collapsing into generic dimensional equality.",
			},
			{
				id: "home-stationery-legal-separate-class",
				slice: "home-stationery",
				bucket: "separate-class",
				normalizedValue: "home-stationery:paper:legal",
				supportedExamples: ["Legal"],
				nullKeyExamples: ["Legal / 8.5 x 14 in"],
				sourceOfTruthSignals: [
					"US paper standards already normalize into the dedicated paper-family namespace",
				],
				provenance: [
					REVIEWED_SIZE_EQUIVALENCE_POLICY_DOC,
					"shared/sizing/variant-size-normalization.ts:260-292",
				],
				rationale:
					"Legal remains a protected paper-family token and does not collapse into generic home-stationery dimensions.",
			},
			{
				id: "home-stationery-tabloid-separate-class",
				slice: "home-stationery",
				bucket: "separate-class",
				normalizedValue: "home-stationery:paper:tabloid",
				supportedExamples: ["Tabloid"],
				nullKeyExamples: ["Tabloid / 11 x 17 in"],
				sourceOfTruthSignals: [
					"US paper standards already normalize into the dedicated paper-family namespace",
				],
				provenance: [
					REVIEWED_SIZE_EQUIVALENCE_POLICY_DOC,
					"shared/sizing/variant-size-normalization.ts:260-292",
				],
				rationale:
					"Tabloid remains a protected paper-family token and does not collapse into generic home-stationery dimensions.",
			},
			{
				id: "home-stationery-ledger-separate-class",
				slice: "home-stationery",
				bucket: "separate-class",
				normalizedValue: "home-stationery:paper:ledger",
				supportedExamples: ["Ledger"],
				nullKeyExamples: ["Ledger / 17 x 11 in"],
				sourceOfTruthSignals: [
					"US paper standards already normalize into the dedicated paper-family namespace",
				],
				provenance: [
					REVIEWED_SIZE_EQUIVALENCE_POLICY_DOC,
					"shared/sizing/variant-size-normalization.ts:260-292",
				],
				rationale:
					"Ledger remains a protected paper-family token and does not collapse into generic home-stationery dimensions.",
			},
		],
	},
} as const satisfies Record<
	ReviewedSizeEquivalencePolicySlice,
	ReviewedSizeEquivalencePolicySliceEntry
>;

const SIZE_EQUIVALENCE_POLICY_CASES = [
	...SIZE_EQUIVALENCE_POLICY_SLICE_REGISTRY.capacity.cases,
	...SIZE_EQUIVALENCE_POLICY_SLICE_REGISTRY["wall-art"].cases,
	...SIZE_EQUIVALENCE_POLICY_SLICE_REGISTRY["home-stationery"].cases,
] as const;

const sizeEquivalencePolicyCaseLookup = new Map(
	SIZE_EQUIVALENCE_POLICY_CASES.flatMap((entry) =>
		entry.supportedExamples.map((rawSize) => [
			createPolicyLookupKey(entry.slice, rawSize),
			entry,
		] as const),
	),
);

const reviewedNominalCapacityMlLookup = createCapacityMlLookup([
	"reviewed-nominal-alias",
], {
	allowEmbeddedMlTokens: false,
});

const reviewedMixedCapacityMlLookup = createCapacityMlLookup([
	"reviewed-nominal-alias",
	"supplier-declared-pair",
], {
	allowEmbeddedMlTokens: true,
});

export function resolveReviewedSizeEquivalenceCase(
	slice: ReviewedSizeEquivalencePolicySlice,
	rawSize: string | null | undefined,
): ReviewedSizeEquivalencePolicyCase | null {
	if (typeof rawSize !== "string") {
		return null;
	}

	return sizeEquivalencePolicyCaseLookup.get(createPolicyLookupKey(slice, rawSize)) ?? null;
}

export function resolveReviewedSizeEquivalenceToken(
	slice: ReviewedSizeEquivalencePolicySlice,
	rawSize: string | null | undefined,
): string | null {
	const policyCase = resolveReviewedSizeEquivalenceCase(slice, rawSize);
	if (!policyCase) {
		return null;
	}

	return stripSlicePrefix(slice, policyCase.normalizedValue);
}

export function resolveReviewedCapacityNominalTokenForMl(
	mlValue: number,
): string | null {
	return reviewedNominalCapacityMlLookup.get(Math.round(mlValue)) ?? null;
}

export function resolveReviewedCapacityMixedLabelTokenForMl(
	mlValue: number,
): string | null {
	return reviewedMixedCapacityMlLookup.get(Math.round(mlValue)) ?? null;
}

export function resolveReviewedPaperFamilyToken(
	rawSize: string | null | undefined,
): string | null {
	if (typeof rawSize !== "string") {
		return null;
	}

	return REVIEWED_PAPER_FAMILY_ALIASES.get(normalizePolicyExample(rawSize)) ?? null;
}

export function hasReviewedPaperFamilySignal(
	rawSize: string | null | undefined,
): boolean {
	if (typeof rawSize !== "string") {
		return false;
	}

	return REVIEWED_PAPER_FAMILY_SIGNAL_RE.test(normalizePolicyExample(rawSize));
}

