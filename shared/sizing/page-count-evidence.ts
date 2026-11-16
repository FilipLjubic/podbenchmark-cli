import { isTextValue } from "../kernel/text";

const PAGE_COUNT_MODIFIER =
	"(?:single|blank|dotted|ruled|line|lined|perforated|or|and)";

const PAGE_COUNT_RE = new RegExp(
	`\\b(\\d{2,4})\\s+(?:(?:${PAGE_COUNT_MODIFIER})[\\s,/-]+){0,12}pages?\\b`,
	"gi",
);

const PREFIXED_PAGE_COUNT_RE =
	/\bpages?\s*:\s*(\d{2,4})\b/gi;
const PREFIXED_SHEET_COUNT_RE =
	/\bpages?\s*:\s*(\d{2,4})\s+[^.]*?\bsheets?\b/gi;
const HYPHENATED_PAGE_RANGE_RE =
	/\b\d{1,4}\s*[-–]\s*\d{1,4}\s+pages?\b/gi;

function positiveInteger(value: string): number | null {
	const parsed = Number.parseInt(value, 10);
	return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function collectMatches(text: string, pattern: RegExp, output: Set<number>): void {
	pattern.lastIndex = 0;
	for (const match of text.matchAll(pattern)) {
		const count = positiveInteger(match[1] ?? "");
		if (count !== null) output.add(count);
	}
}

export function parseExplicitPageCountsFromText(value: unknown): number[] {
	if (!isTextValue(value)) return [];
	const text = value.replace(HYPHENATED_PAGE_RANGE_RE, " ");
	const counts = new Set<number>();
	collectMatches(text, PAGE_COUNT_RE, counts);
	collectMatches(text, PREFIXED_PAGE_COUNT_RE, counts);
	collectMatches(text, PREFIXED_SHEET_COUNT_RE, counts);
	return [...counts].sort((left, right) => left - right);
}

export function parseExplicitPageCountFromText(value: unknown): number | null {
	const counts = parseExplicitPageCountsFromText(value);
	return counts.length === 1 ? (counts[0] ?? null) : null;
}
