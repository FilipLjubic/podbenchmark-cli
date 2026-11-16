/** Reserved source-configuration identity; never a named hue or a defaultable AOP color. */
export const UNSPECIFIED_COLOR_SOURCE = "derived:printkk-unspecified-color";
export const UNSPECIFIED_COLOR_EVIDENCE_PATH =
  "ProductRawEvidence.payloads.product.skus";
export const UNSPECIFIED_COLOR_LABEL = "Color unspecified";

/** The stored identity for a product whose only colour is an unspecified source configuration. */
export function supplierUnspecifiedColorIdentity(productId: string): string {
  return `supplier-color:${productId}:unspecified`;
}

export function isSupplierUnspecifiedColorIdentity(
  value: string | null | undefined
): boolean {
  return value?.startsWith("supplier-color:") ?? false;
}
