/**
 * Shared text-presence predicates for boundary decoders. "Non-blank" means a
 * string with at least one non-whitespace character; a decoder that must also
 * reject surrounding whitespace uses `isTrimmedNonBlankString`.
 */
export function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * A non-empty string that carries no surrounding whitespace: the value is
 * already trimmed, not merely non-blank.
 */
export function isTrimmedNonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.trim() === value;
}

export function isTextValue(value: unknown): value is string {
  return typeof value === "string";
}

export function readNonBlankString(value: unknown): string | null {
  return isNonBlankString(value) ? value.trim() : null;
}
