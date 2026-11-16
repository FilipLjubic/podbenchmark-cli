import { readUnknownRecord } from "../schemas/record";
import { getProfileFactCardinalityPolicy } from "./profile-fact-cardinality";
import type { SelectedSourceVariantProfileFact } from "./selected-source-variant-matching";

type SelectedProfileFactResolution =
  | {
      state: "resolved";
      value: unknown;
      fact: SelectedSourceVariantProfileFact;
    }
  | {
      state: "missing" | "incomplete" | "conflicting";
      value: undefined;
      fact: null;
    }
  | {
      state: "product-invariant";
      value: unknown;
      fact: null;
    };

export function resolveSelectedProfileFact(input: {
  field: string;
  productValue: unknown;
  facts: readonly SelectedSourceVariantProfileFact[] | undefined;
}): SelectedProfileFactResolution {
  const cardinality = getProfileFactCardinalityPolicy(input.field).cardinality;
  if (cardinality === "product-invariant") {
    return {
      state: "product-invariant",
      value: input.productValue,
      fact: null,
    };
  }

  if (input.facts === undefined) {
    // Backward-compatible only for callers that have not selected a profile.
    // Selected-offer callers pass an explicit bundle, including an empty one.
    return {
      state: "product-invariant",
      value: input.productValue,
      fact: null,
    };
  }

  if (cardinality === "unresolved") {
    return { state: "incomplete", value: undefined, fact: null };
  }

  const matchingFacts = input.facts.filter(fact => fact.field === input.field);
  if (matchingFacts.length === 0) {
    return { state: "missing", value: undefined, fact: null };
  }

  const readyFacts = matchingFacts.filter(
    fact =>
      (fact.state ?? (fact.normalizedValue ? "ready" : "unnormalized")) ===
      "ready"
  );
  if (readyFacts.length === 0) {
    return { state: "incomplete", value: undefined, fact: null };
  }

  const distinctValues = new Map<string, SelectedSourceVariantProfileFact>();
  for (const fact of readyFacts) {
    const value = selectedProfileFactValue(fact);
    if (value === undefined) continue;
    distinctValues.set(readStableFactValue(value), fact);
  }
  if (distinctValues.size === 0) {
    return { state: "incomplete", value: undefined, fact: null };
  }
  if (distinctValues.size > 1) {
    return { state: "conflicting", value: undefined, fact: null };
  }

  const fact = distinctValues.values().next().value;
  if (!fact) {
    return { state: "incomplete", value: undefined, fact: null };
  }
  const value = selectedProfileFactValue(fact);
  if (value === undefined) {
    return { state: "incomplete", value: undefined, fact: null };
  }
  return { state: "resolved", value, fact };
}

function isSelectedProfileFactScalar(
  value: unknown
): value is string | number | boolean {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

function selectedProfileFactValue(
  fact: SelectedSourceVariantProfileFact
  // eslint-disable-next-line podbenchmark/no-unknown-returns -- valueJson is heterogeneous by design; the caller narrows the fact value it requested
): unknown {
  if (isSelectedProfileFactScalar(fact.valueJson)) {
    return fact.valueJson;
  }
  const valueJson = readUnknownRecord(fact.valueJson);
  if (valueJson) {
    for (const key of ["value", "raw", "count", "style", "model"]) {
      const value = valueJson[key];
      if (isSelectedProfileFactScalar(value)) {
        return value;
      }
    }
  }
  return fact.normalizedValue ?? fact.rawValue ?? undefined;
}

function readStableFactValue(value: unknown): string {
  if (value === null) return "null";
  if (isSelectedProfileFactScalar(value)) {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return JSON.stringify(value, Object.keys(value).sort()) ?? "null";
  }
  const record = readUnknownRecord(value);
  if (record !== null) {
    return JSON.stringify(value, Object.keys(record).sort()) ?? "null";
  }
  return "unsupported";
}
