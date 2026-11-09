/**
 * The launched suppliers: the ones in this list. Other suppliers may hold
 * scraped data but stay invisible to site queries, build artifacts and the
 * release gates until their id is added here (see `launchedSupplierSql`).
 * Lists of "all suppliers" derive from this one, and per-supplier decisions are
 * typed `Record<SupplierId, …>`, so launching a supplier makes the typecheck
 * name each decision still to make. `bun run supplier:rollout` reports the
 * rest: profile copy, pair pages, seeded facts and option links.
 */
export const SUPPLIER_IDS = [
  "apliiq",
  "artelo",
  "merchone",
  "customcat",
  "fourthwall",
  "gelato",
  "inkthreadable",
  "printful",
  "printify",
  "prodigi",
] as const;

/** Ingestion candidates remain excluded from launchedSupplierSql and site selectors. */
export const CANDIDATE_SUPPLIER_IDS = ["printkk"] as const;
export type CandidateSupplierId = (typeof CANDIDATE_SUPPLIER_IDS)[number];
export type IngestionSupplierId = SupplierId | CandidateSupplierId;

export type SupplierId = (typeof SUPPLIER_IDS)[number];

const supplierIds: ReadonlySet<string> = new Set(SUPPLIER_IDS);

export function isSupplierId(value: string): value is SupplierId {
  return supplierIds.has(value);
}

export const SUPPLIER_NAMES = {
  printkk: "PrintKK",
  apliiq: "Apliiq",
  artelo: "Artelo",
  merchone: "merchOne",
  customcat: "CustomCat",
  fourthwall: "Fourthwall",
  gelato: "Gelato",
  inkthreadable: "Inkthreadable",
  printful: "Printful",
  printify: "Printify",
  prodigi: "Prodigi",
} as const satisfies Record<IngestionSupplierId, string>;

/** The most-searched names lead copy that lists every supplier. */
export const LEADING_SUPPLIER_IDS = [
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
