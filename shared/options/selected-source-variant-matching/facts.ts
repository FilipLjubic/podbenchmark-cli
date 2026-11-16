import { compareUtf8Bytes, utf8ByteLength } from "../../kernel/canonical-order.ts";
import { readUnknownRecord } from "../../schemas/record";
import { required } from "../../kernel/required.ts";
import { isBooleanValue, isNumberValue } from "../../kernel/primitives";
import { isTextValue, readNonBlankString } from "../../kernel/text";
import { createNormalizedVariantSizeValue } from "../../sizing/variant-size-normalization";
import type {
  SelectedSourceVariantFactState,
  SelectedSourceVariantProfileFact,
} from "./types";

export const MAX_SELECTED_SOURCE_PROFILE_ROWS_PER_PROFILE = 1_000;
export const MAX_SELECTED_SOURCE_PROFILE_BYTES_PER_PROFILE = 1_048_576;

type SelectedSourceProfileBudgetRow = {
  id: string;
  variantProfileId: string;
  field: string;
  valueJson: unknown;
  normalizedValue: string | null;
  numericValue: number | null;
  originScope: string | null;
  normalizationStatus: string | null;
  source: string | null;
  evidencePath: string | null;
  confidence: number | null;
};

/** Exact consumer-side row projection used by runtime and QA byte budgets. */
export function selectedSourceProfileValueRowBudgetBytes(
  row: SelectedSourceProfileBudgetRow
): number {
  const serialized = JSON.stringify({
    id: row.id,
    variantProfileId: row.variantProfileId,
    field: row.field,
    valueJson: row.valueJson,
    normalizedValue: row.normalizedValue,
    numericValue: row.numericValue,
    originScope: row.originScope,
    normalizationStatus: row.normalizationStatus,
    source: row.source,
    evidencePath: row.evidencePath,
    confidence: row.confidence,
  });
  return new TextEncoder().encode(serialized).byteLength;
}

const SELECTED_SOURCE_PROFILE_FACT_FIELD_ALIASES = [
  { policyField: "deviceFit", profileField: "size" },
  { policyField: "pageCount", profileField: "pages" },
] as const;

/** Decode a JSON-column fact value into raw scalar text; non-scalars stay unknown. */
function isRawProfileFactScalar(
  value: unknown
): value is string | number | boolean {
  return isTextValue(value) || isNumberValue(value) || isBooleanValue(value);
}

function readRawProfileFactValue(value: unknown): string | null {
  return isRawProfileFactScalar(value) ? String(value) : null;
}

export function selectedSourceProfileValueRowToFact(row: {
  field: string;
  valueJson: unknown;
  normalizedValue: string | null;
  numericValue: number | null;
  originScope: string | null;
  normalizationStatus: string | null;
  source: string | null;
  evidencePath: string | null;
  confidence: number | null;
}): SelectedSourceVariantProfileFact {
  // Every decoded database row carries JSON-column evidence: plain data only.
  return markSelectedSourceProfileFactJsonTrusted({
    field: row.field,
    normalizedValue: row.normalizedValue,
    rawValue: readRawProfileFactValue(row.valueJson),
    state:
      row.normalizationStatus === "absent"
        ? "absent"
        : row.normalizedValue
          ? "ready"
          : "unnormalized",
    originScope: row.originScope,
    normalizationStatus: row.normalizationStatus,
    valueJson: row.valueJson,
    numericValue: row.numericValue,
    source: row.source,
    evidencePath: row.evidencePath,
    confidence: row.confidence,
  });
}

function selectedSourceVariantFactSignatureProjection(
  fact: SelectedSourceVariantProfileFact
) {
  return {
    field: fact.field,
    normalizedValue: readNonBlankString(fact.normalizedValue),
    rawValue: readNonBlankString(fact.rawValue),
    state: fact.state ?? inferFactState(fact),
    originScope: readNonBlankString(fact.originScope),
    normalizationStatus: readNonBlankString(fact.normalizationStatus),
    sourceAxisKey: readNonBlankString(fact.sourceAxisKey),
    valueJson: fact.valueJson ?? null,
    numericValue: fact.numericValue ?? null,
    source: readNonBlankString(fact.source),
    evidencePath: readNonBlankString(fact.evidencePath),
    confidence: fact.confidence ?? null,
  };
}

/** Apply the full signature's aggregate guards without retaining its JSON text. */
export function assertSelectedSourceVariantFactsSignatureValid(
  facts: readonly SelectedSourceVariantProfileFact[],
  cache?: SelectedSourceFactSignatureCache
): void {
  readSelectedSourceVariantFactMetrics(facts, cache);
}

export function buildSelectedSourceVariantFactsSignature(
  facts: readonly SelectedSourceVariantProfileFact[],
  cache?: SelectedSourceFactSignatureCache
): string {
  const metrics = readSelectedSourceVariantFactMetrics(facts, cache);
  metrics.sort((left, right) => compareUtf8Bytes(left.signature, right.signature));
  return `[${metrics.map(entry => entry.signature).join(",")}]`;
}

/**
 * One fact's canonical signature plus the traversal boundaries it contributes
 * to its profile. Rendering a fact is the expensive part of a profile
 * signature, and profile-scope planning revisits the same fact objects across
 * sources, targets and passes, so each object renders once.
 */
type SelectedSourceFactSignatureMetrics = {
  signature: string;
  nodes: number;
  keys: number;
  bytes: number;
  /** Containers visited inside this fact's value JSON, in traversal order. */
  containers: readonly object[];
  /** The fact instance whose value JSON `containers` describes. */
  ownerFact: SelectedSourceVariantProfileFact;
};

/**
 * Facts built from decoded database JSON are plain JSON.parse output. Their
 * value JSON cannot hold accessors, cycles, dates or non-finite numbers, so a
 * JSON text key safely identifies equal evidence before it is rendered.
 */
const jsonTrustedFacts = new WeakSet<SelectedSourceVariantProfileFact>();

function markSelectedSourceProfileFactJsonTrusted<T extends SelectedSourceVariantProfileFact>(
  fact: T
): T {
  jsonTrustedFacts.add(fact);
  return fact;
}

/**
 * Per-evaluator memo for immutable fact snapshots. Callers without such a
 * contract pass no cache, so a mutated fact is always re-rendered.
 */
type SelectedSourceFactSignatureCache = {
  byFact: WeakMap<
    SelectedSourceVariantProfileFact,
    SelectedSourceFactSignatureMetrics
  >;
  /** Equal trusted evidence rendered once, however many profiles carry it. */
  byContent: Map<string, SelectedSourceFactSignatureMetrics>;
};

export function createSelectedSourceFactSignatureCache(): SelectedSourceFactSignatureCache {
  return { byFact: new WeakMap(), byContent: new Map() };
}

/** Canonical signature for one fact, rendered once per cache and fact object. */
export function selectedSourceVariantFactSignature(
  fact: SelectedSourceVariantProfileFact,
  cache?: SelectedSourceFactSignatureCache
): string {
  return selectedSourceVariantFactMetrics(fact, cache).signature;
}

function selectedSourceVariantFactMetrics(
  fact: SelectedSourceVariantProfileFact,
  cache: SelectedSourceFactSignatureCache | undefined
): SelectedSourceFactSignatureMetrics {
  const cached = cache?.byFact.get(fact);
  if (cached) return cached;
  const metrics = selectedSourceVariantFactMetricsForProjection(
    fact,
    selectedSourceVariantFactSignatureProjection(fact),
    cache
  );
  cache?.byFact.set(fact, metrics);
  return metrics;
}

/**
 * Reuse a rendered fact for equal trusted evidence. The projection's value JSON
 * is JSON-safe, so equal JSON text means equal canonical evidence; unequal key
 * order simply misses and renders again. A reused entry describes the fact
 * instance that rendered it, so this instance keeps only its own value JSON
 * root as a shareable container.
 */
function selectedSourceVariantFactMetricsForProjection(
  fact: SelectedSourceVariantProfileFact,
  projection: SignatureFactProjection,
  cache: SelectedSourceFactSignatureCache | undefined
): SelectedSourceFactSignatureMetrics {
  if (cache && jsonTrustedFacts.has(fact)) {
    const key = JSON.stringify(projection);
    const cached = key === undefined ? undefined : cache.byContent.get(key);
    if (cached) {
      return cached.ownerFact === fact
        ? cached
        : {
            ...cached,
            ownerFact: fact,
            containers: isCanonicalJsonContainer(projection.valueJson)
              ? [projection.valueJson]
              : [],
          };
    }
    const metrics = renderSelectedSourceVariantFact(projection, fact);
    if (key !== undefined) cache.byContent.set(key, metrics);
    return metrics;
  }
  return renderSelectedSourceVariantFact(projection, fact);
}

/**
 * Validate a profile's facts and return each fact's canonical metrics, in the
 * input order the canonical traversal visits them. Errors and aggregate bounds
 * match the full canonical walk: arrays stay dense and bounded, keys and nodes
 * stay within their limits, and no JSON object may cross facts.
 */
function readSelectedSourceVariantFactMetrics(
  facts: readonly SelectedSourceVariantProfileFact[],
  cache: SelectedSourceFactSignatureCache | undefined
): SelectedSourceFactSignatureMetrics[] {
  if (
    facts.length > CANONICAL_JSON_MAX_CONTAINER_ENTRIES ||
    Object.keys(facts).length !== facts.length
  ) {
    throw new Error(
      "Selected-source canonical JSON exceeds the bounded array limit."
    );
  }
  // Project every uncached fact before traversing any value JSON, so a broken
  // projection reports before nested evidence does.
  const projections = facts.map(fact =>
    cache?.byFact.has(fact)
      ? null
      : selectedSourceVariantFactSignatureProjection(fact)
  );
  const metrics: SelectedSourceFactSignatureMetrics[] = [];
  const containers = new Set<object>();
  let nodes = 1;
  let keys = 0;
  let bytes = facts.length === 0 ? 2 : facts.length + 1;
  for (const [index, fact] of facts.entries()) {
    const entry = selectedSourceVariantFactMetricsFromProjection(
      fact,
      projections[index] ?? null,
      cache
    );
    for (const container of entry.containers) {
      if (containers.has(container)) {
        throw new Error(
          "Selected-source canonical JSON contains a cycle or shared object."
        );
      }
      containers.add(container);
    }
    // The canonical walk charges a fact's wrapper and object keys before the
    // nodes nested below them, so keys are checked first.
    keys += entry.keys;
    if (keys > CANONICAL_JSON_MAX_KEYS) {
      throw new Error(
        "Selected-source canonical JSON exceeds the bounded key limit."
      );
    }
    nodes += entry.nodes;
    if (nodes > CANONICAL_JSON_MAX_NODES) {
      throw new Error(
        "Selected-source canonical JSON exceeds the bounded node limit."
      );
    }
    bytes += entry.bytes;
    if (bytes > CANONICAL_JSON_MAX_BYTES) {
      throw new Error(
        "Selected-source canonical JSON exceeds the bounded byte limit."
      );
    }
    metrics.push(entry);
  }
  return metrics;
}

function selectedSourceVariantFactMetricsFromProjection(
  fact: SelectedSourceVariantProfileFact,
  projection: SignatureFactProjection | null,
  cache: SelectedSourceFactSignatureCache | undefined
): SelectedSourceFactSignatureMetrics {
  const cached = cache?.byFact.get(fact);
  if (cached) return cached;
  const metrics = selectedSourceVariantFactMetricsForProjection(
    fact,
    required(projection, "a signature projection for an uncached fact"),
    cache
  );
  cache?.byFact.set(fact, metrics);
  return metrics;
}

type CanonicalFactRenderState = {
  nodes: number;
  keys: number;
  chars: number;
};

function pushCanonicalFactChunk(
  state: CanonicalFactRenderState,
  chunks: string[],
  chunk: string
): void {
  state.chars += chunk.length;
  // UTF-8 is never shorter than the UTF-16 code units it encodes, so the byte
  // budget cannot be met after this many characters.
  if (state.chars > CANONICAL_JSON_MAX_BYTES) {
    throw new Error(
      "Selected-source canonical JSON exceeds the bounded byte limit."
    );
  }
  chunks.push(chunk);
}

/**
 * Render one fact exactly like the canonical profile walker, while counting
 * the nodes, keys and UTF-8 bytes that fact contributes and recording the
 * containers inside its value JSON for the cross-fact sharing guard.
 */
function renderSelectedSourceVariantFact(
  projection: SignatureFactProjection,
  ownerFact: SelectedSourceVariantProfileFact
): SelectedSourceFactSignatureMetrics {
  const chunks: string[] = [];
  const containers: object[] = [];
  const seen = new Set<object>();
  const state: CanonicalFactRenderState = {
    nodes: 1,
    keys: SIGNATURE_FACT_LAYOUT.length,
    chars: 0,
  };
  pushCanonicalFactChunk(state, chunks, "{");
  for (const [index, layout] of SIGNATURE_FACT_LAYOUT.entries()) {
    if (index > 0) chunks.push(",");
    chunks.push(layout.token, ":");
    readCanonicalJsonValueChunks(
      projection[layout.key],
      2,
      state,
      chunks,
      seen,
      containers
    );
  }
  pushCanonicalFactChunk(state, chunks, "}");
  const signature = chunks.join("");
  return {
    signature,
    nodes: state.nodes,
    keys: state.keys,
    bytes: utf8ByteLength(signature),
    containers,
    ownerFact,
  };
}

function readCanonicalJsonValueChunks(
  value: unknown,
  depth: number,
  state: CanonicalFactRenderState,
  chunks: string[],
  seen: Set<object>,
  containers: object[]
): void {
  if (!isCanonicalJsonContainer(value)) {
    const token = readCanonicalScalarToken(value);
    state.nodes += 1;
    if (state.nodes > CANONICAL_JSON_MAX_NODES) {
      throw new Error(
        "Selected-source canonical JSON exceeds the bounded node limit."
      );
    }
    if (depth > CANONICAL_JSON_MAX_DEPTH) {
      throw new Error(
        "Selected-source canonical JSON exceeds the bounded depth limit."
      );
    }
    pushCanonicalFactChunk(state, chunks, token);
    return;
  }
  state.nodes += 1;
  if (state.nodes > CANONICAL_JSON_MAX_NODES) {
    throw new Error(
      "Selected-source canonical JSON exceeds the bounded node limit."
    );
  }
  if (depth > CANONICAL_JSON_MAX_DEPTH) {
    throw new Error(
      "Selected-source canonical JSON exceeds the bounded depth limit."
    );
  }
  if (seen.has(value)) {
    throw new Error(
      "Selected-source canonical JSON contains a cycle or shared object."
    );
  }
  seen.add(value);
  containers.push(value);
  if (Array.isArray(value)) {
    if (
      value.length > CANONICAL_JSON_MAX_CONTAINER_ENTRIES ||
      Object.keys(value).length !== value.length
    ) {
      throw new Error(
        "Selected-source canonical JSON exceeds the bounded array limit."
      );
    }
    pushCanonicalFactChunk(state, chunks, "[");
    for (let index = 0; index < value.length; index += 1) {
      if (index > 0) chunks.push(",");
      readCanonicalJsonValueChunks(
        value[index],
        depth + 1,
        state,
        chunks,
        seen,
        containers
      );
    }
    pushCanonicalFactChunk(state, chunks, "]");
    return;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error(
      "Selected-source canonical JSON contains a non-plain object."
    );
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const entries = Object.keys(descriptors).sort(compareUtf8Bytes);
  state.keys += entries.length;
  if (
    entries.length > CANONICAL_JSON_MAX_CONTAINER_ENTRIES ||
    state.keys > CANONICAL_JSON_MAX_KEYS
  ) {
    throw new Error(
      "Selected-source canonical JSON exceeds the bounded key limit."
    );
  }
  const descriptorOf = (key: string) =>
    required(descriptors[key], "a property descriptor for an own key");
  for (const key of entries) {
    if (!("value" in descriptorOf(key))) {
      throw new Error(
        "Selected-source canonical JSON cannot evaluate accessors."
      );
    }
  }
  pushCanonicalFactChunk(state, chunks, "{");
  for (const [index, key] of entries.entries()) {
    if (index > 0) chunks.push(",");
    pushCanonicalFactChunk(state, chunks, JSON.stringify(key));
    chunks.push(":");
    readCanonicalJsonValueChunks(
      descriptorOf(key).value,
      depth + 1,
      state,
      chunks,
      seen,
      containers
    );
  }
  pushCanonicalFactChunk(state, chunks, "}");
}

export function buildSelectedSourceVariantSemanticFactsSignature(
  facts: readonly SelectedSourceVariantProfileFact[]
): string {
  const signatureFacts = facts.map(fact => ({
    field: fact.field,
    normalizedValue: readNonBlankString(fact.normalizedValue),
    rawValue: readNonBlankString(fact.rawValue),
    state: fact.state ?? inferFactState(fact),
    originScope: readNonBlankString(fact.originScope),
    normalizationStatus: readNonBlankString(fact.normalizationStatus),
    sourceAxisKey: readNonBlankString(fact.sourceAxisKey),
    valueJson: fact.valueJson ?? null,
    numericValue: fact.numericValue ?? null,
  }));
  const keyedFacts = signatureFacts.map(fact => ({
    fact,
    key: normalizeCanonicalJsonText(fact),
  }));
  keyedFacts.sort((left, right) => compareUtf8Bytes(left.key, right.key));
  return normalizeCanonicalJsonText(keyedFacts.map(entry => entry.fact));
}

export function expandSelectedSourceVariantProfileFactQueryFields(
  fields: readonly string[]
): string[] {
  const expanded = new Set(fields);
  for (const alias of SELECTED_SOURCE_PROFILE_FACT_FIELD_ALIASES) {
    if (expanded.has(alias.policyField)) {
      expanded.add(alias.profileField);
    }
  }
  return [...expanded].sort(compareUtf8Bytes);
}

export function selectedSourcePolicyFieldForProfileField(input: {
  profileField: string;
  policyFields: readonly string[];
}): string | null {
  // Called per fact on every planned profile: a policy has a dozen or so
  // fields, so scanning them beats building a set each call.
  if (input.policyFields.includes(input.profileField)) {
    return input.profileField;
  }
  return (
    SELECTED_SOURCE_PROFILE_FACT_FIELD_ALIASES.find(
      alias =>
        alias.profileField === input.profileField &&
        input.policyFields.includes(alias.policyField)
    )?.policyField ?? null
  );
}

export function selectedSourceProfileFactsForPolicyFields(input: {
  fact: SelectedSourceVariantProfileFact;
  fields: readonly string[];
}): SelectedSourceVariantProfileFact[] {
  const policyField = selectedSourcePolicyFieldForProfileField({
    profileField: input.fact.field,
    policyFields: input.fields,
  });
  if (policyField === "quantity" && input.fact.field === "quantity") {
    return [normalizeOrderedQuantityFact(input.fact)];
  }

  if (policyField === input.fact.field) {
    return [input.fact];
  }

  if (
    policyField === "deviceFit" &&
    input.fact.field === "size"
  ) {
    const normalizedDeviceFit = readNonBlankString(input.fact.normalizedValue)?.startsWith("device-fit:")
      ? readNonBlankString(input.fact.normalizedValue)
      : normalizeRawDeviceFitSizeFact(input.fact);
    if (!normalizedDeviceFit) return [];
    return [
      markSelectedSourceProfileFactJsonTrusted({
        ...input.fact,
        field: "deviceFit",
        state: "ready",
        normalizedValue: normalizedDeviceFit,
        normalizationStatus: input.fact.normalizationStatus === "unknown"
          ? "legacy-derived"
          : input.fact.normalizationStatus,
      }),
    ];
  }

  if (policyField === "pageCount" && input.fact.field === "pages") {
    const count = normalizedPageCountFactValue(input.fact);
    if (count === null) {
      return [
        markSelectedSourceProfileFactJsonTrusted({
          ...input.fact,
          field: "pageCount",
          state: "unnormalized",
          normalizedValue: null,
          numericValue: null,
          normalizationStatus: "unknown",
          valueJson: {
            raw:
              input.fact.valueJson ??
              input.fact.rawValue ??
              input.fact.normalizedValue,
            count: null,
            unitKind: "pages",
          },
        }),
      ];
    }
    const structuredValue = structuredPageCountFactValue(input.fact, count);
    return [
      markSelectedSourceProfileFactJsonTrusted({
        ...input.fact,
        field: "pageCount",
        state: "ready",
        normalizedValue: `page-count:${count}`,
        numericValue: count,
        valueJson: structuredValue,
      }),
    ];
  }

  return [];
}

export function factState(
  fact: SelectedSourceVariantProfileFact | null
): SelectedSourceVariantFactState | "missing" {
  if (!fact) return "missing";
  return fact.state ?? inferFactState(fact);
}

export function inferFactState(
  fact: SelectedSourceVariantProfileFact
): SelectedSourceVariantFactState {
  if (readNonBlankString(fact.normalizationStatus) === "absent") {
    return "absent";
  }
  if (readNonBlankString(fact.normalizedValue)) return "ready";
  return "unnormalized";
}

export function normalizedFactValue(
  fact: SelectedSourceVariantProfileFact | null
): string | null {
  return readNonBlankString(fact?.normalizedValue);
}

export function normalizedNumericFactValue(
  value: number | string | null | undefined
): string | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  if (!normalized) return null;
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? String(numeric) : null;
}

function parsePositiveIntegerPageCount(value: unknown): number | null {
  if (isNumberValue(value)) {
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  }
  if (!isTextValue(value)) return null;
  const match = value
    .trim()
    .match(/^(\d+)(?:\s+pages?(?:\s*\(\s*\d+\s+sheets?\s*\))?)?$/i);
  if (!match) return null;
  const count = Number(match[1]);
  return Number.isSafeInteger(count) && count > 0 ? count : null;
}

function normalizedPageCountToken(value: string | null | undefined): number | null {
  const normalized = readNonBlankString(value);
  if (!normalized) return null;
  return parsePositiveIntegerPageCount(
    normalized.match(/^page-count:(\d+)$/i)?.[1] ?? null
  );
}

function normalizedPageCountFactValue(
  fact: SelectedSourceVariantProfileFact
): number | null {
  const candidates = [
    parsePositiveIntegerPageCount(fact.numericValue),
    parsePositiveIntegerPageCount(readPageCountJsonValue(fact.valueJson)),
    normalizedPageCountToken(fact.normalizedValue),
    parsePositiveIntegerPageCount(fact.rawValue),
  ].filter((value): value is number => value !== null);
  const distinct = [...new Set(candidates)];
  return distinct.length === 1 ? (distinct[0] ?? null) : null;
}

function structuredPageCountFactValue(
  fact: SelectedSourceVariantProfileFact,
  count: number
) {
  const record = readUnknownRecord(fact.valueJson);
  return {
    ...(record ?? {}),
    raw:
      record && "raw" in record
        ? record.raw
        : fact.valueJson ?? fact.rawValue ?? fact.normalizedValue ?? count,
    count,
    unitKind: "pages",
  };
}

function readPageCountJsonScalar(value: unknown): number | string | null {
  return isNumberValue(value) || isTextValue(value) ? value : null;
}

/** Decode whichever page-count representation a stored value JSON uses. */
function readPageCountJsonValue(value: unknown): number | string | null {
  const scalar = readPageCountJsonScalar(value);
  if (scalar !== null) return scalar;

  const record = readUnknownRecord(value);
  if (!record) return null;

  for (const candidate of [record.count, record.pages, record.pageCount]) {
    if (candidate === undefined) continue;
    return readPageCountJsonScalar(candidate);
  }
  return null;
}

// Facts are immutable, so profiles sharing one stored quantity fact share its
// normalized form too. Matcher caches key on fact objects; a fresh copy per
// profile made every planned profile pay its own signature and validation.
const normalizedOrderedQuantityFacts = new WeakMap<
  SelectedSourceVariantProfileFact,
  SelectedSourceVariantProfileFact
>();

function normalizeOrderedQuantityFact(
  fact: SelectedSourceVariantProfileFact
): SelectedSourceVariantProfileFact {
  let normalized = normalizedOrderedQuantityFacts.get(fact);
  if (!normalized) {
    normalized = buildNormalizedOrderedQuantityFact(fact);
    normalizedOrderedQuantityFacts.set(fact, normalized);
  }
  return normalized;
}

function buildNormalizedOrderedQuantityFact(
  fact: SelectedSourceVariantProfileFact
): SelectedSourceVariantProfileFact {
  const count = normalizedNumericFactValue(
    fact.numericValue ?? readPageCountJsonValue(fact.valueJson)
  );
  if (!count) return fact;
  const unitKind = normalizedOrderedQuantityUnitKind(fact) ?? "print-run";
  return markSelectedSourceProfileFactJsonTrusted({
    ...fact,
    state: "ready",
    normalizedValue: `quantity:${unitKind}:${count}`,
    numericValue: fact.numericValue ?? Number(count),
    valueJson: {
      raw: fact.valueJson ?? fact.rawValue ?? fact.normalizedValue,
      count: Number(count),
      unitKind,
    },
  });
}

function readOrderedQuantityKind(value: unknown): string | null {
  const record = readUnknownRecord(value);
  if (!record) return null;

  for (const candidate of [
    record.unitKind,
    record.countUnit,
    record.quantityKind,
  ]) {
    if (candidate === undefined) continue;
    if (!isTextValue(candidate)) return null;
    return candidate.trim() || null;
  }
  return null;
}

function normalizedOrderedQuantityUnitKind(
  fact: SelectedSourceVariantProfileFact
): string | null {
  const rawKind = readOrderedQuantityKind(fact.valueJson);
  if (rawKind) {
    return rawKind.toLowerCase();
  }
  const normalized = readNonBlankString(fact.normalizedValue);
  const match = normalized?.match(/^quantity:([^:]+):/i);
  return match?.[1]?.toLowerCase() ?? null;
}

function normalizeRawDeviceFitSizeFact(
  fact: SelectedSourceVariantProfileFact
): string | null {
  const rawValue =
    typeof fact.valueJson === "string"
      ? fact.valueJson
      : readNonBlankString(fact.rawValue);
  return rawValue
    ? createNormalizedVariantSizeValue("phone-cases", rawValue)
    : null;
}


type SignatureFactProjection = ReturnType<typeof selectedSourceVariantFactSignatureProjection>;

// These fresh wrappers have a fixed shape. Supplier values still use the full
// generic traversal; specialization is carried by private work kinds only.
const SIGNATURE_FACT_KEYS = [
  "confidence",
  "evidencePath",
  "field",
  "normalizationStatus",
  "normalizedValue",
  "numericValue",
  "originScope",
  "rawValue",
  "source",
  "sourceAxisKey",
  "state",
  "valueJson",
] satisfies readonly (keyof SignatureFactProjection)[];
const SIGNATURE_FACT_LAYOUT = [...SIGNATURE_FACT_KEYS]
  .sort(compareUtf8Bytes)
  .map(key => ({ key, token: JSON.stringify(key) }));

type CanonicalJsonWork =
  | { kind: "value"; value: unknown; depth: number }
  | { kind: "fact"; value: SignatureFactProjection; depth: number }
  | { kind: "profile"; value: readonly SignatureFactProjection[]; depth: number }
  | { kind: "token"; value: string };

const CANONICAL_JSON_MAX_DEPTH = 64;
const CANONICAL_JSON_MAX_NODES = 100_000;
const CANONICAL_JSON_MAX_KEYS = 100_000;
const CANONICAL_JSON_MAX_CONTAINER_ENTRIES = 10_000;
const CANONICAL_JSON_MAX_BYTES = 16 * 1024 * 1024;

/** Any non-null object at the canonical-JSON traversal boundary. */
function isCanonicalJsonContainer(value: unknown): value is object {
  return value !== null && typeof value === "object";
}

function readCanonicalScalarToken(value: unknown): string {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    throw new Error("Selected-source canonical JSON contains a non-JSON value.");
  }
  return serialized;
}

function enqueueCanonicalJsonArrayWork(
  work: CanonicalJsonWork[],
  candidate: readonly unknown[],
  depth: number,
  projections?: readonly SignatureFactProjection[],
): void {
  if (
    candidate.length > CANONICAL_JSON_MAX_CONTAINER_ENTRIES ||
    Object.keys(candidate).length !== candidate.length
  ) {
    throw new Error(
      "Selected-source canonical JSON exceeds the bounded array limit."
    );
  }
  work.push({ kind: "token", value: "]" });
  for (let index = candidate.length - 1; index >= 0; index -= 1) {
    const projection = projections?.[index];
    work.push(projection
      ? { kind: "fact", value: projection, depth: depth + 1 }
      : { kind: "value", value: candidate[index], depth: depth + 1 });
    if (index > 0) work.push({ kind: "token", value: "," });
  }
  work.push({ kind: "token", value: "[" });
}

/**
 * Decode any JSON-compatible value into canonical JSON text: keys sorted by
 * UTF-8 byte order under bounded traversal, throwing on cycles, accessors, or
 * non-JSON values. This is the shape-agnostic serialization boundary, so
 * callers may pass unparsed supplier JSON.
 */
export function normalizeCanonicalJsonText(value: unknown): string {
  return renderCanonicalJsonWork({ kind: "value", value, depth: 0 });
}

function renderCanonicalJsonWork(initial: CanonicalJsonWork): string {
  const chunks: string[] = [];
  readCanonicalJsonWork(initial, token => chunks.push(token));
  return chunks.join("");
}

/** Traverse arbitrary supplier JSON under the canonical serialization guards. */
function readCanonicalJsonWork(
  initial: CanonicalJsonWork,
  emit?: (token: string) => void
): void {
  const work: CanonicalJsonWork[] = [initial];
  const seen = new WeakSet<object>();
  let nodes = 0;
  let keys = 0;
  let bytes = 0;
  const append = (token: string): void => {
    bytes += utf8ByteLength(token);
    if (bytes > CANONICAL_JSON_MAX_BYTES) {
      throw new Error(
        "Selected-source canonical JSON exceeds the bounded byte limit."
      );
    }
    emit?.(token);
  };

  for (let item = work.pop(); item !== undefined; item = work.pop()) {
    if (item.kind === "token") {
      append(item.value);
      continue;
    }
    nodes += 1;
    if (nodes > CANONICAL_JSON_MAX_NODES) {
      throw new Error(
        "Selected-source canonical JSON exceeds the bounded node limit."
      );
    }
    if (item.depth > CANONICAL_JSON_MAX_DEPTH) {
      throw new Error(
        "Selected-source canonical JSON exceeds the bounded depth limit."
      );
    }
    if (item.kind === "profile") {
      enqueueCanonicalJsonArrayWork(work, item.value, item.depth, item.value);
      continue;
    }
    if (item.kind === "fact") {
      keys += SIGNATURE_FACT_LAYOUT.length;
      if (keys > CANONICAL_JSON_MAX_KEYS) {
        throw new Error("Selected-source canonical JSON exceeds the bounded key limit.");
      }
      work.push({ kind: "token", value: "}" });
      const projection: Readonly<Record<string, unknown>> = item.value;
      for (let index = SIGNATURE_FACT_LAYOUT.length - 1; index >= 0; index--) {
        const { key, token } = required(SIGNATURE_FACT_LAYOUT[index], "a signature fact layout entry");
        work.push({ kind: "value", value: projection[key], depth: item.depth + 1 });
        work.push({ kind: "token", value: ":" });
        work.push({ kind: "token", value: token });
        if (index > 0) work.push({ kind: "token", value: "," });
      }
      work.push({ kind: "token", value: "{" });
      continue;
    }
    const candidate = item.value;
    if (!isCanonicalJsonContainer(candidate)) {
      append(readCanonicalScalarToken(candidate));
      continue;
    }
    if (seen.has(candidate)) {
      throw new Error(
        "Selected-source canonical JSON contains a cycle or shared object."
      );
    }
    seen.add(candidate);
    if (Array.isArray(candidate)) {
      enqueueCanonicalJsonArrayWork(work, candidate, item.depth);
      continue;
    }
    const prototype = Object.getPrototypeOf(candidate);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error(
        "Selected-source canonical JSON contains a non-plain object."
      );
    }
    const descriptors = Object.getOwnPropertyDescriptors(candidate);
    const entries = Object.keys(descriptors).sort(compareUtf8Bytes);
    keys += entries.length;
    if (
      entries.length > CANONICAL_JSON_MAX_CONTAINER_ENTRIES ||
      keys > CANONICAL_JSON_MAX_KEYS
    ) {
      throw new Error(
        "Selected-source canonical JSON exceeds the bounded key limit."
      );
    }
    work.push({ kind: "token", value: "}" });
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const key = required(entries[index], "an entry below the entry count");
      const descriptor = required(descriptors[key], "a property descriptor for an own key");
      if (!("value" in descriptor)) {
        throw new Error(
          "Selected-source canonical JSON cannot evaluate accessors."
        );
      }
      work.push({
        kind: "value",
        value: descriptor.value,
        depth: item.depth + 1,
      });
      work.push({ kind: "token", value: ":" });
      work.push({ kind: "token", value: JSON.stringify(key) });
      if (index > 0) work.push({ kind: "token", value: "," });
    }
    work.push({ kind: "token", value: "{" });
  }
}
