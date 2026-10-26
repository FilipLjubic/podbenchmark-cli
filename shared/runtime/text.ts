/**
 * Shared text-presence predicates for boundary decoders. "Non-blank" means a
 * string with at least one non-whitespace character; callers that require
 * already-trimmed input keep their narrower local predicates.
 */
export function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function isTextValue(value: unknown): value is string {
  return typeof value === "string";
}

export function readNonBlankString(value: unknown): string | null {
  return isNonBlankString(value) ? value.trim() : null;
}
