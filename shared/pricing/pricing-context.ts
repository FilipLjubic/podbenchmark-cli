import type { SupplierPricingContext } from "./required-charges";

/**
 * The schema-free half of the required-charges contract: bases, predicates
 * and the typed eligibility check that browser code imports. The schemas and
 * the readers that validate stored data live in `required-charges.ts`.
 */

/** The unit price requires the supplier's own compatible, reusable digitised file. */
export const EXISTING_SUPPLIER_DESIGN_BASIS = "existing-supplier-digitised-design";
export const INCLUDED_SUPPLIER_DIGITISATION_BASIS = "digitisation-included";

/** Conditions that an aggregate headline cannot repeat beside every price. */
export function isConditionalSupplierPricingContext(context: {
  readonly basis: SupplierPricingContext["basis"];
  readonly recurringConditions: readonly string[];
} | undefined): boolean {
  return context !== undefined && (
    context.basis === EXISTING_SUPPLIER_DESIGN_BASIS ||
    context.recurringConditions.length > 0
  );
}

export function isEmbroideryPricingMethod(method: string | null | undefined): boolean {
  return method?.toLowerCase().includes("embroid") ?? false;
}

/** Technology and raw method are equally authoritative evidence of embroidery. */
export function effectiveEmbroidery<T>(technology:T, method:T, operations:{contains:(value:T)=>T;or:(left:T,right:T)=>T}):T;
export function effectiveEmbroidery(technology:string|null|undefined, method:string|null|undefined):boolean;
export function effectiveEmbroidery<T>(technology:T, method:T, operations?:{contains:(value:T)=>T;or:(left:T,right:T)=>T}):T|boolean {
 if (operations) return operations.or(operations.contains(technology), operations.contains(method));
 return isEmbroideryPricingMethod(typeof technology === "string" ? technology : null) || isEmbroideryPricingMethod(typeof method === "string" ? method : null);
}

/** A method total needs its own unconditional context for embroidery; none is fine elsewhere. */
export function isUnqualifiedPricingContextEligible(
  context: SupplierPricingContext | null | undefined,
  printTechnology?: string | null,
  printMethod?: string | null
): boolean {
  if (context === null || context === undefined)
    return !effectiveEmbroidery(printTechnology, printMethod);
  return !isConditionalSupplierPricingContext(context);
}
