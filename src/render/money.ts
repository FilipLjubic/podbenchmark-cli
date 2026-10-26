import { isSupplierId, SUPPLIER_NAMES } from "shared/runtime/suppliers";

const formatters = new Map<string, Intl.NumberFormat>();
const formatter = (currency: string) => {
  const cached = formatters.get(currency);
  if (cached) return cached;
  const created = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  });
  formatters.set(currency, created);
  return created;
};

export const UNKNOWN = "—";

/** A price; unknown is "—", never 0. */
export const money = (amount: number | null | undefined, currency: string) =>
  amount === null || amount === undefined
    ? UNKNOWN
    : formatter(currency).format(amount);

/** A difference with its sign, such as "+$0.36". */
export const signedMoney = (
  amount: number | null | undefined,
  currency: string
) => {
  if (amount === null || amount === undefined) return UNKNOWN;
  const rounded = Math.round(amount * 100) / 100;
  if (rounded === 0) return formatter(currency).format(0);
  return `${rounded > 0 ? "+" : "-"}${formatter(currency).format(Math.abs(rounded))}`;
};

export const days = (min: number | null, max: number | null) => {
  if (min === null && max === null) return UNKNOWN;
  const low = min ?? max;
  const high = max ?? min;
  return low === high ? `${low} days` : `${low}–${high} days`;
};

export const DESTINATION_NAMES = {
  US: "the US",
  GB: "the UK",
  DE: "Germany",
  CA: "Canada",
  AU: "Australia",
} as const;

/** `2026-09-30T00:43:07.000Z` → `2026-09-30`. */
export const dateOnly = (iso: string | null) => (iso ? iso.slice(0, 10) : null);

const dayFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const yearFormat = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  timeZone: "UTC",
});
/** `2026-09-30` → `Sep 30, 2026`. */
export const readableDate = (day: string) => {
  const date = new Date(`${day}T00:00:00Z`);
  return `${dayFormat.format(date)}, ${yearFormat.format(date)}`;
};
/** An ISO timestamp as `Sep 30, 2026`; null when unknown. */
export const readableDay = (iso: string | null) => {
  const day = dateOnly(iso);
  return day ? readableDate(day) : null;
};
/** `Sep 30 – Oct 21, 2026`, or one date when both are the same day. */
export const readableDateRange = (first: string, last: string) => {
  if (first === last) return readableDate(first);
  const from = new Date(`${first}T00:00:00Z`);
  const sameYear = first.slice(0, 4) === last.slice(0, 4);
  return `${sameYear ? dayFormat.format(from) : readableDate(first)} – ${readableDate(last)}`;
};

/** The hint line's command prefix. */
export const NPX = "npx podbenchmark";

/** A supplier id as people write it: `customcat` → `CustomCat`. */
export const supplierName = (id: string) => {
  const key = id.toLowerCase();
  return isSupplierId(key) ? SUPPLIER_NAMES[key] : id;
};
