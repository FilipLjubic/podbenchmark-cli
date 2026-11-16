import type {
	ComponentFactField,
	ComponentRole,
	ComponentSpecFact,
	ProductSpecs,
} from "../schemas/product-data";

export function getComponentFacts(
	specs: ProductSpecs,
	field?: ComponentFactField,
): readonly ComponentSpecFact[] {
	const facts = specs.componentFacts ?? [];
	return field === undefined
		? facts
		: facts.filter((fact) => fact.field === field);
}

export function isKnownComponentRole(
	role: ComponentRole,
): role is Exclude<ComponentRole, "unknown"> {
	return role !== "unknown";
}

/**
 * Component facts are comparison-compatible only when both sides name the
 * same known physical role. Unknown scope is evidence to retain, not evidence
 * that may be promoted to the finished product or matched by convenience.
 */
function areComponentRolesCompatible(
	left: ComponentRole,
	right: ComponentRole,
): boolean {
	return isKnownComponentRole(left) && left === right;
}

export function componentFactKey(
	fact: Pick<ComponentSpecFact, "field" | "componentRole">,
): string {
	return `${fact.field}@${fact.componentRole}`;
}

export function findCompatibleComponentFact(
	facts: readonly ComponentSpecFact[],
	target: Pick<ComponentSpecFact, "field" | "componentRole">,
): ComponentSpecFact | undefined {
	if (!isKnownComponentRole(target.componentRole)) return undefined;
	return facts.find(
		(fact) =>
			fact.field === target.field &&
			areComponentRolesCompatible(fact.componentRole, target.componentRole),
	);
}

