/**
 * FNV-1a hash variants. Their outputs feed stored keys, fingerprints and cache
 * keys, so each variant keeps the bytes its call sites already produce: they
 * differ only in how a string is walked and in how the digest is written.
 */

/** 32-bit FNV-1a over UTF-16 code units, as a signed integer. */
export function fnv1a32(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash | 0;
}

/** `fnv1a32` written as eight lowercase hexadecimal digits. */
export function fnv1a32Hex(value: string): string {
  return (fnv1a32(value) >>> 0).toString(16).padStart(8, "0");
}

/**
 * `for...of` over the string, so an astral character contributes only its
 * leading surrogate. A caller that sampled with this loop keeps it: its keys
 * would otherwise change for identifiers containing an astral character.
 */
export function fnv1a32HexLeadingCodeUnits(value: string): string {
  let hash = 0x811c9dc5;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * 32-bit FNV-1a over Unicode code points, as a signed integer: an astral
 * character hashes as one value instead of two surrogates.
 */
export function fnv1a32CodePoints(value: string): number {
  let hash = 0x811c9dc5;
  for (const character of value) {
    hash = Math.imul(hash ^ (character.codePointAt(0) ?? 0), 0x01000193);
  }
  return hash | 0;
}

const FNV1A_64_OFFSET = 0xcbf29ce484222325n;
const FNV1A_64_PRIME = 0x100000001b3n;
const UINT_64_MASK = 0xffffffffffffffffn;

/** 64-bit FNV-1a over UTF-16 code units, as sixteen hexadecimal digits. */
export function fnv1a64Hex(value: string): string {
  let hash = FNV1A_64_OFFSET;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= BigInt(value.charCodeAt(index));
    hash = (hash * FNV1A_64_PRIME) & UINT_64_MASK;
  }
  return hash.toString(16).padStart(16, "0");
}
