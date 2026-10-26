import { z } from "zod";
import { CurrencySchema } from "../pricing/schema";
import { TARGET_DESTINATIONS } from "../runtime/enums";
import { SUPPLIER_IDS } from "../runtime/suppliers";

/**
 * The public API is the one contract behind the public MCP tools and the npm
 * CLI: each tool's input is its JSON body at `/api/v1/tools/<name>` and its
 * output is the response. Keep this module free of server imports so the CLI
 * can bundle it.
 */
export const PUBLIC_API_ORIGIN = "https://podbenchmark.com";
export const publicApiToolPath = (name: string) => `/api/v1/tools/${name}`;
/** Sent by the CLI so usage by agent harnesses can be counted. */
export const PUBLIC_API_AGENT_HEADER = "X-Podbenchmark-Agent";
export const PUBLIC_API_CLIENT_HEADER = "X-Podbenchmark-Client";

export const PUBLIC_SUPPLIER_IDS = SUPPLIER_IDS;
export type PublicSupplierId = (typeof PUBLIC_SUPPLIER_IDS)[number];

export const publicIdSchema = z.string().trim().min(1).max(200);
export const destinationSchema = z
  .enum(TARGET_DESTINATIONS)
  .describe("Where the buyer lives: US, GB, DE, CA or AU.");
export const optionalCurrencySchema = CurrencySchema.optional().describe(
  "Currency for every price. Defaults to the destination's own currency."
);
export const supplierIdSchema = z.enum(PUBLIC_SUPPLIER_IDS);

/** Supplier pricing plans: standard, then each supplier's paid tiers. */
export const PUBLIC_PRICING_TIERS = ["base", "tier1", "tier2"] as const;
export type PublicPricingTier = (typeof PUBLIC_PRICING_TIERS)[number];

export const pageInputShape = {
  limit: z.number().int().min(1).max(50).default(10),
  offset: z.number().int().min(0).max(100000).default(0),
};
export const pageOutputShape = {
  totalCount: z.number().int().nonnegative(),
  nextOffset: z.number().int().nonnegative().nullable(),
};

export const PUBLIC_ERROR_CODES = [
  "invalid_input",
  "not_found",
  "product_not_found",
  "invalid_option",
  "comparison_unavailable",
  "unavailable",
  "rate_limited",
] as const;
export type PublicErrorCode = (typeof PUBLIC_ERROR_CODES)[number];

export const publicErrorSchema = z.strictObject({
  ok: z.literal(false),
  error: z.strictObject({
    code: z.enum(PUBLIC_ERROR_CODES),
    message: z.string(),
    retryable: z.boolean(),
  }),
});
export type PublicError = z.infer<typeof publicErrorSchema>;

/** HTTP status for each error code; clients read the body, not the status. */
export const PUBLIC_ERROR_STATUS: Record<PublicErrorCode, number> = {
  invalid_input: 400,
  not_found: 404,
  product_not_found: 404,
  invalid_option: 422,
  comparison_unavailable: 503,
  unavailable: 503,
  rate_limited: 429,
};

export function publicError(
  code: PublicErrorCode,
  message: string
): PublicError {
  return {
    ok: false,
    error: {
      code,
      message,
      retryable:
        code === "comparison_unavailable" ||
        code === "unavailable" ||
        code === "rate_limited",
    },
  };
}

/** `{ ok: true, ...data } | error`, the envelope every tool returns. */
export function publicResult<Shape extends z.ZodRawShape>(shape: Shape) {
  return z.discriminatedUnion("ok", [
    z.strictObject({ ok: z.literal(true), ...shape }),
    publicErrorSchema,
  ]);
}

/** Any tool's result as a client reads it: success with fields, or an error. */
export const publicToolResultSchema = z.union([
  z.looseObject({ ok: z.literal(true) }),
  publicErrorSchema,
]);
export type PublicToolResult = z.infer<typeof publicToolResultSchema>;
