export const PODBENCHMARK_SITE_ORIGIN = "https://podbenchmark.com";

export const CANONICAL_PATH_SEGMENT_PATTERN = /^[a-z0-9][a-z0-9-]*$/u;
export const CANONICAL_PRODUCT_PATH_PATTERN =
  /^\/[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*$/u;

export function buildCanonicalProductUrl(path: string): string {
  if (!CANONICAL_PRODUCT_PATH_PATTERN.test(path))
    throw new Error(`Not a canonical product path: ${path}`);
  return new URL(path, PODBENCHMARK_SITE_ORIGIN).href;
}
