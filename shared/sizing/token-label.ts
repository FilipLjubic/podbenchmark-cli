import { createClosedStringLookup } from "../kernel/closed-string-lookup";

/**
 * A readable label for a slug-like token's last segment ("dtg" reads "DTG",
 * "matte-black" reads "Matte Black"). The generic fallback for picker values
 * and size tokens that keep no better wording.
 */
export function formatTokenLabel(value: string): string {
  const cleaned = value.trim();
  if (!cleaned) return cleaned;

  const token = cleaned.includes(":") ? cleaned.split(":").at(-1)! : cleaned;
  const normalized = token.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  const lower = normalized.toLowerCase();
  const fullLabel = lookupTokenLabelOverride(lower);
  if (fullLabel) return fullLabel;

  return normalized
    .split(" ")
    .map(
      word => lookupTokenWordOverride(word.toLowerCase()) ?? capitalize(word)
    )
    .join(" ");
}

function capitalize(value: string): string {
  if (!value) return value;
  return `${value[0]!.toUpperCase()}${value.slice(1).toLowerCase()}`;
}

const TOKEN_LABEL_OVERRIDES = {
  cmyk: "CMYK",
  dtf: "DTF",
  dtg: "DTG",
  rgb: "RGB",
  uv: "UV",
  uvgel: "UVgel",
  giclee: "Giclée",
} as const satisfies Readonly<Record<string, string>>;

const TOKEN_WORD_OVERRIDES = {
  cmyk: "CMYK",
  dtf: "DTF",
  dtg: "DTG",
  uv: "UV",
} as const satisfies Readonly<Record<string, string>>;

const lookupTokenLabelOverride = createClosedStringLookup<string>(
  TOKEN_LABEL_OVERRIDES
);

const lookupTokenWordOverride =
  createClosedStringLookup<string>(TOKEN_WORD_OVERRIDES);

/** "12" stays "12", 11.75 reads "11.8". */
export function formatCompactNumber(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(1).replace(/\.0$/, "");
}
