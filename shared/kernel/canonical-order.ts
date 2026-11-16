/** Locale-independent UTF-8 byte ordering, matching PostgreSQL COLLATE "C". */
const UTF8_ENCODER = new TextEncoder();

export function compareUtf8Bytes(left: string, right: string): number {
	if (left === right) return 0;

	const codeUnitLength = Math.min(left.length, right.length);
	for (let index = 0; index < codeUnitLength; index += 1) {
		const leftCodeUnit = left.charCodeAt(index);
		const rightCodeUnit = right.charCodeAt(index);
		if (leftCodeUnit === rightCodeUnit) continue;

		// UTF-8 preserves ASCII byte order, and every non-ASCII sequence starts
		// above ASCII. Most runtime keys and IDs therefore need no allocations.
		if (leftCodeUnit <= 0x7f || rightCodeUnit <= 0x7f) {
			return leftCodeUnit - rightCodeUnit;
		}
		return compareEncodedUtf8Bytes(left, right);
	}

	// Equal UTF-16 prefixes also have equal UTF-8 prefixes, including the
	// replacement encoding TextEncoder uses for matching lone surrogates.
	return left.length - right.length;
}

function compareEncodedUtf8Bytes(left: string, right: string): number {
	const leftBytes = UTF8_ENCODER.encode(left);
	const rightBytes = UTF8_ENCODER.encode(right);
	const length = Math.min(leftBytes.length, rightBytes.length);
	for (let index = 0; index < length; index += 1) {
		const difference = (leftBytes[index] ?? 0) - (rightBytes[index] ?? 0);
		if (difference !== 0) return difference;
	}
	const lengthDifference = leftBytes.length - rightBytes.length;
	if (lengthDifference !== 0) return lengthDifference;
	return left < right ? -1 : left > right ? 1 : 0;
}

/** UTF-8 byte length with TextEncoder-compatible lone-surrogate handling. */export function utf8ByteLength(value: string): number {
	let bytes = 0;
	for (let index = 0; index < value.length; index += 1) {
		const codeUnit = value.charCodeAt(index);
		if (codeUnit <= 0x7f) {
			bytes += 1;
		} else if (codeUnit <= 0x7ff) {
			bytes += 2;
		} else if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
			const nextCodeUnit = value.charCodeAt(index + 1);
			if (nextCodeUnit >= 0xdc00 && nextCodeUnit <= 0xdfff) {
				bytes += 4;
				index += 1;
			} else {
				bytes += 3;
			}
		} else {
			bytes += 3;
		}
	}
	return bytes;
}

/**
 * Human-facing name and label ordering: case- and accent-insensitive `en`
 * collation. Every catalog list that shows strings to a seller sorts with this
 * one comparator so the same pair of names never orders differently.
 */
export function compareBaseFoldedStrings(left: string, right: string): number {
	return left.localeCompare(right, "en", { sensitivity: "base" });
}

/**
 * Ascending numbers with a missing value last: the order every list that ranks
 * rows by a possibly absent price or transit time sorts with, so the same pair
 * of rows never orders two ways.
 */
export function compareNullableNumbers(
	left: number | null,
	right: number | null
): number {
	if (left !== null && right !== null) return left - right;
	if (left !== null) return -1;
	if (right !== null) return 1;
	return 0;
}

/** The distinct values, in `compareBaseFoldedStrings` order. */
export function uniqueSortedStrings(values: readonly string[]): string[] {
	return [...new Set(values)].sort(compareBaseFoldedStrings);
}
