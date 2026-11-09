import { z } from "zod";
import {
  CANONICAL_PATH_SEGMENT_PATTERN,
  CANONICAL_PRODUCT_PATH_PATTERN,
} from "./identity.ts";

export const canonicalPathSegmentSchema = z
  .string()
  .regex(CANONICAL_PATH_SEGMENT_PATTERN);

export const canonicalProductPathSchema = z
  .string()
  .regex(CANONICAL_PRODUCT_PATH_PATTERN);
