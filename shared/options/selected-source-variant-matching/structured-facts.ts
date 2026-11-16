import { compareUtf8Bytes } from "../../kernel/canonical-order.ts";
import { readUnknownRecord } from "../../schemas/record";
import { buildSelectedSourceVariantFactsSignature } from "./facts";
import { createNormalizedVariantSizeValue } from "../../sizing/variant-size-normalization";
import { parseExplicitPageCountFromText } from "../../sizing/page-count-evidence";
import type {
  SelectedSourceVariantMatchingPolicy,
  SelectedSourceVariantProfileFact,
} from "./types";
import { soleMember } from "../../kernel/sole-member.ts";

export type SelectedSourceStructuredVariantFactInput = {
  variantProfileId: string | null;
  supplierId: string;
  productId?: string | null;
  productName: string | null;
  supplierVariantId?: string | null;
  size: string | null;
  data?: unknown;
  productData: unknown;
};

type SelectedSourceStructuredProductConsumerIndex = {
  pageCount: number | null;
  matchedQuantityBySupplierVariantId: ReadonlyMap<string, number>;
  printfulSingleQuantityBySupplierVariantId: ReadonlyMap<string, number>;
  indexEntryCount: number;
  indexIdBytes: number;
};

export const SELECTED_SOURCE_STRUCTURED_FALLBACK_COMPLETE_FIELD_PREFIX =
  "__selectedSourceStructuredFallbackComplete:";

export type SelectedSourceStructuredVariantFactField =
  | "quantity"
  | "pageCount"
  | "size";

/**
 * Policies are module constants (or one request's derived copy), and the
 * planners ask once per profile: tens of thousands of times per request.
 */
const structuredFieldsByPolicy = new WeakMap<
  SelectedSourceVariantMatchingPolicy,
  readonly SelectedSourceStructuredVariantFactField[]
>();

export function selectedSourceStructuredVariantFactFields(
  policy: SelectedSourceVariantMatchingPolicy
): readonly SelectedSourceStructuredVariantFactField[] {
  const cached = structuredFieldsByPolicy.get(policy);
  if (cached) return cached;
  const structuredFields = computeStructuredVariantFactFields(policy);
  structuredFieldsByPolicy.set(policy, structuredFields);
  return structuredFields;
}

function computeStructuredVariantFactFields(
  policy: SelectedSourceVariantMatchingPolicy
): SelectedSourceStructuredVariantFactField[] {
  const fields = new Set(policy.fields.map(field => field.field));
  const structuredFields: SelectedSourceStructuredVariantFactField[] = [];
  if (fields.has("quantity")) structuredFields.push("quantity");
  if (fields.has("pageCount")) structuredFields.push("pageCount");
  if (
    fields.has("size") &&
    selectedSourcePolicyNeedsStructuredSizeFacts(policy)
  ) {
    structuredFields.push("size");
  }
  return structuredFields;
}

export function selectedSourceStructuredFallbackCompletionFact(
  field: SelectedSourceStructuredVariantFactField
): SelectedSourceVariantProfileFact {
  return {
    field: `${SELECTED_SOURCE_STRUCTURED_FALLBACK_COMPLETE_FIELD_PREFIX}${field}`,
    normalizedValue: `structured-fallback-complete:${field}`,
    state: "ready",
    originScope: "variant",
    normalizationStatus: "exact",
    valueJson: { field, state: "complete" },
  };
}

export function isSelectedSourceStructuredFallbackCompletionFact(
  fact: SelectedSourceVariantProfileFact,
  field: SelectedSourceStructuredVariantFactField
): boolean {
  return (
    fact.field ===
      `${SELECTED_SOURCE_STRUCTURED_FALLBACK_COMPLETE_FIELD_PREFIX}${field}` &&
    fact.normalizedValue === `structured-fallback-complete:${field}`
  );
}

export function selectedSourcePolicyNeedsStructuredVariantFacts(
  policy: SelectedSourceVariantMatchingPolicy
): boolean {
  return selectedSourceStructuredVariantFactFields(policy).length > 0;
}

/**
 * Structured product/variant reads are a final fallback for legacy profiles.
 * A complete projected profile fact must retain precedence, matching
 * `applySelectedSourceStructuredFallbackAccumulator` exactly.
 */
export function selectedSourceProfilesNeedStructuredVariantFacts(input: {
  factsByProfileId: ReadonlyMap<
    string,
    readonly SelectedSourceVariantProfileFact[]
  >;
  structuredFallbackCompletionFactsByProfileId?: ReadonlyMap<
    string,
    readonly SelectedSourceVariantProfileFact[]
  >;
  profileIds: readonly string[];
  policy: SelectedSourceVariantMatchingPolicy;
}): boolean {
  if (!selectedSourcePolicyNeedsStructuredVariantFacts(input.policy)) {
    return false;
  }

  const structuredFields = selectedSourceStructuredVariantFactFields(
    input.policy
  );

  return input.profileIds.some(profileId => {
    const facts = input.factsByProfileId.get(profileId);
    const completionFacts =
      input.structuredFallbackCompletionFactsByProfileId?.get(profileId) ??
      facts;
    if (!facts && !completionFacts) return true;

    return structuredFields.some(field => {
      const hasMaterializedFact =
        field === "size"
          ? (facts ?? []).some(
              fact =>
                fact.field === "size" &&
                fact.state === "ready" &&
                Boolean(fact.normalizedValue)
            )
          : (facts ?? []).some(fact => fact.field === field);
      if (hasMaterializedFact) return false;
      return !(completionFacts ?? []).some(fact =>
        isSelectedSourceStructuredFallbackCompletionFact(fact, field)
      );
    });
  });
}

type SelectedSourceStructuredFallbackState = {
  quantities: Set<number>;
  pageCounts: Set<number>;
  normalizedSizes: Set<string>;
  rawSizes: Set<string>;
};

export type SelectedSourceStructuredFallbackAccumulator = Map<
  string,
  SelectedSourceStructuredFallbackState
>;

export function createSelectedSourceStructuredFallbackAccumulator(): SelectedSourceStructuredFallbackAccumulator {
  return new Map();
}

function addAtMostTwo<T>(values: Set<T>, value: T): void {
  if (values.has(value) || values.size >= 2) return;
  values.add(value);
}

export function accumulateSelectedSourceStructuredFallback(input: {
  accumulator: SelectedSourceStructuredFallbackAccumulator;
  variant: SelectedSourceStructuredVariantFactInput;
  prepared?: SelectedSourceStructuredProductConsumerIndex;
}): void {
  const profileId = input.variant.variantProfileId;
  if (!profileId) return;
  const state = input.accumulator.get(profileId) ?? {
    quantities: new Set<number>(),
    pageCounts: new Set<number>(),
    normalizedSizes: new Set<string>(),
    rawSizes: new Set<string>(),
  };
  const quantity = readSelectedSourceVariantQuantityCount(
    input.variant,
    input.prepared
  );
  if (quantity !== null) addAtMostTwo(state.quantities, quantity);
  const pageCount = input.prepared
    ? input.prepared.pageCount
    : readSelectedSourceProductPageCount(input.variant.productData);
  if (pageCount !== null) addAtMostTwo(state.pageCounts, pageCount);
  if (input.variant.size) {
    const normalizedSize = createNormalizedVariantSizeValue(
      {
        categorySlug: "stationery",
        specType: readSelectedSourceProductSpecType(input.variant.productData),
        supplierId: input.variant.supplierId,
        productId: input.variant.productId,
        productName: input.variant.productName,
      },
      input.variant.size
    );
    if (normalizedSize) {
      addAtMostTwo(state.normalizedSizes, normalizedSize);
      if (state.normalizedSizes.size === 1) state.rawSizes.add(input.variant.size);
      else state.rawSizes.clear();
    }
  }
  input.accumulator.set(profileId, state);
}

function applyStructuredQuantityFallback(
  facts: SelectedSourceVariantProfileFact[],
  state: SelectedSourceStructuredFallbackState
): void {
  const quantity = soleMember(state.quantities);
  if (quantity === undefined) return;
  if (facts.some(fact => fact.field === "quantity")) return;
  facts.push({
    field: "quantity",
    normalizedValue: `quantity:print-run:${quantity}`,
    rawValue: String(quantity),
    state: "ready",
    originScope: "variant",
    normalizationStatus: "exact",
    valueJson: { raw: quantity, count: quantity, unitKind: "print-run" },
    numericValue: quantity,
  });
}

function applyStructuredPageCountFallback(
  facts: SelectedSourceVariantProfileFact[],
  state: SelectedSourceStructuredFallbackState
): void {
  const pageCount = soleMember(state.pageCounts);
  if (pageCount === undefined) return;
  if (facts.some(fact => fact.field === "pageCount")) return;
  facts.push({
    field: "pageCount",
    normalizedValue: `page-count:${pageCount}`,
    rawValue: String(pageCount),
    state: "ready",
    originScope: "product",
    normalizationStatus: "exact",
    valueJson: { raw: pageCount, count: pageCount, unitKind: "pages" },
    numericValue: pageCount,
  });
}

function applyStructuredSizeFallback(
  facts: SelectedSourceVariantProfileFact[],
  state: SelectedSourceStructuredFallbackState
): void {
  const normalizedSize = soleMember(state.normalizedSizes);
  if (normalizedSize === undefined) return;
  const existingSizeIndex = facts.findIndex(fact => fact.field === "size");
  const existingSizeFact =
    existingSizeIndex >= 0 ? facts[existingSizeIndex] : null;
  if (existingSizeFact?.state === "ready" && existingSizeFact.normalizedValue) {
    return;
  }
  const nextFact: SelectedSourceVariantProfileFact = {
    ...(existingSizeFact ?? { field: "size", normalizedValue: null }),
    field: "size",
    normalizedValue: normalizedSize,
    rawValue:
      [...state.rawSizes].sort(compareUtf8Bytes).join(" / ") ||
      existingSizeFact?.rawValue ||
      null,
    state: "ready",
    originScope: existingSizeFact?.originScope ?? "variant",
    normalizationStatus:
      existingSizeFact?.normalizationStatus === "unknown"
        ? "legacy-derived"
        : existingSizeFact?.normalizationStatus ?? "legacy-derived",
  };
  if (existingSizeIndex >= 0) facts[existingSizeIndex] = nextFact;
  else facts.push(nextFact);
}

export function applySelectedSourceStructuredFallbackAccumulator(input: {
  accumulator: SelectedSourceStructuredFallbackAccumulator;
  factsByProfileId: Map<string, SelectedSourceVariantProfileFact[]>;
  fields: readonly string[];
  policy: SelectedSourceVariantMatchingPolicy;
}): void {
  for (const [profileId, state] of input.accumulator) {
    const facts = input.factsByProfileId.get(profileId) ?? [];
    if (input.fields.includes("quantity")) {
      applyStructuredQuantityFallback(facts, state);
    }
    if (input.fields.includes("pageCount")) {
      applyStructuredPageCountFallback(facts, state);
    }
    if (
      input.fields.includes("size") &&
      selectedSourcePolicyNeedsStructuredSizeFacts(input.policy)
    ) {
      applyStructuredSizeFallback(facts, state);
    }
    input.factsByProfileId.set(profileId, facts);
  }
}

export function selectedSourceStructuredFallbackDecisions(input: {
  before: readonly SelectedSourceVariantProfileFact[];
  after: readonly SelectedSourceVariantProfileFact[];
  fields: readonly string[];
  policy: SelectedSourceVariantMatchingPolicy;
}): Array<{
  field: "quantity" | "pageCount" | "size";
  state: "suppressed-by-existing" | "emitted" | "absent";
  fact: SelectedSourceVariantProfileFact | null;
}> {
  const fields: Array<"quantity" | "pageCount" | "size"> = [];
  if (input.fields.includes("quantity")) fields.push("quantity");
  if (input.fields.includes("pageCount")) fields.push("pageCount");
  if (
    input.fields.includes("size") &&
    selectedSourcePolicyNeedsStructuredSizeFacts(input.policy)
  ) {
    fields.push("size");
  }
  return fields.map(field => {
    const before = input.before.find(fact => fact.field === field) ?? null;
    const suppressed =
      field === "size"
        ? before?.state === "ready" && Boolean(before.normalizedValue)
        : before !== null;
    if (suppressed) {
      return { field, state: "suppressed-by-existing", fact: null } as const;
    }
    const after = input.after.find(fact => fact.field === field) ?? null;
    const changed =
      after !== null &&
      after.state === "ready" &&
      Boolean(after.normalizedValue) &&
      (before === null ||
        buildSelectedSourceVariantFactsSignature([before]) !==
          buildSelectedSourceVariantFactsSignature([after]));
    return changed
      ? ({ field, state: "emitted", fact: after } as const)
      : ({ field, state: "absent", fact: null } as const);
  });
}

export function prepareSelectedSourceSupplierVariantIds(
  values: Iterable<string | null | undefined>
): Set<string> {
  const ids = new Set<string>();
  for (const value of values) {
    const normalized = value?.trim();
    if (normalized) ids.add(normalized);
  }
  return ids;
}

export function addStructuredVariantSpecFactsByProfileId(input: {
  factsByProfileId: Map<string, SelectedSourceVariantProfileFact[]>;
  variants: readonly SelectedSourceStructuredVariantFactInput[];
  fields: readonly string[];
  policy: SelectedSourceVariantMatchingPolicy;
}): void {
  const accumulator = createSelectedSourceStructuredFallbackAccumulator();
  const supplierVariantIdsByProduct = new Map<string, Set<string>>();
  for (const variant of input.variants) {
    const productKey = `${variant.supplierId}\0${variant.productId ?? ""}`;
    const ids = supplierVariantIdsByProduct.get(productKey) ?? new Set<string>();
    for (const id of prepareSelectedSourceSupplierVariantIds([
      variant.supplierVariantId,
    ]))
      ids.add(id);
    supplierVariantIdsByProduct.set(productKey, ids);
  }
  const preparedByProductId = new Map<
    string,
    SelectedSourceStructuredProductConsumerIndex
  >();
  for (const variant of input.variants) {
    const productKey = `${variant.supplierId}\0${variant.productId ?? ""}`;
    let prepared = preparedByProductId.get(productKey);
    if (!prepared) {
      prepared = readSelectedSourceStructuredProductConsumerIndex(
        variant.productData,
        { supplierVariantIds: supplierVariantIdsByProduct.get(productKey) },
      );
      preparedByProductId.set(productKey, prepared);
    }
    accumulateSelectedSourceStructuredFallback({ accumulator, variant, prepared });
  }
  applySelectedSourceStructuredFallbackAccumulator({
    accumulator,
    factsByProfileId: input.factsByProfileId,
    fields: input.fields,
    policy: input.policy,
  });
}

function selectedSourcePolicyNeedsStructuredSizeFacts(
  policy: SelectedSourceVariantMatchingPolicy
): boolean {
  return [
    "protected-paper-standard-selected-source",
    "notebook-size-page-count-selected-source",
  ].includes(policy.id);
}

function isSelectedSourceText(value: unknown): value is string {
  return typeof value === "string";
}

/** Decode a string leaf from unparsed product or variant data. */
function readSelectedSourceString(value: unknown): string | null {
  return isSelectedSourceText(value) ? value : null;
}

function isSelectedSourceContainer(value: unknown): value is object {
  return value !== null && typeof value === "object";
}

function readSelectedSourceProductSpecType(data: unknown): string | null {
  const record = parseSelectedSourceRecord(data);
  const specs = parseSelectedSourceRecord(record?.specs);
  return readSelectedSourceString(specs?.type);
}

function readSelectedSourceProductSpecSubtype(data: unknown): string | null {
  const record = parseSelectedSourceRecord(data);
  const specs = parseSelectedSourceRecord(record?.specs);
  return readSelectedSourceString(specs?.subtype);
}

function readSelectedSourceVariantSpecQuantityCount(data: unknown): number | null {
  const record = parseSelectedSourceRecord(data);
  const variantSpecs = parseSelectedSourceRecord(record?.variantSpecs);
  return readSelectedSourceIntegerCount(variantSpecs?.quantity);
}

type SelectedSourceCountSummary = {
  value: number | null;
  ambiguous: boolean;
};

function mergeSelectedSourceCount(
  summary: SelectedSourceCountSummary,
  count: number | null
): void {
  if (count === null || summary.ambiguous) return;
  if (summary.value === null) {
    summary.value = count;
  } else if (summary.value !== count) {
    summary.value = null;
    summary.ambiguous = true;
  }
}

/**
 * Raw supplier evidence too large for the bounded structured-fact scan. The
 * product's structured fallback is unavailable; callers keep its stored facts
 * and must not record the fallback as complete.
 */
export class SelectedSourceEvidenceBudgetExceededError extends Error {
  override readonly name = "SelectedSourceEvidenceBudgetExceededError";
}

const MAX_SELECTED_SOURCE_INDEX_ENTRIES = 100_000;
const MAX_SELECTED_SOURCE_INDEX_ID_BYTES = 16 * 1024 * 1024;
const MAX_SELECTED_SOURCE_TRAVERSAL_NODES = 100_000;
const MAX_SELECTED_SOURCE_TRAVERSAL_DEPTH = 128;
const SELECTED_SOURCE_UTF8_ENCODER = new TextEncoder();

type SelectedSourceIndexBudget = { entries: number; idBytes: number };
type SelectedSourceTraversalBudget = {
  nodes: number;
  seen: WeakSet<object>;
};

function reserveSelectedSourceIndexId(
  id: string,
  budget: SelectedSourceIndexBudget
): void {
  budget.entries += 1;
  budget.idBytes += SELECTED_SOURCE_UTF8_ENCODER.encode(id).byteLength;
  if (
    budget.entries > MAX_SELECTED_SOURCE_INDEX_ENTRIES ||
    budget.idBytes > MAX_SELECTED_SOURCE_INDEX_ID_BYTES
  ) {
    throw new SelectedSourceEvidenceBudgetExceededError("Selected-source product consumer index exceeds its bounded limit.");
  }
}

function reserveMatchedSelectedSourceQuantityIds(
  record: Record<string, unknown>,
  count: number,
  byId: Map<string, SelectedSourceCountSummary>,
  requestedIds: ReadonlySet<string> | undefined,
  indexBudget: SelectedSourceIndexBudget
): void {
  for (const key of ["sku", "id", "variantId", "variant_id"] as const) {
    const candidate = record[key];
    if (candidate === null || candidate === undefined) continue;
    const id = String(candidate).trim();
    if (!id || (requestedIds && !requestedIds.has(id))) continue;
    const existing = byId.get(id);
    if (existing) {
      mergeSelectedSourceCount(existing, count);
    } else {
      reserveSelectedSourceIndexId(id, indexBudget);
      byId.set(id, { value: count, ambiguous: false });
    }
  }
}

function readMatchedSelectedSourceQuantities(
  value: unknown,
  byId: Map<string, SelectedSourceCountSummary>,
  requestedIds: ReadonlySet<string> | undefined,
  indexBudget: SelectedSourceIndexBudget,
  traversal: SelectedSourceTraversalBudget,
  depth = 0
): SelectedSourceCountSummary {
  if (
    depth > MAX_SELECTED_SOURCE_TRAVERSAL_DEPTH ||
    ++traversal.nodes > MAX_SELECTED_SOURCE_TRAVERSAL_NODES
  ) {
    throw new SelectedSourceEvidenceBudgetExceededError("Selected-source product consumer traversal exceeds its bounded limit.");
  }
  const summary: SelectedSourceCountSummary = { value: null, ambiguous: false };
  if (isSelectedSourceText(value)) {
    mergeSelectedSourceCount(
      summary,
      explicitSelectedSourcePrintRunQuantityFromText(value) ??
        explicitSelectedSourceSinglePrintRunQuantityFromText(value)
    );
    return summary;
  }
  if (!isSelectedSourceContainer(value)) return summary;
  if (traversal.seen.has(value)) {
    throw new Error("Selected-source product consumer traversal is cyclic.");
  }
  traversal.seen.add(value);
  const readNested = (nested: unknown): void => {
    const child = readMatchedSelectedSourceQuantities(
      nested,
      byId,
      requestedIds,
      indexBudget,
      traversal,
      depth + 1
    );
    if (child.ambiguous) {
      summary.value = null;
      summary.ambiguous = true;
    } else {
      mergeSelectedSourceCount(summary, child.value);
    }
  };
  if (Array.isArray(value)) {
    for (const nested of value) readNested(nested);
  } else {
    const record = parseSelectedSourceRecord(value);
    if (record) {
      for (const key in record) {
        if (Object.hasOwn(record, key)) readNested(record[key]);
      }
      const count = summary.ambiguous ? null : summary.value;
      if (count !== null) {
        reserveMatchedSelectedSourceQuantityIds(
          record,
          count,
          byId,
          requestedIds,
          indexBudget
        );
      }
    }
  }
  traversal.seen.delete(value);
  return summary;
}

type SelectedSourcePrintfulPostcardConsumer = {
  product: Record<string, unknown>;
  variants: unknown[];
  variantCount: number;
};

/** The printful postcard shape both single-quantity readers depend on. */
function readSelectedSourcePrintfulPostcardConsumer(
  productData: unknown
): SelectedSourcePrintfulPostcardConsumer | null {
  const record = parseSelectedSourceRecord(productData);
  const specs = parseSelectedSourceRecord(record?.specs);
  if (specs?.type !== "stationery") return null;
  if (specs.subtype !== "postcard" && specs.subtype !== "greeting-card") {
    return null;
  }
  const raw = readSelectedSourceConsumerRawProjection(productData);
  const payloads = parseSelectedSourceRecord(raw?.payloads);
  const details = parseSelectedSourceRecord(payloads?.details);
  if (!details) return null;
  const product =
    parseSelectedSourceRecord(details.product) ??
    parseSelectedSourceRecord(payloads?.product);
  if (product?.type !== "POSTCARD") return null;
  if ((parseSelectedSourceArray(product.options)?.length ?? 0) > 0) return null;
  const variants = parseSelectedSourceArray(details.variants);
  const variantCount = readSelectedSourceIntegerCount(product.variant_count);
  if (!variants || variantCount === null || variantCount !== variants.length) {
    return null;
  }
  return { product, variants, variantCount };
}

function readSelectedSourcePrintfulProductSingleCount(
  product: Record<string, unknown>
): number | null {
  return explicitSelectedSourcePrintRunQuantityFromTextValues([
    ...readSelectedSourceTextValues(product.title),
    ...readSelectedSourceTextValues(product.type_name),
    ...readSelectedSourceTextValues(product.model),
    ...readSelectedSourceTextValues(product.description),
  ]);
}

function readPrintfulSingleQuantitiesBySupplierVariantId(
  productData: unknown,
  requestedIds: ReadonlySet<string> | undefined,
  indexBudget: SelectedSourceIndexBudget
): ReadonlyMap<string, number> {
  const result = new Map<string, number>();
  const consumer = readSelectedSourcePrintfulPostcardConsumer(productData);
  if (!consumer) return result;
  const productSingleCount = readSelectedSourcePrintfulProductSingleCount(
    consumer.product
  );
  for (const rawVariant of consumer.variants) {
    const variant = parseSelectedSourceRecord(rawVariant);
    const id = String(variant?.id ?? "").trim();
    if (!id || (requestedIds && !requestedIds.has(id))) continue;
    const single =
      consumer.variantCount === 1 ||
      (explicitSelectedSourcePrintRunQuantityFromTextValues(
        readSelectedSourceTextValues(variant)
      ) === 1 &&
        productSingleCount === 1);
    if (!single) continue;
    if (!result.has(id)) reserveSelectedSourceIndexId(id, indexBudget);
    result.set(id, 1);
  }
  return result;
}

export function readSelectedSourceStructuredProductConsumerIndex(
  productData: unknown,
  options: { supplierVariantIds?: ReadonlySet<string> } = {}
): SelectedSourceStructuredProductConsumerIndex {
  const matched = new Map<string, SelectedSourceCountSummary>();
  const indexBudget: SelectedSourceIndexBudget = { entries: 0, idBytes: 0 };
  const raw = readSelectedSourceConsumerRawProjection(productData);
  if (raw) {
    readMatchedSelectedSourceQuantities(
      raw,
      matched,
      options.supplierVariantIds,
      indexBudget,
      { nodes: 0, seen: new WeakSet<object>() }
    );
  }
  const matchedQuantities = [...matched].flatMap(([id, summary]) =>
    !summary.ambiguous && summary.value !== null
      ? [[id, summary.value] as const]
      : []
  );
  const printfulSingles = readPrintfulSingleQuantitiesBySupplierVariantId(
    productData,
    options.supplierVariantIds,
    indexBudget
  );
  return {
    pageCount: readSelectedSourceProductPageCount(productData),
    matchedQuantityBySupplierVariantId: new Map(matchedQuantities),
    printfulSingleQuantityBySupplierVariantId: printfulSingles,
    indexEntryCount: indexBudget.entries,
    indexIdBytes: indexBudget.idBytes,
  };
}

export function selectedSourceStructuredVariantConsumerProjection(
  variant: SelectedSourceStructuredVariantFactInput,
  prepared?: SelectedSourceStructuredProductConsumerIndex
): {
  quantity: number | null;
  pageCount: number | null;
  protectedPaperSize: string | null;
} {
  const protectedPaperSize = variant.size
    ? createNormalizedVariantSizeValue(
        {
          categorySlug: "stationery",
          specType: readSelectedSourceProductSpecType(variant.productData),
          supplierId: variant.supplierId,
          productId: variant.productId,
          productName: variant.productName,
        },
        variant.size
      )
    : null;
  return {
    quantity: readSelectedSourceVariantQuantityCount(variant, prepared),
    pageCount: prepared
      ? prepared.pageCount
      : readSelectedSourceProductPageCount(variant.productData),
    protectedPaperSize,
  };
}

function readSelectedSourceConsumerRawProjection(
  data: unknown
): Record<string, unknown> | null {
  const raw = parseSelectedSourceRecord(
    parseSelectedSourceRecord(data)?.raw
  );
  if (!raw) return null;
  const projection: Record<string, unknown> = {};
  for (const key of ["payloads", "cache", "sourceCategories"] as const) {
    if (Object.hasOwn(raw, key)) projection[key] = raw[key];
  }
  return projection;
}

function readSelectedSourceProductPageCount(data: unknown): number | null {
  const record = parseSelectedSourceRecord(data);
  const specs = parseSelectedSourceRecord(record?.specs);
  const specPages = readSelectedSourceIntegerCount(specs?.pages);
  if (specPages !== null) return specPages;

  return readExplicitSelectedSourcePageCountFromData(
    readSelectedSourceConsumerRawProjection(data)
  );
}

function readSelectedSourceVariantQuantityCount(
  variant: SelectedSourceStructuredVariantFactInput,
  prepared?: SelectedSourceStructuredProductConsumerIndex
): number | null {
  const structured = readSelectedSourceVariantSpecQuantityCount(variant.data);
  if (structured !== null) return structured;
  const idQuantity = explicitSelectedSourcePrintRunQuantityFromText(
    variant.supplierVariantId
  );
  if (idQuantity !== null) return idQuantity;
  const supplierVariantId = variant.supplierVariantId?.trim();
  if (supplierVariantId) {
    const matched = prepared
      ? prepared.matchedQuantityBySupplierVariantId.get(supplierVariantId) ?? null
      : explicitSelectedSourcePrintRunQuantityFromMatchedRawVariant({
          productData: variant.productData,
          supplierVariantId,
        });
    if (matched !== null) return matched;
    const printfulSingle = prepared
      ? variant.supplierId === "printful"
        ? prepared.printfulSingleQuantityBySupplierVariantId.get(
          supplierVariantId
        ) ?? null
        : null
      : printfulSingleStationeryQuantityFromSelectedSourceVariant(variant);
    if (printfulSingle !== null) return printfulSingle;
  }
  return (
    singleStationeryCardQuantityFromSelectedSourceProductLabel(variant) ??
    explicitSelectedSourcePrintRunQuantityFromText(variant.productName) ??
    explicitSelectedSourcePrintRunQuantityFromText(variant.productId)
  );
}

function singleStationeryCardQuantityFromSelectedSourceProductLabel(
  variant: SelectedSourceStructuredVariantFactInput
): number | null {
  if (readSelectedSourceProductSpecType(variant.productData) !== "stationery") {
    return null;
  }
  const subtype = readSelectedSourceProductSpecSubtype(variant.productData);
  if (subtype !== "postcard" && subtype !== "greeting-card") {
    return null;
  }
  const count = explicitSelectedSourceSinglePrintRunQuantityFromText(
    variant.productName
  );
  return count === 1 ? count : null;
}

function explicitSelectedSourcePrintRunQuantityFromText(
  value: string | null | undefined
): number | null {
  if (!value) return null;
  const normalized = value.trim();
  const patterns = [
    /(?:^|[\s_-])qt[\s_-]*(\d+)[\s_-]*pcs?(?:$|[\s_-])/i,
    /\bpack[\s_-]+of[\s_-]+(\d+)\b/i,
    /\b(\d+)[\s_-]*pack\b/i,
    /\b(\d+)\s*(?:pcs?|pieces)\b/i,
  ] as const;
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    const count = readSelectedSourceIntegerCount(match?.[1]);
    if (count !== null) return count;
  }
  return null;
}

function explicitSelectedSourceSinglePrintRunQuantityFromText(
  value: string | null | undefined
): number | null {
  if (!value) return null;
  const normalized = value.trim();
  if (/^single$/i.test(normalized)) return 1;
  if (/^(?:greeting\s+card|postcard)$/i.test(normalized)) return 1;
  if (
    /\b(?:a|an|one)\s+(?:(?!(?:side|sided|size|colour|color)\b)[\p{L}\p{N}"'’.(),/×x″-]+\s+){0,10}(?:postcards?|cards?|flyers?|prints?)\b/iu.test(
      normalized
    )
  ) {
    return 1;
  }
  return null;
}

function explicitSelectedSourcePrintRunQuantityFromTextValues(
  values: readonly string[]
): number | null {
  const counts = new Set<number>();
  for (const value of values) {
    const count =
      explicitSelectedSourcePrintRunQuantityFromText(value) ??
      explicitSelectedSourceSinglePrintRunQuantityFromText(value);
    if (count !== null) counts.add(count);
  }
  return soleMember(counts) ?? null;
}

function collectSelectedSourceMatchedSupplierVariantRecords(input: {
  value: unknown;
  supplierVariantId: string;
  output?: unknown[];
}): unknown[] {
  const output = input.output ?? [];
  if (!isSelectedSourceContainer(input.value)) return output;
  if (Array.isArray(input.value)) {
    for (const item of input.value) {
      collectSelectedSourceMatchedSupplierVariantRecords({
        value: item,
        supplierVariantId: input.supplierVariantId,
        output,
      });
    }
    return output;
  }
  const record = parseSelectedSourceRecord(input.value);
  if (!record) return output;
  if (selectedSourceRecordHasSupplierVariantId(record, input.supplierVariantId)) {
    output.push(record);
  }
  for (const item of Object.values(record)) {
    collectSelectedSourceMatchedSupplierVariantRecords({
      value: item,
      supplierVariantId: input.supplierVariantId,
      output,
    });
  }
  return output;
}

function selectedSourceRecordHasSupplierVariantId(
  record: Record<string, unknown>,
  supplierVariantId: string
): boolean {
  for (const key of ["sku", "id", "variantId", "variant_id"] as const) {
    const value = record[key];
    if (value === null || value === undefined) continue;
    if (String(value).trim() === supplierVariantId) return true;
  }
  return false;
}

function explicitSelectedSourcePrintRunQuantityFromMatchedRawVariant(input: {
  productData: unknown;
  supplierVariantId: string | null | undefined;
}): number | null {
  const supplierVariantId = input.supplierVariantId?.trim();
  if (!supplierVariantId) return null;
  const raw = readSelectedSourceConsumerRawProjection(input.productData);
  if (!raw) return null;
  const matches = collectSelectedSourceMatchedSupplierVariantRecords({
    value: raw,
    supplierVariantId,
  });
  const counts = new Set<number>();
  for (const record of matches) {
    const count = explicitSelectedSourcePrintRunQuantityFromTextValues(
      readSelectedSourceTextValues(record)
    );
    if (count !== null) counts.add(count);
  }
  return soleMember(counts) ?? null;
}

function printfulSingleStationeryQuantityFromSelectedSourceVariant(
  variant: SelectedSourceStructuredVariantFactInput
): number | null {
  if (variant.supplierId !== "printful") return null;
  const consumer = readSelectedSourcePrintfulPostcardConsumer(variant.productData);
  if (!consumer) return null;
  const supplierVariantId = variant.supplierVariantId?.trim();
  const variantRecord = consumer.variants
    .map(rawVariant => parseSelectedSourceRecord(rawVariant))
    .find(record => String(record?.id ?? "").trim() === supplierVariantId);
  if (!supplierVariantId || !variantRecord) return null;
  if (consumer.variantCount === 1) return 1;
  const variantCountLabel = explicitSelectedSourcePrintRunQuantityFromTextValues(
    readSelectedSourceTextValues(variantRecord)
  );
  if (variantCountLabel !== null && variantCountLabel !== 1) return null;
  return readSelectedSourcePrintfulProductSingleCount(consumer.product) === 1
    ? 1
    : null;
}

function explicitSelectedSourcePageCountFromText(
  value: string | null | undefined
): number | null {
  return parseExplicitPageCountFromText(value);
}

function readSelectedSourceTextValues(value: unknown): string[] {
  const output: string[] = [];
  const stack: Array<{ value: unknown; depth: number }> = [{ value, depth: 0 }];
  const seen = new WeakSet<object>();
  let nodes = 0;
  let textBytes = 0;
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) break;
    nodes += 1;
    if (
      nodes > MAX_SELECTED_SOURCE_TRAVERSAL_NODES ||
      current.depth > MAX_SELECTED_SOURCE_TRAVERSAL_DEPTH
    ) {
      throw new SelectedSourceEvidenceBudgetExceededError("Selected-source text traversal exceeds its bounded limit.");
    }
    if (isSelectedSourceText(current.value)) {
      textBytes += SELECTED_SOURCE_UTF8_ENCODER.encode(current.value).byteLength;
      if (
        output.length >= MAX_SELECTED_SOURCE_INDEX_ENTRIES ||
        textBytes > MAX_SELECTED_SOURCE_INDEX_ID_BYTES
      ) {
        throw new SelectedSourceEvidenceBudgetExceededError("Selected-source text traversal exceeds its bounded byte limit.");
      }
      output.push(current.value);
      continue;
    }
    if (!isSelectedSourceContainer(current.value)) continue;
    if (seen.has(current.value)) {
      throw new Error("Selected-source text traversal is cyclic.");
    }
    seen.add(current.value);
    if (Array.isArray(current.value)) {
      for (let index = current.value.length - 1; index >= 0; index -= 1) {
        stack.push({ value: current.value[index], depth: current.depth + 1 });
      }
      continue;
    }
    const record = parseSelectedSourceRecord(current.value);
    if (!record) continue;
    const keys = Object.keys(record);
    if (keys.length > MAX_SELECTED_SOURCE_INDEX_ENTRIES) {
      throw new SelectedSourceEvidenceBudgetExceededError("Selected-source text traversal exceeds its bounded width limit.");
    }
    for (let index = keys.length - 1; index >= 0; index -= 1) {
      const key = keys[index];
      if (key !== undefined) {
        stack.push({
          value: record[key],
          depth: current.depth + 1,
        });
      }
    }
  }
  return output;
}

function readExplicitSelectedSourcePageCountFromData(data: unknown): number | null {
  const counts = new Set<number>();
  for (const text of readSelectedSourceTextValues(data)) {
    const count = explicitSelectedSourcePageCountFromText(text);
    if (count !== null) counts.add(count);
  }
  return soleMember(counts) ?? null;
}

function parseSelectedSourceRecord(
  value: unknown
): Record<string, unknown> | null {
  return readUnknownRecord(value);
}

function parseSelectedSourceArray(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null;
}

function isSelectedSourceCountSeed(value: unknown): value is number | string {
  return typeof value === "number" || typeof value === "string";
}

function readSelectedSourceIntegerCount(value: unknown): number | null {
  if (!isSelectedSourceCountSeed(value)) return null;
  const count = Number(value);
  if (!Number.isInteger(count) || count <= 0) return null;
  return count;
}
