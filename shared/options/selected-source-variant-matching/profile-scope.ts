import { compareUtf8Bytes } from "../../kernel/canonical-order.ts";
import { canSelectedSourceColorMatch } from "../selected-source-measurement-policy";
import {
  createSelectedSourceTargetVariantEvaluator,
  type SelectedSourceTargetVariantEvaluator,
} from "./comparison";
import { compareSelectedSourceVariantOptionFit } from "./ranking";
import type {
  SelectedSourceVariantFieldComparison,
  SelectedSourceVariantMatchClassification,
  SelectedSourceVariantMatchingPolicy,
  SelectedSourceVariantProfileInput,
} from "./types";

const PROFILE_SCOPE_CLASSIFICATIONS: ReadonlySet<SelectedSourceVariantMatchClassification> = new Set([
  "exact",
  "equivalent",
  "defaulted",
  "fallback",
  "normalization-needed",
  "not-comparable",
]);

const PROFILE_SCOPE_CLASSIFICATION_PRIORITY: Record<
  SelectedSourceVariantMatchClassification,
  number
> = {
  exact: 0,
  equivalent: 1,
  defaulted: 2,
  fallback: 3,
  "normalization-needed": 4,
  "not-comparable": 5,
};

/**
 * When a product's best profiles already fail a required field (a landscape
 * size against a portrait-only product), none of them can be the option the
 * seller asked for: the row reports that the supplier has no compatible
 * option, and which non-match it carries is incidental. Keep a few, in id
 * order, instead of every tie: Prodigi Classic Frames tied 17,916 profiles on
 * a 40" x 26" pick, whose priced variants the caller then loaded.
 */
const MAX_PROFILES_FOR_FAILED_REQUIRED_FIELD = 8;

type ProfileScopeCandidate = {
  qualityRank: number;
  fieldComparisons: readonly SelectedSourceVariantFieldComparison[];
};

type EquivalentProfileGroup = {
  representative: SelectedSourceVariantProfileInput;
  profileIds: string[];
};

/**
 * Selects every profile tied for the best option fit per target product.
 * Pricing is deliberately absent at this stage: callers hydrate priced
 * variants only for these profiles and apply destination price afterwards.
 */
export function selectBestSelectedSourceTargetProfileIds(input: {
  sources: readonly SelectedSourceVariantProfileInput[];
  targets: readonly SelectedSourceVariantProfileInput[];
  policy: SelectedSourceVariantMatchingPolicy;
  acceptedClassifications?: readonly SelectedSourceVariantMatchClassification[];
  evaluateTargetVariant?: SelectedSourceTargetVariantEvaluator;
}): string[] {
  const selectedProfileIds = new Set<string>();
  const targetGroups = groupProfilesByProduct(input.targets);
  const acceptedClassifications = input.acceptedClassifications
    ? new Set(input.acceptedClassifications)
    : PROFILE_SCOPE_CLASSIFICATIONS;
  const evaluateTargetVariant =
    input.evaluateTargetVariant ?? createSelectedSourceTargetVariantEvaluator();
  const colorMatchesFamily = input.policy.fields.some(
    field => field.field === "color" && field.fallback === "color-family-nearest"
  );
  const sources = groupEquivalentProfiles(
    input.sources,
    evaluateTargetVariant.getEquivalentFactsIdentity
  ).map(group => group.representative);
  // Equivalent targets never depend on the source, so group each product once
  // instead of once per source.
  const targetGroupsByProduct = [...targetGroups.values()].map(targets =>
    groupEquivalentProfiles(targets, evaluateTargetVariant.getEquivalentFactsIdentity)
  );

  for (const source of sources) {
    const sourceColor = source.facts.find(fact => fact.field === "color") ?? null;
    for (const targetGroups of targetGroupsByProduct) {
      let bestCandidate: ProfileScopeCandidate | null = null;
      const bestProfileIds: string[] = [];

      for (const targetGroup of targetGroups) {
        const target = targetGroup.representative;
        // Apply the final matcher's reachability before ranking, so an
        // unresolved color cannot hide the shade that explains a miss.
        if (
          colorMatchesFamily &&
          !canSelectedSourceColorMatch({
            source: sourceColor,
            target: target.facts.find(fact => fact.field === "color") ?? null,
          })
        ) {
          continue;
        }
        const evaluation = evaluateTargetVariant({
          sourceProfile: source,
          target: {
            ...target,
            variantId: target.variantProfileId,
          },
          policy: input.policy,
        });
        if (
          !acceptedClassifications.has(evaluation.classification)
        ) {
          continue;
        }
        const candidate: ProfileScopeCandidate = {
          qualityRank:
            PROFILE_SCOPE_CLASSIFICATION_PRIORITY[evaluation.classification],
          fieldComparisons: evaluation.fieldComparisons,
        };
        const comparison = bestCandidate
          ? compareProfileCandidateQuality(candidate, bestCandidate)
          : -1;

        if (comparison < 0) {
          bestCandidate = candidate;
          bestProfileIds.length = 0;
          bestProfileIds.push(...targetGroup.profileIds);
        } else if (comparison === 0) {
          bestProfileIds.push(...targetGroup.profileIds);
        }
      }

      const retained =
        bestCandidate && failsRequiredField(bestCandidate)
          ? [...bestProfileIds]
              .sort(compareUtf8Bytes)
              .slice(0, MAX_PROFILES_FOR_FAILED_REQUIRED_FIELD)
          : bestProfileIds;
      for (const profileId of retained) {
        selectedProfileIds.add(profileId);
      }
    }
  }

  return [...selectedProfileIds].sort(compareUtf8Bytes);
}

function failsRequiredField(candidate: ProfileScopeCandidate): boolean {
  return candidate.fieldComparisons.some(
    comparison =>
      comparison.role === "required" && comparison.state === "different"
  );
}

function groupEquivalentProfiles(
  profiles: readonly SelectedSourceVariantProfileInput[],
  getEquivalentFactsIdentity:
    | SelectedSourceTargetVariantEvaluator["getEquivalentFactsIdentity"]
    | undefined
): EquivalentProfileGroup[] {
  if (!getEquivalentFactsIdentity) {
    return profiles.map(profile => ({
      representative: profile,
      profileIds: [profile.variantProfileId],
    }));
  }

  const groups = new Map<number, EquivalentProfileGroup>();
  for (const profile of profiles) {
    const identity = getEquivalentFactsIdentity(profile.facts, profile);
    const group = groups.get(identity);
    if (group) {
      group.profileIds.push(profile.variantProfileId);
      continue;
    }
    groups.set(identity, {
      representative: profile,
      profileIds: [profile.variantProfileId],
    });
  }
  return [...groups.values()];
}

function groupProfilesByProduct(
  profiles: readonly SelectedSourceVariantProfileInput[]
): Map<string, SelectedSourceVariantProfileInput[]> {
  const groups = new Map<string, SelectedSourceVariantProfileInput[]>();
  for (const profile of profiles) {
    const key = `${profile.supplierId}\u0000${profile.productId}`;
    const group = groups.get(key) ?? [];
    group.push(profile);
    groups.set(key, group);
  }
  return groups;
}

function compareProfileCandidateQuality(
  left: ProfileScopeCandidate,
  right: ProfileScopeCandidate
): number {
  return (
    left.qualityRank - right.qualityRank ||
    compareSelectedSourceVariantOptionFit(
      left.fieldComparisons,
      right.fieldComparisons
    )
  );
}
