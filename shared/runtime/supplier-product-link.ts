import { z } from "zod";
import type { SupplierSourceUrlSupplier } from "./supplier-source-urls";

export const SUPPLIER_LINK_MAX_LENGTH = 2048;
export const SUPPLIER_LINK_NAMES = {
  customcat: "CustomCat",
  fourthwall: "Fourthwall",
  gelato: "Gelato",
  inkthreadable: "Inkthreadable",
  printful: "Printful",
  printify: "Printify",
  prodigi: "Prodigi",
} satisfies Record<SupplierSourceUrlSupplier, string>;

const supplierSchema = z.enum([
  "customcat",
  "fourthwall",
  "gelato",
  "inkthreadable",
  "printful",
  "printify",
  "prodigi",
]);
const TRACKING_KEYS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "gclid",
  "fbclid",
]);
const HOSTS = new Map(
  Object.keys(SUPPLIER_LINK_NAMES).filter(supplier => supplier !== "inkthreadable").flatMap(supplier => [
    [`${supplier}.com`, supplier],
    [`www.${supplier}.com`, supplier],
  ])
);
HOSTS.set("inkthreadable.co.uk", "inkthreadable");
HOSTS.set("www.inkthreadable.co.uk", "inkthreadable");

export type ParsedSupplierProductLink = {
  status: "supported";
  supplierId: SupplierSourceUrlSupplier;
  productId: string | null;
  sourceUrls: string[];
  selectedColor: string | null;
};

function readPublicUrl(input: string): URL | null {
  const value = input.trim();
  if (
    !value ||
    value.length > SUPPLIER_LINK_MAX_LENGTH ||
    /[\s\\\u0000-\u001f\u007f]/.test(value) ||
    /^[^?#]*%/.test(value) ||
    /(?:\/|%2f)\.{1,2}(?:\/|%2f)/i.test(value)
  )
    return null;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      !url.port &&
      !url.hash &&
      !/%/.test(url.pathname)
      ? url
      : null;
  } catch {
    return null;
  }
}

function identifyProductPath(
  supplier: SupplierSourceUrlSupplier,
  path: string
): { productId: string | null } | null {
  const parts = path.split("/").slice(1);
  if (parts.some(part => !/^[a-zA-Z0-9_-]+$/.test(part))) return null;
  if (supplier === "inkthreadable") {
    return parts.length === 1 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(parts[0] ?? "")
      ? { productId: null }
      : null;
  }
  if (supplier === "printify") {
    if (
      parts[0] !== "app" ||
      parts[1] !== "products" ||
      !/^[1-9]\d{0,8}$/.test(parts[2] ?? "") ||
      ![3, 5].includes(parts.length)
    )
      return null;
    return { productId: `printify:${parts[2]}` };
  }
  const prefix =
    supplier === "gelato" || supplier === "printful" ? "custom" : "products";
  if (
    parts[0] !== prefix ||
    parts.length < 2 ||
    (supplier === "fourthwall" && parts.length !== 2)
  )
    return null;
  return { productId: null };
}

function readLinkConfiguration(
  supplier: SupplierSourceUrlSupplier,
  params: URLSearchParams
): { selectedColor: string | null } | null {
  let selectedColor: string | null = null;
  for (const [key, entry] of params) {
    if (TRACKING_KEYS.has(key)) continue;
    if (
      supplier !== "fourthwall" ||
      key !== "selectedColor" ||
      selectedColor !== null
    )
      return null;
    if (
      !entry.trim() ||
      entry.length > 100 ||
      /[\u0000-\u001f\u007f]/.test(entry)
    )
      return null;
    selectedColor = entry.trim();
  }
  return { selectedColor };
}

/** A lookup key only. This boundary never fetches URLs or guesses a product slug. */
export function parseSupplierProductLink(
  input: string
): ParsedSupplierProductLink | { status: "unsupported" } {
  const unsupported = { status: "unsupported" } as const;
  const url = readPublicUrl(input);
  if (!url) return unsupported;
  const supplier = supplierSchema.safeParse(HOSTS.get(url.hostname));
  if (!supplier.success) return unsupported;
  const supplierId = supplier.data;
  const path = url.pathname.replace(/\/$/, "");
  const identity = identifyProductPath(supplierId, path);
  const configuration = readLinkConfiguration(supplierId, url.searchParams);
  if (!identity || !configuration) return unsupported;
  const domain = supplierId === "inkthreadable" ? "inkthreadable.co.uk" : supplierId + ".com";
  const sourceUrls = ["https:", "http:"].flatMap(protocol =>
    [domain, "www." + domain].flatMap(host => [
      protocol + "//" + host + path,
      protocol + "//" + host + path + "/",
    ])
  );
  return {
    status: "supported",
    supplierId,
    ...identity,
    sourceUrls,
    ...configuration,
  };
}

export const supplierLinkChoiceSchema = z.object({
  canonicalId: z.string(),
  name: z.string(),
  listingName: z.string(),
  supplierId: supplierSchema,
  href: z.string().regex(/^\/[a-z0-9-]+\/[a-z0-9-]+\?/),
  configuration: z.enum(["reference", "color"]),
});
export type SupplierLinkChoice = z.infer<typeof supplierLinkChoiceSchema>;
export const supplierLinkResultSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("resolved"), choice: supplierLinkChoiceSchema }),
  z.object({
    status: z.literal("ambiguous"),
    choices: z.array(supplierLinkChoiceSchema).min(2).max(10),
  }),
  z.object({
    status: z.enum([
      "unsupported",
      "no-match",
      "configuration-unavailable",
      "unavailable",
    ]),
  }),
]);
export type SupplierLinkResult = z.infer<typeof supplierLinkResultSchema>;
