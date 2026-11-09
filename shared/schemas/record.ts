/**
 * Zod-free record parsing for client/browser import paths. `json.ts` keeps the
 * zod schemas, but any module that can be pulled into a browser static closure
 * must import these helpers instead so zod stays out of that bundle.
 */

export type UnknownRecord = Record<string, unknown>;

/** A plain object: non-null, not an array, no class prototype to leak. */
type ObjectRecord = { [key: string]: unknown };

function isObjectRecordValue(value: unknown): value is ObjectRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  // Parsed JSON and module namespaces are plain (or null-prototype) records;
  // a Date, Error, or class instance is not one, so callers still see absence.
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * Narrow `value` to a plain string-keyed record, returning `null` for
 * non-records. Use where the caller must distinguish an absent record from an
 * empty one; nested values remain unknown. This is a check, not a copy:
 * callers read the object they were given and must never assign to its keys.
 */
export const readUnknownRecord = (value: unknown): UnknownRecord | null =>
  isObjectRecordValue(value) ? value : null;

/**
 * Parse `value` as a string-keyed record, tolerating non-records as `{}`.
 * The tolerant omission is explicit by name.
 */
export const parseUnknownRecordOrEmpty = (value: unknown): UnknownRecord =>
  readUnknownRecord(value) ?? {};

/**
 * Parse each entry of an array as a string-keyed record, dropping other entries.
 * Returns the parsed objects together with the number of entries dropped, so
 * corrupt input is counted rather than silently vanishing.
 */
export const parseUnknownRecordArray = (value: unknown): {
  objects: UnknownRecord[];
  dropped: number;
} => {
  if (!Array.isArray(value)) return { objects: [], dropped: 0 };
  const objects: UnknownRecord[] = [];
  let dropped = 0;
  for (const item of value) {
    const parsed = readUnknownRecord(item);
    if (parsed) objects.push(parsed);
    else dropped += 1;
  }
  return { objects, dropped };
};
