/**
 * Every supplier with a live comparison data path. Lists of "all suppliers"
 * derive from this one, and per-supplier decisions are typed
 * `Record<SupplierId, …>`, so adding a supplier here makes the typecheck name
 * each decision still to make. `bun run supplier:rollout` reports the rest:
 * profile copy, pair pages, seeded facts and option links.
 */
export const SUPPLIER_IDS = [
  "customcat",
  "fourthwall",
  "gelato",
  "inkthreadable",
  "printful",
  "printify",
  "prodigi",
] as const;

export type SupplierId = (typeof SUPPLIER_IDS)[number];

const supplierIds: ReadonlySet<string> = new Set(SUPPLIER_IDS);

export function isSupplierId(value: string): value is SupplierId {
  return supplierIds.has(value);
}

export const SUPPLIER_NAMES = {
  customcat: "CustomCat",
  fourthwall: "Fourthwall",
  gelato: "Gelato",
  inkthreadable: "Inkthreadable",
  printful: "Printful",
  printify: "Printify",
  prodigi: "Prodigi",
} as const satisfies Record<SupplierId, string>;

/** The most-searched names lead copy that lists every supplier. */
const LEADING_SUPPLIER_IDS = [
  "printify",
  "printful",
  "gelato",
  "prodigi",
] as const satisfies readonly SupplierId[];

/** Every supplier in copy order: the most-searched first, then A–Z. */
export const SUPPLIER_IDS_IN_COPY_ORDER: readonly SupplierId[] = [
  ...LEADING_SUPPLIER_IDS,
  ...SUPPLIER_IDS.filter(
    id => !LEADING_SUPPLIER_IDS.some(leading => leading === id)
  ).sort((left, right) =>
    SUPPLIER_NAMES[left].localeCompare(SUPPLIER_NAMES[right])
  ),
];

/** "Printify, Printful, … and Inkthreadable", or ids for command help. */
export function formatSupplierList(
  conjunction: "and" | "or",
  form: "names" | "ids" = "names"
): string {
  const items = SUPPLIER_IDS_IN_COPY_ORDER.map(id =>
    form === "names" ? SUPPLIER_NAMES[id] : id
  );
  return `${items.slice(0, -1).join(", ")} ${conjunction} ${items.at(-1)}`;
}
