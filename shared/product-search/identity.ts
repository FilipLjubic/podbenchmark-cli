import { z } from "zod";

export const PODBENCHMARK_SITE_ORIGIN = "https://podbenchmark.com";

export const canonicalPathSegmentSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]*$/u);

export const canonicalProductPathSchema = z
  .string()
  .regex(/^\/[a-z0-9][a-z0-9-]*\/[a-z0-9][a-z0-9-]*$/u);

export function buildCanonicalProductUrl(path: string): string {
  const canonicalPath = canonicalProductPathSchema.parse(path);
  return new URL(canonicalPath, PODBENCHMARK_SITE_ORIGIN).href;
}
