import { z } from "zod";

/**
 * A known compulsory charge with unresolved order/design context cannot become
 * a complete comparison price. Source options and active offers remain retained.
 * This guard does not calculate charges or infer zero from an unresolved fee.
 *
 * An offer whose price holds only for a stated design history carries
 * `requiredCharges.pricingContext`. The context is validated here once; a
 * flagged offer without a valid context is never complete.
 */

/** The unit price requires the supplier's own compatible, reusable digitised file. */
export const EXISTING_SUPPLIER_DESIGN_BASIS = "existing-supplier-digitised-design";
export const INCLUDED_SUPPLIER_DIGITISATION_BASIS = "digitisation-included";

const nonBlank = z.string().min(1).max(200).refine(value => value.trim().length > 0);
const evidenceText = z.string().min(1).max(600).refine(value => value.trim().length > 0);
const conditionsSchema = z.array(evidenceText).max(12);

/** A rate is evidence, not a charge payable for unspecified artwork. */
const setupFeeSchema = z.strictObject({
  kind: z.enum(["standard", "text-only", "image", "adjustment", "back-or-side", "setup"]),
  amount: z.number().finite().nonnegative(),
  /** Original supplier currency; never converted along with the unit price. */
  currency: z.enum(["USD", "EUR", "GBP", "AUD", "CAD"]),
  taxBasis: z.enum(["ex-vat", "unknown"]),
  scope: z.enum(["per-design", "per-design-and-area", "per-order", "per-unit", "unknown"]),
  source: evidenceText,
  conditions: conditionsSchema,
});

export const newDesignSetupSchema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("listed"),
    fees: z.array(setupFeeSchema).min(1).max(8),
    applicability: z.enum(["design-dependent", "selected"]),
    // Scope records the supplier's stated billing grain. Quantity, tax and duty
    // calculation remain unmodelled, even when that grain is established.
    application: z.literal("not-modelled"),
    includedInDeliveredTotal: z.literal(false),
  }).refine(setup => setup.applicability !== "selected" || setup.fees.length === 1,
    "A selected setup charge must identify exactly one applicable fee."),
  z.strictObject({
    status: z.literal("included"),
    source: evidenceText,
    conditions: conditionsSchema,
  }),
  z.strictObject({
    status: z.literal("unknown"),
    reason: evidenceText,
    source: evidenceText.optional(),
  }),
]);

const physicalSelectionSchema = z.strictObject({
  /** `sku-option` changes the unit price; `standard-configuration` is a fixed default. */
  kind: z.enum(["sku-option", "standard-configuration"]),
  axisId: nonBlank,
  valueId: nonBlank,
  axisLabel: nonBlank,
  valueLabel: nonBlank,
});

export const supplierPricingContextSchema = z
  .strictObject({
    basis: z.enum([EXISTING_SUPPLIER_DESIGN_BASIS, INCLUDED_SUPPLIER_DIGITISATION_BASIS]),
    policyId: nonBlank,
    policyVersion: nonBlank,
    source: evidenceText,
    /** What must remain true for this concrete recurring unit price. */
    recurringConditions: conditionsSchema,
    newDesignSetup: newDesignSetupSchema,
    physicalSelections: z.array(physicalSelectionSchema).max(8),
  })
  .refine(
    context =>
      new Set(context.physicalSelections.map(selection => selection.axisId))
        .size === context.physicalSelections.length,
    "Each physical selection axis may appear once."
  )
  .refine(context => context.basis !== EXISTING_SUPPLIER_DESIGN_BASIS || context.recurringConditions.length > 0,
    "An existing-design price must state its reuse conditions.")
  .refine(context => context.basis !== INCLUDED_SUPPLIER_DIGITISATION_BASIS || context.newDesignSetup.status === "included",
    "An included basis needs confirmed digitisation inclusion.");

export type SupplierPricingContext = z.infer<typeof supplierPricingContextSchema>;

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

export type SupplierPricingContextRead =
  | { readonly status: "absent" }
  | { readonly status: "valid"; readonly context: SupplierPricingContext }
  | { readonly status: "invalid" };

/** Validate a stored or transported context; null and undefined mean none. */
export function readSupplierPricingContext(
  value: unknown
): SupplierPricingContextRead {
  if (value === null || value === undefined) return { status: "absent" };
  const parsed = supplierPricingContextSchema.safeParse(value);
  return parsed.success
    ? { status: "valid", context: parsed.data }
    : { status: "invalid" };
}

/** A method total needs its own valid, unconditional context for embroidery. */
export function readUnqualifiedPricingContextEligible(
  value: unknown,
  printTechnology?: string | null
): boolean {
  const context = readSupplierPricingContext(value);
  if (context.status === "absent") return !isEmbroideryPricingMethod(printTechnology);
  return context.status === "valid" && !isConditionalSupplierPricingContext(context.context);
}

/**
 * Build the context a variant stores at `data.requiredCharges.pricingContext`.
 * Throws on a value the readers would reject, so a writer cannot persist one.
 */
export function buildSupplierPricingContext(
  input: SupplierPricingContext
): SupplierPricingContext {
  return supplierPricingContextSchema.parse(input);
}

const chargeCompletenessSchema = z.object({
  requiredCharges: z
    .object({
      complete: z.boolean(),
      setup: z.unknown().optional(),
      pricingContext: z.unknown().optional(),
    })
    .optional(),
});

const setupAmountSchema = z.object({ feeGbp: z.number().finite().nonnegative() }).loose();
type SetupAmount = z.infer<typeof setupAmountSchema>;

/** Read the context at its persisted owner without borrowing another offer's. */
export function readRequiredSupplierPricingContext(data: unknown): SupplierPricingContextRead {
  if (data === null || data === undefined) return { status: "absent" };
  const parsed = chargeCompletenessSchema.safeParse(data);
  return parsed.success
    ? readSupplierPricingContext(parsed.data.requiredCharges?.pricingContext)
    : { status: "invalid" };
}

export function isEmbroideryPricingMethod(method: string | null | undefined): boolean {
  return method?.toLowerCase().includes("embroid") ?? false;
}

function matchesDisclosedSetupCharge(
  setup: SetupAmount,
  disclosed: SupplierPricingContext["newDesignSetup"]
): boolean {
  if (disclosed.status !== "listed" || disclosed.fees.length !== 1) {
    return false;
  }
  const fee = disclosed.fees[0];
  return fee !== undefined && fee.kind === "setup" &&
    fee.currency === "GBP" && setup.feeGbp === fee.amount;
}

export function readRequiredSupplierChargesComplete(
  data: unknown,
  printTechnology?: string | null,
  printMethod?: string | null
): boolean {
  const needsContext = [printTechnology, printMethod].some(isEmbroideryPricingMethod);
  if (data === null || data === undefined) return !needsContext;
  const parsed = chargeCompletenessSchema.safeParse(data);
  if (!parsed.success) return false;
  const charges = parsed.data.requiredCharges;
  if (charges === undefined) return !needsContext;
  if (charges.complete === false) return false;

  const hasSetup = charges.setup !== undefined && charges.setup !== null;
  const read = readSupplierPricingContext(charges.pricingContext);
  if (read.status === "invalid") return false;
  if (needsContext && read.status !== "valid") return false;
  // A flagged setup fee needs the basis that qualifies the price; never zero.
  if (hasSetup && read.status === "absent") return false;
  if (read.status === "valid" && hasSetup) {
    const setup = setupAmountSchema.safeParse(charges.setup);
    return setup.success && matchesDisclosedSetupCharge(setup.data, read.context.newDesignSetup);
  }
  return true;
}

/** Numeric aggregates cannot repeat a supplier-specific recurring condition. */
export function readUnconditionalSupplierChargesComplete(
  data: unknown,
  printTechnology?: string | null,
  printMethod?: string | null
): boolean {
  if (!readRequiredSupplierChargesComplete(data, printTechnology, printMethod)) return false;
  const context = readRequiredSupplierPricingContext(data);
  return context.status === "absent" ||
    (context.status === "valid" && !isConditionalSupplierPricingContext(context.context));
}
