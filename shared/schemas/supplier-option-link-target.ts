/**
 * A supplier-native destination for one priced option. This module holds the
 * contract's constants, type and a plain reader so browser code can check a
 * link before using it as an href without loading a schema library. The zod
 * schema for stored and wire data is in `supplier-option-link.ts`.
 */
import { readUnknownRecord } from "./record";
import type { SupplierId } from "../kernel/suppliers";
import type { SupplierOptionLinkTarget } from "./supplier-option-link";

export const SUPPLIER_OPTION_LINK_SELECTIONS = [
  "color",
  "size",
  "print-method",
  "provider",
  "orientation",
  "sku",
] as const;

/** The suppliers whose option links are reviewed; a subset of `SUPPLIER_IDS`. */
export const SUPPLIER_OPTION_LINK_SUPPLIER_IDS = [
  "customcat",
  "fourthwall",
  "gelato",
  "printful",
  "printify",
  "prodigi",
] as const satisfies readonly SupplierId[];

export const SUPPLIER_OPTION_LINK_MARKET_CONTEXTS = [
  "none",
  "gelato-editor",
] as const;

export const SUPPLIER_OPTION_LINK_MAX_URL_LENGTH = 2048;

export type SupplierOptionLinkSelection =
  (typeof SUPPLIER_OPTION_LINK_SELECTIONS)[number];

const SUPPLIER_HOSTS = {
  customcat: ["customcat.com", "www.customcat.com"],
  fourthwall: [
    "products.fourthwall.com",
    "fourthwall.com",
    "www.fourthwall.com",
  ],
  gelato: ["dashboard.gelato.com"],
  printful: ["printful.com", "www.printful.com"],
  printify: ["printify.com", "www.printify.com"],
  prodigi: ["dashboard.prodigi.com"],
} satisfies Record<
  (typeof SUPPLIER_OPTION_LINK_SUPPLIER_IDS)[number],
  readonly string[]
>;

const GELATO_EDITOR_PATH = "/catalogue/print-file-editor;";

function isOneOf<Value extends string>(
  values: readonly Value[],
  candidate: unknown
): candidate is Value {
  return typeof candidate === "string" && values.some(value => value === candidate);
}

/** Why a URL is not an official supplier destination, or null when it is. */
export function supplierOptionLinkUrlIssue(
  supplierId: SupplierOptionLinkTarget["supplierId"],
  marketContext: SupplierOptionLinkTarget["marketContext"],
  value: string
): "url" | "marketContext" | null {
  if (!URL.canParse(value)) return "url";
  const url = new URL(value);
  const allowedHosts: readonly string[] = SUPPLIER_HOSTS[supplierId];
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    !allowedHosts.includes(url.hostname)
  )
    return "url";
  if (
    marketContext === "gelato-editor" &&
    (supplierId !== "gelato" || !url.pathname.startsWith(GELATO_EDITOR_PATH))
  )
    return "marketContext";
  return null;
}

/* eslint-disable podbenchmark/no-runtime-typeof -- The link is checked before it becomes an href, in browser bundles that ship no schema library; this reader proves every field of the contract itself. */
/** Invalid or absent targeting always leaves the existing product-page fallback. */
export function readSupplierOptionLinkTarget(
  value: unknown,
  supplierId?: string
): SupplierOptionLinkTarget | null {
  const record = readUnknownRecord(value);
  if (!record) return null;
  const { version, url, selected, requiresLogin, marketContext } = record;
  const linkSupplier = record.supplierId;
  if (
    version !== 1 ||
    !isOneOf(SUPPLIER_OPTION_LINK_SUPPLIER_IDS, linkSupplier) ||
    (supplierId !== undefined && linkSupplier !== supplierId) ||
    typeof url !== "string" ||
    url.length > SUPPLIER_OPTION_LINK_MAX_URL_LENGTH ||
    !Array.isArray(selected) ||
    typeof requiresLogin !== "boolean" ||
    !isOneOf(SUPPLIER_OPTION_LINK_MARKET_CONTEXTS, marketContext)
  )
    return null;
  const choices: SupplierOptionLinkSelection[] = [];
  for (const item of selected) {
    if (!isOneOf(SUPPLIER_OPTION_LINK_SELECTIONS, item)) return null;
    choices.push(item);
  }
  if (choices.length === 0) return null;
  if (supplierOptionLinkUrlIssue(linkSupplier, marketContext, url) !== null)
    return null;
  return {
    version,
    supplierId: linkSupplier,
    url,
    selected: choices,
    requiresLogin,
    marketContext,
  };
}
/* eslint-enable podbenchmark/no-runtime-typeof */
