import { createClosedStringLookup } from "../kernel/closed-string-lookup";
import type { IngestionSupplierId } from "../kernel/suppliers";

/** A sourced production window ending at dispatch, independent of delivery. */
export type ProductionEstimate = {
  readonly minDays: number;
  readonly maxDays: number;
  readonly unit: "working-days";
};

type ProductionEstimateColumns = {
  readonly minDays: number | null | undefined;
  readonly maxDays: number | null | undefined;
};

/**
 * Reads a supplier's numeric production columns. A supplier with no reviewed
 * working-day semantics for those columns has no entry reader, so its columns
 * stay unusable rather than being read as a guessed window.
 */
type ProductionEstimateReader = (
  columns: ProductionEstimateColumns
) => ProductionEstimate | null;

/** Never use a summary, average or another variant to fill missing bounds. */
const readInkthreadableProductionEstimate: ProductionEstimateReader = ({
  minDays,
  maxDays,
}) => {
  if (
    minDays === null ||
    minDays === undefined ||
    maxDays === null ||
    maxDays === undefined ||
    !Number.isFinite(minDays) ||
    !Number.isFinite(maxDays) ||
    minDays < 0 ||
    maxDays < minDays
  ) {
    return null;
  }
  return { minDays, maxDays, unit: "working-days" };
};

/**
 * Numeric variant columns survive the serving mirror. Only Inkthreadable has
 * reviewed working-day semantics for these columns; no supplier JSON is needed.
 */
const PRODUCTION_ESTIMATE_READERS = {
  apliiq: null,
  artelo: null,
  customcat: null,
  fourthwall: null,
  gelato: null,
  inkthreadable: readInkthreadableProductionEstimate,
  merchone: null,
  printful: null,
  printify: null,
  printkk: null,
  prodigi: null,
} as const satisfies Readonly<
  Record<IngestionSupplierId, ProductionEstimateReader | null>
>;

const readEstimateFor = createClosedStringLookup(PRODUCTION_ESTIMATE_READERS);

export function resolveProductionEstimate(input: {
  readonly supplierId: string;
  readonly productionDaysMin: number | null | undefined;
  readonly productionDaysMax: number | null | undefined;
}): ProductionEstimate | null {
  const read = readEstimateFor(input.supplierId);
  return read
    ? read({
        minDays: input.productionDaysMin,
        maxDays: input.productionDaysMax,
      })
    : null;
}
