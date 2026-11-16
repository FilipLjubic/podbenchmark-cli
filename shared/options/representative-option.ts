import { fnv1a32Hex } from "../kernel/fnv1a.ts";
import { getRecordedFamilyRepresentativePolicy } from "./selected-configuration-family";
import {
  getRepresentativeOptionPolicy,
  representativePolicyForCanonical,
  hasOwnedSupplierSize,
  type RepresentativeOptionCategoryPolicy,
  type RepresentativeOptionTypicalValuePreference,
} from "./representative-option-policy";
import { resolveOrdinalSizeSortKey } from "../sizing/size-sort-policy";

/** Prefix of every input fingerprint; bump it when ranking semantics change. */
export const REPRESENTATIVE_OPTION_FINGERPRINT_VERSION = "representative-v4";

export const REPRESENTATIVE_OPTION_STATUSES = [
  "selected",
  "single-supplier-selected",
  "no-shared-representative",
  "not-applicable",
  "evidence-blocked",
  "policy-not-ready",
] as const;

export type RepresentativeOptionStatus =
  (typeof REPRESENTATIVE_OPTION_STATUSES)[number];

export type RepresentativeOptionTupleValue = {
  field: string;
  normalizedValue: string;
};

export type RepresentativeOptionSupportInput = {
  supplierId: string;
  productId: string;
  variantProfileId: string;
  matchKind: "exact" | "equivalent";
  profileEvidenceComplete: boolean;
};

export type RepresentativeOptionCandidateInput = {
  stableKey: string;
  tuple: readonly RepresentativeOptionTupleValue[];
  support: readonly RepresentativeOptionSupportInput[];
};

export type RepresentativeOptionCanonicalIdentity = {
  comparisonClass: string;
  brand: string | null;
  model: string | null;
};

export type RepresentativeOptionCandidateEvidence = {
  stableKey: string;
  tuple: RepresentativeOptionTupleValue[];
  support: RepresentativeOptionSupportInput[];
  requiredAxesComplete: boolean;
  missingRequiredAxes: string[];
  undeclaredAxes: string[];
  exactSupplierIds: string[];
  equivalentSupplierIds: string[];
  coveredSupplierIds: string[];
  completeEvidenceSupplierIds: string[];
  incompleteEvidenceSupplierIds: string[];
  factors: {
    distinctSupplierCoverage: number;
    supportingProfileCount: number;
    stableKey: string;
  };
  eligible: boolean;
  reasonCodes: string[];
};

export type RepresentativeOptionProfileInventory = {
  totalProfileCount: number;
  productCount: number;
  multiProfileProductCount: number;
};

export type RepresentativeOptionResult = {
  canonicalId: string;
  categorySlug: string;
  policyId: string;
  policyVersion: string;
  fingerprintCanonicalIdentity: RepresentativeOptionCanonicalIdentity | null;
  status: RepresentativeOptionStatus;
  selectedStableKey: string | null;
  selectedTuple: RepresentativeOptionTupleValue[] | null;
  candidates: RepresentativeOptionCandidateEvidence[];
  distinctMappedSupplierIds: string[];
  completeCandidateSupplierIds: string[];
  profileInventory: RepresentativeOptionProfileInventory;
  decisiveReasonCodes: string[];
  inputFingerprint: string;
};

export function deriveRepresentativeOption(input: {
  canonicalId: string;
  categorySlug: string;
  policy: RepresentativeOptionCategoryPolicy | null;
  mappedSupplierIds: readonly string[];
  candidates: readonly RepresentativeOptionCandidateInput[];
  canonicalIdentity?: RepresentativeOptionCanonicalIdentity;
  profileInventory?: RepresentativeOptionProfileInventory;
}): RepresentativeOptionResult {
  input = { ...input, policy: representativePolicyForCanonical(input.policy, input.canonicalIdentity) };
  // A ready policy's evidence is already sorted exactly as the input
  // fingerprint needs it, so the fingerprint reuses these candidates instead
  // of sorting a second copy of every tuple and support list.
  const evidenceCandidates =
    input.policy?.readiness.status === "ready"
      ? buildRepresentativeCandidates(input.candidates, input.policy)
      : undefined;
  const setup = readRepresentativeOptionSetup(input, evidenceCandidates);
  if (!input.policy) {
    return buildRepresentativeEmptyResult(setup, {
      reasonCode: "category-policy-missing",
      status: "policy-not-ready",
    });
  }

  const policy = input.policy;
  const candidates = evidenceCandidates ?? [];

  if (policy.readiness.status !== "ready") {
    return buildRepresentativeEmptyResult(setup, {
      reasonCode: policy.readiness.reasonCode,
      status: policy.readiness.status,
      candidates,
    });
  }

  if (
    policy.canonicalEligibility?.kind === "verified-branded-identity" &&
    !hasVerifiedBrandedIdentity(input.canonicalIdentity)
  ) {
    return buildRepresentativeEmptyResult(setup, {
      reasonCode: policy.canonicalEligibility.reasonCode,
      status: "evidence-blocked",
      candidates,
    });
  }

  const { completeCandidates, completeCandidateSupplierIds } =
    readCompleteRepresentativeCandidates(candidates, policy);

  if (candidates.length === 0) {
    return buildRepresentativeEmptyResult(setup, {
      ...resolveRepresentativeNoCandidatesOutcome(policy, setup.profileInventory),
      candidates,
      completeCandidateSupplierIds,
    });
  }

  if (completeCandidates.length === 0) {
    return buildRepresentativeEmptyResult(setup, {
      reasonCode: "complete-representative-profile-evidence-missing",
      status: "evidence-blocked",
      candidates,
      completeCandidateSupplierIds,
    });
  }

  const selected = candidates.find(candidate => candidate.eligible) ?? null;
  if (!selected) {
    return buildRepresentativeNoSharedResult(setup, {
      policy,
      candidates,
      completeCandidateSupplierIds,
    });
  }

  return buildRepresentativeSelectedResult(setup, {
    selected,
    candidates,
    completeCandidateSupplierIds,
    typicalValuePreferences: policy.typicalValuePreferences,
  });
}

type RepresentativeOptionSetup = {
  readonly input: {
    canonicalId: string;
    categorySlug: string;
    canonicalIdentity?: RepresentativeOptionCanonicalIdentity;
  };
  readonly mappedSupplierIds: string[];
  readonly policyId: string;
  readonly policyVersion: string;
  readonly fingerprintCanonicalIdentity: RepresentativeOptionCanonicalIdentity | null;
  readonly profileInventory: RepresentativeOptionProfileInventory;
  readonly inputFingerprint: string;
};

function readRepresentativeOptionSetup(
  input: {
    canonicalId: string;
    categorySlug: string;
    policy: RepresentativeOptionCategoryPolicy | null;
    mappedSupplierIds: readonly string[];
    candidates: readonly RepresentativeOptionCandidateInput[];
    canonicalIdentity?: RepresentativeOptionCanonicalIdentity;
    profileInventory?: RepresentativeOptionProfileInventory;
  },
  evidenceCandidates?: readonly RepresentativeOptionCandidateEvidence[]
): RepresentativeOptionSetup {
  const mappedSupplierIds = uniqueSorted(input.mappedSupplierIds);
  const policyId = input.policy?.id ?? "unconfigured-representative-option";
  const policyVersion = input.policy?.version ?? "0";
  const fingerprintCanonicalIdentity = input.canonicalIdentity ?? null;
  const profileInventory = input.profileInventory ?? {
    totalProfileCount: 0,
    productCount: 0,
    multiProfileProductCount: 0,
  };
  const inputFingerprint = buildFingerprint({
    canonicalId: input.canonicalId,
    categorySlug: input.categorySlug,
    policyId,
    policyVersion,
    stableTupleOrder: input.policy?.stableTupleOrder ?? [],
    canonicalIdentity: fingerprintCanonicalIdentity,
    profileInventory,
    mappedSupplierIds,
    candidates: evidenceCandidates ?? input.candidates,
    candidatesSorted: evidenceCandidates !== undefined,
  });

  return {
    input,
    mappedSupplierIds,
    policyId,
    policyVersion,
    fingerprintCanonicalIdentity,
    profileInventory,
    inputFingerprint,
  };
}

function buildRepresentativeEmptyResult(
  setup: RepresentativeOptionSetup,
  extras: {
    reasonCode: string;
    status: Extract<
      RepresentativeOptionStatus,
      "not-applicable" | "evidence-blocked" | "policy-not-ready"
    >;
    candidates?: RepresentativeOptionCandidateEvidence[];
    completeCandidateSupplierIds?: string[];
  }
): RepresentativeOptionResult {
  return emptyResult({
    input: setup.input,
    mappedSupplierIds: setup.mappedSupplierIds,
    policyId: setup.policyId,
    policyVersion: setup.policyVersion,
    inputFingerprint: setup.inputFingerprint,
    profileInventory: setup.profileInventory,
    reasonCode: extras.reasonCode,
    status: extras.status,
    candidates: extras.candidates,
    completeCandidateSupplierIds: extras.completeCandidateSupplierIds,
  });
}

type RepresentativeCandidatePolicyContext = {
  requiredAxisFields: readonly string[];
  declaredAxes: ReadonlySet<string>;
  stableTupleOrderIndex: ReadonlyMap<string, number>;
  implicitDefaultExclusions: RepresentativeOptionCategoryPolicy["implicitDefaultExclusions"];
  requireSupplierProductSize: boolean;
  minimumTupleAxisCount: number;
};

function readRepresentativeCandidatePolicyContext(
  policy: RepresentativeOptionCategoryPolicy
): RepresentativeCandidatePolicyContext {
  return {
    requiredAxisFields: policy.axes
      .filter(axis => axis.requirement === "required")
      .map(axis => axis.field),
    declaredAxes: new Set(policy.axes.map(axis => axis.field)),
    stableTupleOrderIndex: new Map(
      policy.stableTupleOrder.map((field, index) => [field, index])
    ),
    implicitDefaultExclusions: policy.implicitDefaultExclusions,
    requireSupplierProductSize: Boolean(policy.requireSupplierProductSize),
    minimumTupleAxisCount: policy.minimumTupleAxisCount ?? 1,
  };
}

function buildRepresentativeCandidates(
  candidates: readonly RepresentativeOptionCandidateInput[],
  policy: RepresentativeOptionCategoryPolicy
): RepresentativeOptionCandidateEvidence[] {
  // Every candidate shares these policy lookups; building them once keeps the
  // per-candidate evidence to the candidate's own tuple and support.
  const context = readRepresentativeCandidatePolicyContext(policy);
  return candidates
    .map(candidate => {
      const evidence = buildCandidateEvidence({ candidate, context });
      return {
        evidence,
        typicalChoiceRank: readRepresentativeTypicalChoiceRank(
          policy.typicalValuePreferences,
          evidence.tuple
        ),
      };
    })
    .sort(
      (left, right) =>
        compareCandidateEvidence(left.evidence, right.evidence) ||
        compareRepresentativeTypicalChoiceRanks(
          left.typicalChoiceRank,
          right.typicalChoiceRank
        ) ||
        compareRepresentativeStableKeys(
          left.evidence.stableKey,
          right.evidence.stableKey
        )
    )
    .map(entry => entry.evidence);
}

function readCompleteRepresentativeCandidates(
  candidates: readonly RepresentativeOptionCandidateEvidence[],
  policy: RepresentativeOptionCategoryPolicy
): {
  completeCandidates: RepresentativeOptionCandidateEvidence[];
  completeCandidateSupplierIds: string[];
} {
  const completeCandidates = candidates.filter(
    candidate =>
      candidate.requiredAxesComplete &&
      candidate.undeclaredAxes.length === 0 &&
      candidate.tuple.length >= (policy.minimumTupleAxisCount ?? 1) &&
      candidate.completeEvidenceSupplierIds.length > 0
  );

  return {
    completeCandidates,
    completeCandidateSupplierIds: uniqueSorted(
      completeCandidates.flatMap(
        candidate => candidate.completeEvidenceSupplierIds
      )
    ),
  };
}

function resolveRepresentativeNoCandidatesOutcome(
  policy: RepresentativeOptionCategoryPolicy,
  profileInventory: RepresentativeOptionProfileInventory
): { reasonCode: string; status: "not-applicable" | "evidence-blocked" } {
  const hasRequiredAxes = policy.axes.some(
    axis => axis.requirement === "required"
  );
  if (
    !hasRequiredAxes &&
    profileInventory.totalProfileCount > 0 &&
    profileInventory.multiProfileProductCount === 0
  ) {
    return {
      reasonCode: "no-selectable-profile-axis",
      status: "not-applicable",
    };
  }

  return profileInventory.totalProfileCount === 0
    ? { reasonCode: "active-profile-evidence-missing", status: "evidence-blocked",
      }
    : { reasonCode: "declared-axis-evidence-missing", status: "evidence-blocked",
      };
}

function buildRepresentativeNoSharedResult(
  setup: RepresentativeOptionSetup,
  input: {
    policy: RepresentativeOptionCategoryPolicy;
    candidates: RepresentativeOptionCandidateEvidence[];
    completeCandidateSupplierIds: string[];
  }
): RepresentativeOptionResult {
  const exclusionReasonCodes = new Set(
    input.policy.implicitDefaultExclusions.map(exclusion => exclusion.reasonCode)
  );
  const hasCompleteExcludedCandidate = input.candidates.some(
    candidate =>
      candidate.completeEvidenceSupplierIds.length > 0 &&
      candidate.reasonCodes.some(reasonCode =>
        exclusionReasonCodes.has(reasonCode)
      )
  );

  return {
    canonicalId: setup.input.canonicalId,
    categorySlug: setup.input.categorySlug,
    policyId: setup.policyId,
    policyVersion: setup.policyVersion,
    fingerprintCanonicalIdentity: setup.fingerprintCanonicalIdentity,
    status: "no-shared-representative",
    selectedStableKey: null,
    selectedTuple: null,
    candidates: input.candidates,
    distinctMappedSupplierIds: setup.mappedSupplierIds,
    completeCandidateSupplierIds: input.completeCandidateSupplierIds,
    profileInventory: setup.profileInventory,
    decisiveReasonCodes: [
      hasCompleteExcludedCandidate
        ? "complete-candidates-excluded-from-implicit-default"
        : "no-eligible-representative-candidate",
    ],
    inputFingerprint: setup.inputFingerprint,
  };
}

function buildRepresentativeSelectedResult(
  setup: RepresentativeOptionSetup,
  input: {
    selected: RepresentativeOptionCandidateEvidence;
    candidates: RepresentativeOptionCandidateEvidence[];
    completeCandidateSupplierIds: string[];
    typicalValuePreferences:
      | readonly RepresentativeOptionTypicalValuePreference[]
      | undefined;
  }
): RepresentativeOptionResult {
  return {
    canonicalId: setup.input.canonicalId,
    categorySlug: setup.input.categorySlug,
    policyId: setup.policyId,
    policyVersion: setup.policyVersion,
    fingerprintCanonicalIdentity: setup.fingerprintCanonicalIdentity,
    status:
      setup.mappedSupplierIds.length <= 1
        ? "single-supplier-selected"
        : "selected",
    selectedStableKey: input.selected.stableKey,
    selectedTuple: input.selected.tuple,
    candidates: input.candidates,
    distinctMappedSupplierIds: setup.mappedSupplierIds,
    completeCandidateSupplierIds: input.completeCandidateSupplierIds,
    profileInventory: setup.profileInventory,
    decisiveReasonCodes: decisiveReasons(
      input.selected,
      input.candidates,
      input.typicalValuePreferences
    ),
    inputFingerprint: setup.inputFingerprint,
  };
}

/**
 * Recomputes the representative input fingerprint through its owning policy
 * and fingerprint constructor. Consumers can therefore validate transported
 * representative evidence without reproducing the fingerprint grammar.
 */
export function verifyRepresentativeOptionInputFingerprint(
  result: RepresentativeOptionResult
): boolean {
  const policy = representativePolicyForCanonical(
    result.policyId === "unconfigured-representative-option" &&
    result.policyVersion === "0"
      ? null
      : (getRecordedFamilyRepresentativePolicy(
          result.categorySlug,
          result.policyId
        ) ?? getRepresentativeOptionPolicy(result.categorySlug)), result.fingerprintCanonicalIdentity ?? undefined);
  const policyId = policy?.id ?? "unconfigured-representative-option";
  const policyVersion = policy?.version ?? "0";
  if (result.policyId !== policyId || result.policyVersion !== policyVersion) {
    return false;
  }

  const expected = deriveRepresentativeOption({
    canonicalId: result.canonicalId,
    categorySlug: result.categorySlug,
    policy,
    canonicalIdentity: result.fingerprintCanonicalIdentity ?? undefined,
    profileInventory: result.profileInventory,
    mappedSupplierIds: result.distinctMappedSupplierIds,
    candidates: result.candidates.map(candidate => ({
      stableKey: candidate.stableKey,
      tuple: candidate.tuple,
      support: candidate.support,
    })),
  });

  return (
    result.inputFingerprint === expected.inputFingerprint &&
    JSON.stringify(representativeOptionAuthorityPayload(result)) ===
      JSON.stringify(representativeOptionAuthorityPayload(expected))
  );
}

function representativeOptionAuthorityPayload(
  result: RepresentativeOptionResult
) {
  return {
    canonicalId: result.canonicalId,
    categorySlug: result.categorySlug,
    policyId: result.policyId,
    policyVersion: result.policyVersion,
    fingerprintCanonicalIdentity: result.fingerprintCanonicalIdentity,
    status: result.status,
    selectedStableKey: result.selectedStableKey,
    selectedTuple: result.selectedTuple,
    candidates: result.candidates.map(candidate => ({
      stableKey: candidate.stableKey,
      tuple: candidate.tuple,
      support: candidate.support.map(support => ({
        productId: support.productId,
        supplierId: support.supplierId,
        variantProfileId: support.variantProfileId,
        matchKind: support.matchKind,
        profileEvidenceComplete: support.profileEvidenceComplete,
      })),
      requiredAxesComplete: candidate.requiredAxesComplete,
      missingRequiredAxes: candidate.missingRequiredAxes,
      undeclaredAxes: candidate.undeclaredAxes,
      exactSupplierIds: candidate.exactSupplierIds,
      equivalentSupplierIds: candidate.equivalentSupplierIds,
      coveredSupplierIds: candidate.coveredSupplierIds,
      completeEvidenceSupplierIds: candidate.completeEvidenceSupplierIds,
      incompleteEvidenceSupplierIds: candidate.incompleteEvidenceSupplierIds,
      factors: candidate.factors,
      eligible: candidate.eligible,
      reasonCodes: candidate.reasonCodes,
    })),
    distinctMappedSupplierIds: result.distinctMappedSupplierIds,
    completeCandidateSupplierIds: result.completeCandidateSupplierIds,
    profileInventory: result.profileInventory,
    decisiveReasonCodes: result.decisiveReasonCodes,
    inputFingerprint: result.inputFingerprint,
  };
}

function emptyResult(input: {
  input: {
    canonicalId: string;
    categorySlug: string;
    canonicalIdentity?: RepresentativeOptionCanonicalIdentity;
  };
  mappedSupplierIds: string[];
  policyId: string;
  policyVersion: string;
  inputFingerprint: string;
  reasonCode: string;
  status: Extract<
    RepresentativeOptionStatus,
    "not-applicable" | "evidence-blocked" | "policy-not-ready"
  >;
  profileInventory: RepresentativeOptionProfileInventory;
  candidates?: RepresentativeOptionCandidateEvidence[];
  completeCandidateSupplierIds?: string[];
}): RepresentativeOptionResult {
  return {
    canonicalId: input.input.canonicalId,
    categorySlug: input.input.categorySlug,
    policyId: input.policyId,
    policyVersion: input.policyVersion,
    fingerprintCanonicalIdentity: input.input.canonicalIdentity ?? null,
    status: input.status,
    selectedStableKey: null,
    selectedTuple: null,
    candidates: input.candidates ?? [],
    distinctMappedSupplierIds: input.mappedSupplierIds,
    completeCandidateSupplierIds: input.completeCandidateSupplierIds ?? [],
    profileInventory: input.profileInventory,
    decisiveReasonCodes: [input.reasonCode],
    inputFingerprint: input.inputFingerprint,
  };
}

function buildCandidateEvidence(input: {
  candidate: RepresentativeOptionCandidateInput;
  context: RepresentativeCandidatePolicyContext;
}): RepresentativeOptionCandidateEvidence {
  const context = input.context;
  const valuesByField = new Map(
    input.candidate.tuple.map(value => [value.field, value.normalizedValue])
  );
  const missingRequiredAxes = context.requiredAxisFields.filter(
    field => !valuesByField.get(field)?.trim()
  );
  const undeclaredAxes = [...valuesByField.keys()]
    .filter(field => !context.declaredAxes.has(field))
    .sort((left, right) => left.localeCompare(right));
  const exclusionReasonCodes = context.implicitDefaultExclusions.flatMap(
    exclusion =>
      exclusion.normalizedValues.includes(
        valuesByField.get(exclusion.field) ?? ""
      )
        ? [exclusion.reasonCode]
        : []
  );
  if (context.requireSupplierProductSize && (!input.candidate.support.length || input.candidate.support.some(support => !hasOwnedSupplierSize(valuesByField.get("size"), support.productId)))) exclusionReasonCodes.push("supplier-product-size-required");
  const supportBySupplier = readSupportCoverageBySupplier(
    input.candidate.support
  );
  const supportingProfiles = readSupportingProfileEvidence(
    input.candidate.support
  );
  const {
    exactSupplierIds,
    equivalentSupplierIds,
    coveredSupplierIds,
    completeEvidenceSupplierIds,
    incompleteEvidenceSupplierIds,
  } = readSupplierCoverageGroups(supportBySupplier);
  const requiredAxesComplete = missingRequiredAxes.length === 0;
  const minimumTupleAxisCount = context.minimumTupleAxisCount;
  const eligible = isRepresentativeCandidateEligible({
    requiredAxesComplete,
    undeclaredAxes,
    exclusionReasonCodes,
    coveredSupplierIds,
    tupleLength: input.candidate.tuple.length,
    minimumTupleAxisCount,
  });
  const reasonCodes = buildRepresentativeCandidateReasonCodes({
    requiredAxesComplete,
    undeclaredAxes,
    exclusionReasonCodes,
    incompleteEvidenceSupplierIds,
    coveredSupplierIds,
    tupleLength: input.candidate.tuple.length,
    minimumTupleAxisCount,
  });

  return {
    stableKey: input.candidate.stableKey,
    tuple: sortTuple(input.candidate.tuple, context.stableTupleOrderIndex),
    support: [...input.candidate.support].sort((left, right) =>
      supportKey(left).localeCompare(supportKey(right))
    ),
    requiredAxesComplete,
    missingRequiredAxes,
    undeclaredAxes,
    exactSupplierIds,
    equivalentSupplierIds,
    coveredSupplierIds,
    completeEvidenceSupplierIds,
    incompleteEvidenceSupplierIds,
    factors: {
      distinctSupplierCoverage: coveredSupplierIds.length,
      supportingProfileCount: supportingProfiles.size,
      stableKey: input.candidate.stableKey,
    },
    eligible,
    reasonCodes,
  };
}

type RepresentativeOptionSupportCoverage = {
  exact: boolean;
  equivalent: boolean;
  exactComplete: boolean;
  equivalentComplete: boolean;
};

function readSupportCoverageBySupplier(
  support: readonly RepresentativeOptionSupportInput[]
): Map<string, RepresentativeOptionSupportCoverage> {
  const supportBySupplier = new Map<
    string,
    RepresentativeOptionSupportCoverage
  >();

  for (const entry of support) {
    const current = supportBySupplier.get(entry.supplierId) ?? {
      exact: false,
      equivalent: false,
      exactComplete: false,
      equivalentComplete: false,
    };
    current.exact ||= entry.matchKind === "exact";
    current.equivalent ||= entry.matchKind === "equivalent";
    current.exactComplete ||=
      entry.matchKind === "exact" && entry.profileEvidenceComplete;
    current.equivalentComplete ||=
      entry.matchKind === "equivalent" && entry.profileEvidenceComplete;
    supportBySupplier.set(entry.supplierId, current);
  }

  return supportBySupplier;
}

function readSupportingProfileEvidence(
  support: readonly RepresentativeOptionSupportInput[]
): Map<string, RepresentativeOptionSupportInput> {
  const supportingProfiles = new Map<
    string,
    RepresentativeOptionSupportInput
  >();

  for (const entry of support) {
    if (!entry.profileEvidenceComplete) continue;
    const key = supportingProfileEvidenceKey(entry);
    const current = supportingProfiles.get(key);
    if (!current || current.matchKind === "equivalent") {
      supportingProfiles.set(key, entry);
    }
  }

  return supportingProfiles;
}

function readSupplierCoverageGroups(
  supportBySupplier: Map<string, RepresentativeOptionSupportCoverage>
): {
  exactSupplierIds: string[];
  equivalentSupplierIds: string[];
  coveredSupplierIds: string[];
  completeEvidenceSupplierIds: string[];
  incompleteEvidenceSupplierIds: string[];
} {
  // Candidates usually carry one or two suppliers; bucket them in one pass
  // instead of scanning and re-sorting the map once per coverage group.
  const exactSupplierIds: string[] = [];
  const equivalentSupplierIds: string[] = [];
  const incompleteEvidenceSupplierIds: string[] = [];
  for (const [supplierId, coverage] of supportBySupplier) {
    if (coverage.exactComplete) exactSupplierIds.push(supplierId);
    else if (coverage.equivalentComplete) {
      equivalentSupplierIds.push(supplierId);
    }
    if (
      (coverage.exact || coverage.equivalent) &&
      !coverage.exactComplete &&
      !coverage.equivalentComplete
    ) {
      incompleteEvidenceSupplierIds.push(supplierId);
    }
  }
  const bySupplierId = (left: string, right: string) =>
    left.localeCompare(right);
  exactSupplierIds.sort(bySupplierId);
  equivalentSupplierIds.sort(bySupplierId);
  incompleteEvidenceSupplierIds.sort(bySupplierId);
  const coveredSupplierIds = uniqueSorted([
    ...exactSupplierIds,
    ...equivalentSupplierIds,
  ]);

  return {
    exactSupplierIds,
    equivalentSupplierIds,
    coveredSupplierIds,
    completeEvidenceSupplierIds: [...coveredSupplierIds],
    incompleteEvidenceSupplierIds,
  };
}

function isRepresentativeCandidateEligible(input: {
  requiredAxesComplete: boolean;
  undeclaredAxes: readonly string[];
  exclusionReasonCodes: readonly string[];
  coveredSupplierIds: readonly string[];
  tupleLength: number;
  minimumTupleAxisCount: number;
}): boolean {
  return (
    input.requiredAxesComplete &&
    input.undeclaredAxes.length === 0 &&
    input.tupleLength >= input.minimumTupleAxisCount &&
    input.exclusionReasonCodes.length === 0 &&
    input.coveredSupplierIds.length > 0
  );
}

function buildRepresentativeCandidateReasonCodes(input: {
  requiredAxesComplete: boolean;
  undeclaredAxes: readonly string[];
  exclusionReasonCodes: readonly string[];
  incompleteEvidenceSupplierIds: readonly string[];
  coveredSupplierIds: readonly string[];
  tupleLength: number;
  minimumTupleAxisCount: number;
}): string[] {
  return [
    ...(input.requiredAxesComplete ? [] : ["required-axes-incomplete"]),
    ...(input.undeclaredAxes.length > 0 ? ["undeclared-comparison-axis"] : []),
    ...(input.tupleLength < input.minimumTupleAxisCount
      ? ["minimum-tuple-axes-incomplete"]
      : []),
    ...(input.incompleteEvidenceSupplierIds.length > 0
      ? ["profile-evidence-incomplete"]
      : []),
    ...(input.coveredSupplierIds.length === 0
      ? ["complete-profile-support-missing"]
      : []),
    ...input.exclusionReasonCodes,
  ];
}

/** Eligibility, then supplier coverage, then profile support. */
function compareCandidateEvidence(
  left: RepresentativeOptionCandidateEvidence,
  right: RepresentativeOptionCandidateEvidence
): number {
  if (left.eligible !== right.eligible) return left.eligible ? -1 : 1;
  return (
    right.factors.distinctSupplierCoverage -
      left.factors.distinctSupplierCoverage ||
    right.factors.supportingProfileCount -
      left.factors.supportingProfileCount
  );
}

function decisiveReasons(
  selected: RepresentativeOptionCandidateEvidence,
  rankedCandidates: readonly RepresentativeOptionCandidateEvidence[],
  typicalValuePreferences:
    | readonly RepresentativeOptionTypicalValuePreference[]
    | undefined
): string[] {
  const runnerUp = rankedCandidates.find(
    candidate =>
      candidate.eligible && candidate.stableKey !== selected.stableKey
  );
  if (!runnerUp) return ["only-eligible-candidate"];
  if (
    selected.factors.distinctSupplierCoverage !==
    runnerUp.factors.distinctSupplierCoverage
  ) {
    return ["highest-distinct-supplier-coverage"];
  }
  if (
    selected.factors.supportingProfileCount !==
    runnerUp.factors.supportingProfileCount
  ) {
    return ["highest-supporting-profile-count"];
  }
  if (
    compareRepresentativeTypicalChoiceRanks(
      readRepresentativeTypicalChoiceRank(
        typicalValuePreferences,
        selected.tuple
      ),
      readRepresentativeTypicalChoiceRank(
        typicalValuePreferences,
        runnerUp.tuple
      )
    ) !== 0
  ) {
    return ["typical-choice-preference"];
  }
  return ["stable-key-tiebreak"];
}

/**
 * How typical a candidate's values are under the policy's preferences, one
 * fixed-width segment per preference; lower ranks first. This orders a first
 * display choice; it is not evidence that two sizes fit alike.
 */
export function readRepresentativeTypicalChoiceRank(
  preferences:
    | readonly RepresentativeOptionTypicalValuePreference[] | undefined,
  tuple: readonly RepresentativeOptionTupleValue[]
): number[] {
  return (preferences ?? []).flatMap(preference => {
    const value =
      tuple
        .find(entry => entry.field === preference.field)
        ?.normalizedValue.toLowerCase() ?? null;
    if (preference.kind === "preferred-values") {
      const index = value ? preference.normalizedValues.indexOf(value) : -1;
      return [index < 0 ? preference.normalizedValues.length : index];
    }
    return preference.kind === "closest-typical-size"
      ? readTypicalSizeRank(value, preference.typicalSizes)
      : readTypicalAreaRank(value, preference.typicalSize);
  });
}

/** Scale, then ordinal distance from its typical size, larger first: M, L, S, XL, XS, 2XL. */
function readTypicalSizeRank(
  value: string | null,
  typicalSizes: readonly string[]
): number[] {
  const size = value ? resolveOrdinalSizeSortKey(value) : null;
  if (!size) return [Number.POSITIVE_INFINITY, 0, 0];
  const distances = typicalSizes.flatMap(typicalSize => {
    const typical = resolveOrdinalSizeSortKey(typicalSize);
    return typical?.scale === size.scale
      ? [Math.abs(size.sortRank - typical.sortRank)]
      : [];
  });
  return [
    size.scaleRank,
    distances.length > 0 ? Math.min(...distances) : 0,
    -size.sortRank,
  ];
}

/**
 * Distance from the typical size as area ratio times aspect ratio (half and
 * double the area tie; so do portrait and landscape), then the larger. Area
 * alone ties 8×24 in with 12×16 in. Division rounds identically in every
 * runtime; a logarithm need not.
 */
function readTypicalAreaRank(
  value: string | null,
  typicalSize: string
): number[] {
  const size = value ? readDimensions(value) : null;
  const typical = readDimensions(typicalSize);
  if (size === null || typical === null) {
    return [Number.POSITIVE_INFINITY, 0];
  }
  return [
    ratioDistance(size.area, typical.area) *
      ratioDistance(size.aspect, typical.aspect),
    -size.area,
  ];
}

/** At least 1; 1 when equal. */
function ratioDistance(value: number, typical: number): number {
  return value >= typical ? value / typical : typical / value;
}

function readDimensions(
  normalizedValue: string
): { area: number; aspect: number } | null {
  const dimensions = /(?:^|:)dim:(\d+)x(\d+)$/.exec(normalizedValue);
  const width = dimensions ? Number(dimensions[1]) : 0;
  const height = dimensions ? Number(dimensions[2]) : 0;
  if (width <= 0 || height <= 0) return null;
  return {
    area: width * height,
    aspect: Math.max(width, height) / Math.min(width, height),
  };
}

export function compareRepresentativeTypicalChoiceRanks(
  left: readonly number[],
  right: readonly number[]
): number {
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    const difference = compareRankValues(left[index]!, right[index]!);
    if (difference !== 0) return difference;
  }
  return left.length - right.length;
}

function compareRankValues(left: number, right: number): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

const STABLE_KEY_COLLATOR = new Intl.Collator("en");

/**
 * The final tie-break. An explicit locale keeps a browser's re-derivation in
 * the server's order; code-unit order settles collator ties.
 */
export function compareRepresentativeStableKeys(
  left: string,
  right: string
): number {
  return (
    STABLE_KEY_COLLATOR.compare(left, right) ||
    (left < right ? -1 : left > right ? 1 : 0)
  );
}

function buildFingerprint(input: {
  canonicalId: string;
  categorySlug: string;
  policyId: string;
  policyVersion: string;
  stableTupleOrder: readonly string[];
  canonicalIdentity: RepresentativeOptionCanonicalIdentity | null;
  profileInventory: RepresentativeOptionProfileInventory;
  mappedSupplierIds: readonly string[];
  candidates: readonly RepresentativeOptionCandidateInput[];
  /** Tuple and support order already match this fingerprint's order. */
  candidatesSorted?: boolean;
}): string {
  const byStableKey = [...input.candidates].sort((left, right) =>
    left.stableKey.localeCompare(right.stableKey)
  );
  const orderByField = new Map(
    input.stableTupleOrder.map((field, index) => [field, index])
  );
  const sorted = input.candidatesSorted
    ? byStableKey
    : byStableKey.map(candidate => ({
        stableKey: candidate.stableKey,
        tuple: sortTuple(candidate.tuple, orderByField),
        support: candidate.support.toSorted((left, right) =>
          supportKey(left).localeCompare(supportKey(right))
        ),
      }));
  const payload = JSON.stringify({
    canonicalId: input.canonicalId,
    categorySlug: input.categorySlug,
    policyId: input.policyId,
    policyVersion: input.policyVersion,
    canonicalIdentity: input.canonicalIdentity,
    profileInventory: input.profileInventory,
    mappedSupplierIds: [...input.mappedSupplierIds].sort(),
    candidates: sorted.map(candidate => ({
      stableKey: candidate.stableKey,
      tuple: candidate.tuple,
      support: candidate.support.map(support => ({
        productId: support.productId,
        supplierId: support.supplierId,
        variantProfileId: support.variantProfileId,
        matchKind: support.matchKind,
        profileEvidenceComplete: support.profileEvidenceComplete,
      })),
    })),
  });

  return `${REPRESENTATIVE_OPTION_FINGERPRINT_VERSION}:${fnv1a32Hex(payload)}`;
}

function hasVerifiedBrandedIdentity(
  identity: RepresentativeOptionCanonicalIdentity | undefined
): boolean {
  return Boolean(
    identity?.comparisonClass === "branded" &&
      identity.brand?.trim() &&
      identity.model?.trim()
  );
}

function sortTuple(
  tuple: readonly RepresentativeOptionTupleValue[],
  orderByField: ReadonlyMap<string, number>
): RepresentativeOptionTupleValue[] {
  return [...tuple].sort((left, right) => {
    const orderDifference =
      (orderByField.get(left.field) ?? Number.MAX_SAFE_INTEGER) -
      (orderByField.get(right.field) ?? Number.MAX_SAFE_INTEGER);
    return orderDifference || left.field.localeCompare(right.field);
  });
}

function supportKey(support: RepresentativeOptionSupportInput): string {
  return [
    support.supplierId,
    support.productId,
    support.variantProfileId,
    support.matchKind,
    support.profileEvidenceComplete ? "complete" : "incomplete",
  ].join("\u0000");
}

function supportingProfileEvidenceKey(
  support: RepresentativeOptionSupportInput
): string {
  return [support.supplierId, support.productId].join("\u0000");
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}
