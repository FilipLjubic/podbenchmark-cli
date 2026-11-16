import type { SelectedSourceVariantMatchingPolicy } from "./types";

export function scopeSelectedSourceVariantMatchingPolicy(input: {
  policy: SelectedSourceVariantMatchingPolicy;
  fields: readonly string[] | undefined;
}): SelectedSourceVariantMatchingPolicy | null {
  if (input.fields === undefined) {
    return input.policy;
  }

  const requestedFields = new Set<string>();
  for (const rawField of input.fields) {
    const field = rawField.trim();
    if (!field || requestedFields.has(field)) {
      return null;
    }
    requestedFields.add(field);
  }
  if (requestedFields.size === 0) {
    return null;
  }

  const fields = input.policy.fields.flatMap(fieldPolicy => {
    if (!requestedFields.has(fieldPolicy.field)) {
      return [];
    }
    if (fieldPolicy.role === "unsupported") {
      return [];
    }
    return [{ ...fieldPolicy, role: "required" as const }];
  });
  if (fields.length !== requestedFields.size) {
    return null;
  }

  const scopeKey = fields.map(field => field.field).join(",");
  return {
    ...input.policy,
    version: `${input.policy.version}+selected-fields(${scopeKey})`,
    fields,
  };
}

/**
 * The policy one picker option is matched under: for a policy that ignores
 * unpicked conditional fields, drops each conditional field the option does
 * not carry. Without this, whichever supplier's profile serves as the
 * option's reference made every hidden detail it states (CustomCat's edge
 * treatment, its "no blank colour" colour) a requirement for every other
 * supplier, which then read as unresolved.
 */
export function scopeSelectedSourcePolicyToOption(
  policy: SelectedSourceVariantMatchingPolicy,
  optionFields: readonly string[]
): SelectedSourceVariantMatchingPolicy {
  if (!policy.ignoreUnpickedConditionalFields) return policy;
  const picked = new Set(optionFields);
  const fields = policy.fields.filter(
    field => field.role !== "conditional" || picked.has(field.field)
  );
  if (fields.length === policy.fields.length) return policy;
  const pickedKey = [...picked].sort().join(",");
  return { ...policy, version: `${policy.version}+picked(${pickedKey})`, fields };
}
