import { compareUtf8Bytes } from "../../kernel/canonical-order.ts";
import type {
  SelectedSourceVariantFallbackFactor,
  SelectedSourceVariantFieldFit,
  SelectedSourceVariantFieldComparisonState,
} from "./types";

/** Exact by token and exact by unit conversion are the same answer to the seller. */
const FIELD_STATE_PRIORITY: Record<
  SelectedSourceVariantFieldComparisonState,
  number
> = {
  matched: 0,
  equivalent: 0,
  defaulted: 2,
  fallback: 3,
  ignored: 4,
  unsupported: 5,
  missing: 6,
  unnormalized: 7,
  absent: 8,
  different: 9,
};

/**
 * Fields in the order a mismatch distorts a price comparison: what the seller
 * pays for (dimensions, amount), then the configuration bought, then print
 * placement, then shade. One size step moves a supplier's price 7-8%; a shade
 * rarely moves it at all ([closest-variant review](../../../docs/research/2026-11-06-closest-variant-algorithm-review.md)).
 * Fields not listed are configuration fields.
 */
const FIELD_PRECEDENCE = {
  size: 0,
  capacity: 0,
  deviceFit: 0,
  shape: 0,
  scent: 0,
  quantity: 1,
  pageCount: 1,
  printDecoration: 3,
  color: 4,
  tasselColor: 4,
  borderColor: 4,
  hardwareFinish: 4,
} as const satisfies Readonly<Record<string, number>>;
const CONFIGURATION_FIELD_PRECEDENCE = 2;

function isPrecedenceField(field: string): field is keyof typeof FIELD_PRECEDENCE {
  return Object.hasOwn(FIELD_PRECEDENCE, field);
}

function fieldPrecedence(field: string): number {
  return isPrecedenceField(field) ? FIELD_PRECEDENCE[field] : CONFIGURATION_FIELD_PRECEDENCE;
}

function compareFieldPrecedence(left: string, right: string): number {
  return fieldPrecedence(left) - fieldPrecedence(right) || compareUtf8Bytes(left, right);
}

type OptionFitSummary = {
  matched: number;
  fields: readonly string[];
  byField: ReadonlyMap<string, SelectedSourceVariantFieldFit>;
};

/**
 * Comparison arrays are immutable once evaluated and are compared many times
 * while candidates sort, so each array's hard-field summary is built once.
 */
const optionFitSummaries = new WeakMap<
  readonly SelectedSourceVariantFieldFit[],
  OptionFitSummary
>();

function optionFitSummary(
  comparisons: readonly SelectedSourceVariantFieldFit[]
): OptionFitSummary {
  const cached = optionFitSummaries.get(comparisons);
  if (cached) return cached;
  const hard = hardFieldComparisons(comparisons);
  const summary: OptionFitSummary = {
    matched: stateCount(hard, "matched"),
    fields: internFieldList([...new Set(hard.map(item => item.field))].sort(compareFieldPrecedence)),
    byField: new Map(hard.map(item => [item.field, item])),
  };
  optionFitSummaries.set(comparisons, summary);
  return summary;
}

/** Candidates of one policy share a field list; one array lets compares skip the merge. */
const internedFieldLists = new Map<string, readonly string[]>();
function internFieldList(fields: readonly string[]): readonly string[] {
  const key = fields.join("\u0000");
  const existing = internedFieldLists.get(key);
  if (existing) return existing;
  if (internedFieldLists.size < 1024) internedFieldLists.set(key, fields);
  return fields;
}

/** Union of two field lists, both sorted by precedence and duplicate-free. */
function mergeSortedFields(left: readonly string[], right: readonly string[]): readonly string[] {
  if (left === right) return left;
  const merged: string[] = [];
  let i = 0;
  let j = 0;
  while (i < left.length || j < right.length) {
    const order = i >= left.length ? 1 : j >= right.length ? -1 : compareFieldPrecedence(left[i]!, right[j]!);
    if (order <= 0) merged.push(left[i++]!);
    if (order >= 0) merged.push(right[j++]!);
  }
  return merged;
}

/**
 * Orders two candidates' option fit field by field, most price-relevant field
 * first: the first field where one candidate is exact and the other isn't, or
 * where both fall back but one is nearer, decides. A numeric factor is compared
 * only against the same field, factor kind, and unit; unlike units never mix.
 * A field with no comparison on one side carries no difference there (print
 * placement is recorded only for non-standard prints).
 */
export function compareSelectedSourceVariantOptionFit(
  left: readonly SelectedSourceVariantFieldFit[],
  right: readonly SelectedSourceVariantFieldFit[]
): number {
  const leftSummary = optionFitSummary(left);
  const rightSummary = optionFitSummary(right);

  for (const field of mergeSortedFields(leftSummary.fields, rightSummary.fields)) {
    const leftComparison = leftSummary.byField.get(field);
    const rightComparison = rightSummary.byField.get(field);
    const stateDifference =
      fieldStatePriority(leftComparison) - fieldStatePriority(rightComparison);
    if (stateDifference !== 0) return stateDifference;

    if (
      leftComparison?.state === "fallback" &&
      rightComparison?.state === "fallback"
    ) {
      const factorDifference = compareFieldLocalFactor(
        leftComparison,
        rightComparison
      );
      if (factorDifference !== 0) return factorDifference;
    }
  }

  // Equally good fits: a literal token match reads plainer than a converted one.
  return rightSummary.matched - leftSummary.matched;
}

function fieldStatePriority(
  comparison: SelectedSourceVariantFieldFit | undefined
): number {
  return comparison ? FIELD_STATE_PRIORITY[comparison.state] : FIELD_STATE_PRIORITY.matched;
}

function hardFieldComparisons(
  comparisons: readonly SelectedSourceVariantFieldFit[]
): SelectedSourceVariantFieldFit[] {
  return comparisons.filter(comparison =>
    ["required", "conditional", "defaultable"].includes(comparison.role)
  );
}

function stateCount(
  comparisons: readonly SelectedSourceVariantFieldFit[],
  state: SelectedSourceVariantFieldComparisonState
): number {
  return comparisons.filter(comparison => comparison.state === state).length;
}

function compareFieldLocalFactor(
  left: SelectedSourceVariantFieldFit,
  right: SelectedSourceVariantFieldFit
): number {
  const leftFactor = left.fallbackFactor;
  const rightFactor = right.fallbackFactor;
  if (leftFactor && rightFactor) {
    const leftNamed = leftFactor.kind === "color-family-name";
    const rightNamed = rightFactor.kind === "color-family-name";
    if (leftNamed || rightNamed) {
      // A shade with a swatch has a distance and one known by name alone has
      // none: the swatched shade ranks first. Two named shades tie, and price
      // decides between them.
      const other = leftNamed ? rightFactor : leftFactor;
      if (leftNamed && rightNamed) return 0;
      return other.kind === "perceptual-color" ? (leftNamed ? 1 : -1) : 0;
    }
    const leftKey = `${leftFactor.kind}:${leftFactor.unit}`;
    const rightKey = `${rightFactor.kind}:${rightFactor.unit}`;
    if (leftKey !== rightKey) return 0;
    return (
      compareColorFamilyLook(leftFactor, rightFactor) ||
      compareFiniteNumbers(leftFactor.value, rightFactor.value)
    );
  }
  if (leftFactor || rightFactor) return leftFactor ? -1 : 1;

  // Backwards compatibility for old rows that predate typed factors. Values
  // are comparable here only because both comparisons are for the same field.
  return compareNullableFiniteNumbers(
    left.fallbackDistance,
    right.fallbackDistance
  );
}

/**
 * A shade of the same look (bounded by the family, so no distance maximum)
 * ranks before a near-identical shade of another look.
 */
function compareColorFamilyLook(
  left: SelectedSourceVariantFallbackFactor,
  right: SelectedSourceVariantFallbackFactor
): number {
  if (
    left.kind !== "perceptual-color" ||
    right.kind !== "perceptual-color"
  ) {
    return 0;
  }
  return Number(left.maximum !== null) - Number(right.maximum !== null);
}

function compareFiniteNumbers(left: number, right: number): number {
  const leftFinite = Number.isFinite(left);
  const rightFinite = Number.isFinite(right);
  if (leftFinite && rightFinite) return left - right;
  if (leftFinite) return -1;
  if (rightFinite) return 1;
  return 0;
}

function compareNullableFiniteNumbers(
  left: number | null,
  right: number | null
): number {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return compareFiniteNumbers(left, right);
}
