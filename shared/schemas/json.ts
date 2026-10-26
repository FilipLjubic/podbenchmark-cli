import { z } from "zod";

/**
 * String-keyed record schema for deliberately ungoverned traversal and
 * diagnostics. It proves only record-ness; nested values remain unknown.
 * Where fields are known, prefer the owning domain schema.
 *
 * Browser/client import paths must use the zod-free helpers in `record.ts`
 * instead so zod stays out of client static closures.
 */
export const UnknownRecordSchema = z.record(z.string(), z.unknown());
export type UnknownRecord = z.infer<typeof UnknownRecordSchema>;

export {
  parseUnknownRecordArray,
  parseUnknownRecordOrEmpty,
  readUnknownRecord,
} from "./record";

/**
 * Strict recursive JSON contracts. Zod owns the recursive policy so shared
 * callers use the same finite-number and nested-value semantics.
 */
export const JsonValueSchema = z.json();
export type JsonValue = z.infer<typeof JsonValueSchema>;

export const JsonObjectSchema = z.record(z.string(), JsonValueSchema);
export type JsonObject = z.infer<typeof JsonObjectSchema>;

/**
 * Intermediate value emitted by generic walkers before serialization.
 * `undefined` remains available because object walkers may omit it during
 * `JSON.stringify` instead of converting it to `null`.
 */
export type JsonTraversalValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | JsonTraversalValue[]
  | { [key: string]: JsonTraversalValue };

/**
 * Normalize one traversal leaf. Primitive values, including `undefined`, pass
 * through; symbols, bigints, functions, and objects become `undefined` for the
 * caller's recursive walker to omit or replace.
 */
function isJsonTraversalPrimitive(
  value: unknown
): value is string | number | boolean | null | undefined {
  return (
    value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

export const readJsonTraversalPrimitive = (
  value: unknown
): JsonTraversalValue => {
  return isJsonTraversalPrimitive(value) ? value : undefined;
};

/** Validate traversal evidence without cloning it; preserve absent properties and shared references. */
export function isJsonTraversalValue(
  value: unknown
): value is JsonTraversalValue {
  const active = new WeakSet<object>();
  const checked = new WeakSet<object>();
  function validateEvidenceNode(entry: unknown): entry is JsonTraversalValue {
    if (entry === null || entry === undefined) return true;
    switch (typeof entry) {
      case "string":
      case "boolean":
        return true;
      case "number":
        return Number.isFinite(entry);
      case "object": {
        if (active.has(entry)) return false;
        if (checked.has(entry)) return true;
        const prototype = Object.getPrototypeOf(entry);
        if (
          !Array.isArray(entry) &&
          prototype !== Object.prototype &&
          prototype !== null
        )
          return false;
        active.add(entry);
        const valid = Object.values(entry).every(validateEvidenceNode);
        active.delete(entry);
        if (valid) checked.add(entry);
        return valid;
      }
      default:
        return false;
    }
  }
  return validateEvidenceNode(value);
}

export const JsonTraversalValueSchema = z.custom<JsonTraversalValue>(
  isJsonTraversalValue,
  "Expected finite JSON values or absent properties."
);

export const JsonTraversalObjectSchema = z.record(z.string(), JsonTraversalValueSchema);
export type JsonTraversalObject = z.infer<typeof JsonTraversalObjectSchema>;
