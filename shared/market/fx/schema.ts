import { Option, Schema } from "effect";

/** One calendar day, `YYYY-MM-DD`, that exists (no `2026-02-30`). */
export const FxIsoDate = Schema.String.check(
  Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/, {
    message: "Expected an ISO calendar date (YYYY-MM-DD)",
  }),
  Schema.makeFilter(isRealCalendarDay, {
    message: "Expected a calendar date that exists",
  })
);

/** An ISO-8601 instant with seconds and a `Z` or `±hh:mm` offset. */
export const FxIsoDateTime = Schema.String.check(
  Schema.isPattern(
    /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d+)?(Z|[+-]([01]\d|2[0-3]):[0-5]\d)$/,
    { message: "Expected an ISO-8601 timestamp with an offset" }
  ),
  Schema.makeFilter(
    value => isRealCalendarDay(value.slice(0, 10)),
    { message: "Expected a timestamp on a calendar date that exists" }
  )
);

export const FxNonBlankString = Schema.String.check(
  Schema.isTrimmed({ message: "Expected text without outer whitespace" }),
  Schema.isNonEmpty({ message: "Expected non-empty text" })
);

const FxRate = Schema.Finite.check(
  Schema.isGreaterThan(0, { message: "Expected a positive rate" })
);

/** EUR-based rate map. EUR itself is always 1.0 (implicit, not stored). */
export const EurBaseRatesSchema = Schema.Struct({
  USD: FxRate,
  GBP: FxRate,
  AUD: FxRate,
  CAD: FxRate,
});

export const FxSourceModeSchema = Schema.Literals([
  "scrape_snapshot", // Rates pinned at scrape job start
  "build_live", // Fresh rates fetched at SSG build time
  "native", // No conversion: supplier quoted in target currency
]);

/**
 * The loaded rate environment. Created once by `initFxRates()`,
 * passed to every conversion function.
 */
export const FxContextSchema = Schema.Struct({
  /** EUR-based exchange rates (EUR = 1.0 implicit). */
  rates: EurBaseRatesSchema,
  /** ISO date of the rate data ("2026-02-19"). From Frankfurter's `date` field. */
  rateDate: FxIsoDate,
  /** When rates were fetched from the provider. ISO-8601 timestamp. */
  fetchedAt: FxIsoDateTime,
  /** Which FX context produced this. */
  sourceMode: FxSourceModeSchema,
  /** Rounding + conversion algorithm version. */
  policyVersion: FxNonBlankString,
  /** Rate data provider identifier. */
  providerName: FxNonBlankString,
  /** True if serving from stale cache (6h–72h old). */
  stale: Schema.Boolean,
});

/**
 * Parse options for values that must match a model exactly: an unknown key is
 * a rejection, not something to strip. Cache files omit them and strip.
 */
export const STRICT_FX_PARSE_OPTIONS = { onExcessProperty: "error" } as const;

const decodeFxContext = Schema.decodeUnknownOption(
  FxContextSchema,
  STRICT_FX_PARSE_OPTIONS
);

export function parseFxContext(
  value: unknown
): typeof FxContextSchema.Type | null {
  return Option.getOrNull(decodeFxContext(value));
}

function isRealCalendarDay(value: string): boolean {
  const day = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  return (
    !Number.isNaN(day.getTime()) &&
    day.toISOString().slice(0, 10) === value.slice(0, 10)
  );
}
