/**
 * Zod-free primitive guards shared by boundary parsers that must stay out of
 * client static closures. Type-predicate guards keep runtime `typeof` checks
 * out of ordinary control flow.
 */

export function isBooleanValue(value: unknown): value is boolean {
  return typeof value === "boolean";
}

export function isNumberValue(value: unknown): value is number {
  return typeof value === "number";
}

export function isFiniteNumberValue(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isBigIntValue(value: unknown): value is bigint {
  return typeof value === "bigint";
}

/** Proves only object identity; arrays and class instances are included. */
export function isObjectValue(value: unknown): value is object {
  return typeof value === "object" && value !== null;
}
