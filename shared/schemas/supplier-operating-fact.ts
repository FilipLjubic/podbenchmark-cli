import { z } from "zod";

export const SUPPLIER_OPERATING_FACT_FAMILIES = [
  "commerce_responsibility",
  "seller_eligibility",
  "sales_channel",
  "plan_economics",
  "fulfillment_origin",
  "customer_experience",
  "automation_operation",
] as const;
const SupplierOperatingFactFamilySchema = z.enum(
  SUPPLIER_OPERATING_FACT_FAMILIES
);
export type SupplierOperatingFactFamily = z.infer<
  typeof SupplierOperatingFactFamilySchema
>;

export const SUPPLIER_OPERATING_FACT_RESOLUTION_STATES = [
  "current",
  "unknown",
  "conflicting",
  "inapplicable",
  "superseded",
] as const;
export const SupplierOperatingFactResolutionStateSchema = z.enum(
  SUPPLIER_OPERATING_FACT_RESOLUTION_STATES
);
export type SupplierOperatingFactResolutionState = z.infer<
  typeof SupplierOperatingFactResolutionStateSchema
>;

/**
 * Derived confidence. Dates schedule internal rechecks for general facts; the
 * five explicit onboarding keys instead become unknown at their evidence
 * deadline (supplier-operating-fact-policy.ts). Stored resolution is unchanged.
 */
const SupplierOperatingFactEffectiveStateSchema =
  SupplierOperatingFactResolutionStateSchema;
export type SupplierOperatingFactEffectiveState = z.infer<
  typeof SupplierOperatingFactEffectiveStateSchema
>;

export const SUPPLIER_OPERATING_FACT_CONFIDENCES = [
  "high",
  "medium",
  "low",
] as const;
const SupplierOperatingFactConfidenceSchema = z.enum(
  SUPPLIER_OPERATING_FACT_CONFIDENCES
);
export type SupplierOperatingFactConfidence = z.infer<
  typeof SupplierOperatingFactConfidenceSchema
>;

const SupplierOperatingFactResearchOutcomeSchema = z.enum([
  "supported",
  "not_found",
  "not_applicable",
  "unknown",
]);
export type SupplierOperatingFactResearchOutcome = z.infer<
  typeof SupplierOperatingFactResearchOutcomeSchema
>;

export const SUPPLIER_OPERATING_FACT_RECHECK_CLASSES = [
  "structural",
  "commercial",
  "channel",
  "temporary_blocker",
  "offer_provider",
  "account_only",
  "policy_detail",
] as const;
const SupplierOperatingFactRecheckClassSchema = z.enum(
  SUPPLIER_OPERATING_FACT_RECHECK_CLASSES
);
export type SupplierOperatingFactRecheckClass = z.infer<
  typeof SupplierOperatingFactRecheckClassSchema
>;

const SupplierOperatingFactConsumerSchema = z.enum([
  "supplier_profile",
  "supplier_comparison",
  "profitability_connection",
  "onboarding",
  "eligibility_filter",
  "channel_filter",
  "plan_comparison",
  "break_even_tool",
  "origin_disclosure",
  "provider_drilldown",
  "branding_comparison",
  "offer_disclosure",
  "developer_filter",
]);
export type SupplierOperatingFactConsumer = z.infer<
  typeof SupplierOperatingFactConsumerSchema
>;

export const SupplierOperatingFactConsumersSchema = z
  .array(SupplierOperatingFactConsumerSchema)
  .min(1);

const scopeValuesSchema = z.array(z.string().trim().min(1)).default([]);

const countryCodeSchema = z
  .string()
  .trim()
  .regex(/^[A-Z]{2}$/u);

export const SupplierOperatingFactOfferRequirementSchema = z.discriminatedUnion(
  "kind",
  [
    z.object({ kind: z.literal("channel_product_eligible") }).strict(),
    z
      .object({
        kind: z.literal("provider_country"),
        countryCode: countryCodeSchema,
      })
      .strict(),
    z
      .object({
        kind: z.literal("fulfillment_country_matches_seller_market"),
      })
      .strict(),
    z
      .object({
        kind: z.literal("shipping_mode"),
        mode: z.enum(["seller_shipping", "tiktok_shipping"]),
      })
      .strict(),
    z.object({ kind: z.literal("tracked_shipping") }).strict(),
  ]
);
export type SupplierOperatingFactOfferRequirement = z.infer<
  typeof SupplierOperatingFactOfferRequirementSchema
>;

export const SupplierOperatingFactApplicabilitySchema = z
  .object({
    version: z.literal(1),
    commerceModes: scopeValuesSchema,
    routingModes: scopeValuesSchema,
    sellerRegions: scopeValuesSchema,
    channels: scopeValuesSchema,
    plans: scopeValuesSchema,
    products: scopeValuesSchema,
    providers: scopeValuesSchema,
    destinations: scopeValuesSchema,
    accountCohorts: scopeValuesSchema,
    offerRequirements: z
      .array(SupplierOperatingFactOfferRequirementSchema)
      .default([]),
    notes: scopeValuesSchema,
  })
  .strict();
export type SupplierOperatingFactApplicability = z.infer<
  typeof SupplierOperatingFactApplicabilitySchema
>;

const SupplierOperatingFactAvailabilitySchema = z.enum([
  "available",
  "limited",
  "unavailable",
  "varies",
  "not_confirmed",
]);
export type SupplierOperatingFactAvailability = z.infer<
  typeof SupplierOperatingFactAvailabilitySchema
>;

const SupplierOperatingFactResponsiblePartySchema = z.enum([
  "seller",
  "supplier",
  "sales_channel",
  "print_provider",
  "shared",
  "varies",
  "not_confirmed",
]);
export type SupplierOperatingFactResponsibleParty = z.infer<
  typeof SupplierOperatingFactResponsiblePartySchema
>;

const SupplierFulfillmentConnectionStateSchema = z.enum([
  "direct_connection",
  "alternative_setup",
  "manual_api_only",
  "not_documented",
  "unavailable_for_seller_market",
]);
export type SupplierFulfillmentConnectionState = z.infer<
  typeof SupplierFulfillmentConnectionStateSchema
>;

const fulfillmentConnectionAvailableSchema = z
  .object({
    state: z.enum([
      "direct_connection",
      "alternative_setup",
      "manual_api_only",
    ]),
    workflow: z.string().trim().min(1),
    summary: z.string().trim().min(1),
    conditions: z.array(z.string().trim().min(1)).default([]),
  })
  .strict();

const fulfillmentConnectionUnavailableSchema = z
  .object({
    state: z.enum(["not_documented", "unavailable_for_seller_market"]),
    workflow: z.null(),
    summary: z.string().trim().min(1),
    conditions: z.array(z.string().trim().min(1)).default([]),
  })
  .strict();

export const SupplierFulfillmentConnectionSchema = z.union([
  fulfillmentConnectionAvailableSchema,
  fulfillmentConnectionUnavailableSchema,
]);
export type SupplierFulfillmentConnection = z.infer<
  typeof SupplierFulfillmentConnectionSchema
>;

const SupplierOperatingFactResponsibilityAreaSchema = z.enum([
  "storefront",
  "checkout",
  "buyer_payment",
  "merchant_of_record",
  "sales_tax",
  "buyer_support",
  "buyer_refunds",
  "customer_data",
  "production_shipping",
  "defect_claims",
]);
export type SupplierOperatingFactResponsibilityArea = z.infer<
  typeof SupplierOperatingFactResponsibilityAreaSchema
>;

const responsibilityItemSchema = z
  .object({
    area: SupplierOperatingFactResponsibilityAreaSchema,
    party: SupplierOperatingFactResponsiblePartySchema,
    note: z.string().trim().min(1).nullable().default(null),
  })
  .strict();

const responsibilityModeSchema = z
  .object({
    mode: z.string().trim().min(1),
    label: z.string().trim().min(1).nullable().default(null),
    summary: z.string().trim().min(1),
    responsibilities: z.array(responsibilityItemSchema).min(1),
  })
  .strict();

const planPriceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("free") }).strict(),
  z
    .object({
      kind: z.literal("fixed"),
      amountMinor: z.number().int().nonnegative(),
      currency: z.string().trim().length(3),
      cadence: z.enum(["month", "year"]),
      billingNote: z.string().trim().min(1).nullable().default(null),
    })
    .strict(),
  z.object({ kind: z.literal("custom") }).strict(),
  z.object({ kind: z.literal("not_confirmed") }).strict(),
]);

const planEntrySchema = z
  .object({
    plan: z.string().trim().min(1),
    name: z.string().trim().min(1),
    prices: z.array(planPriceSchema).min(1),
    summary: z.string().trim().min(1).nullable().default(null),
  })
  .strict();

const routingAnswerSchema = z
  .object({
    status: SupplierOperatingFactAvailabilitySchema,
    answer: z.string().trim().min(1),
  })
  .strict();

const valueCoreShape = {
  version: z.literal(1),
  claim: z.string().trim().min(1),
  sellerDecision: z.string().trim().min(1),
  resolutionNote: z.string().trim().min(1).nullable(),
  researchOutcome: SupplierOperatingFactResearchOutcomeSchema.optional(),
};

const SupplierOperatingFactProfileValueSchema = z.discriminatedUnion(
  "kind",
  [
    z.object({ kind: z.literal("statement") }).strict(),
    z
      .object({
        kind: z.literal("capability"),
        label: z.string().trim().min(1),
        status: SupplierOperatingFactAvailabilitySchema,
        summary: z.string().trim().min(1),
        conditions: z.array(z.string().trim().min(1)).default([]),
      })
      .strict(),
    z
      .object({
        kind: z.literal("responsibility"),
        modes: z.array(responsibilityModeSchema).min(1),
      })
      .strict(),
    z
      .object({
        kind: z.literal("plans"),
        plans: z.array(planEntrySchema).min(1),
      })
      .strict(),
    z
      .object({
        kind: z.literal("routing"),
        model: z.string().trim().min(1),
        summary: z.string().trim().min(1),
        facilityChoice: routingAnswerSchema,
        originDisclosure: routingAnswerSchema,
      })
      .strict(),
    z
      .object({
        kind: z.literal("fulfillment_connection"),
        connection: SupplierFulfillmentConnectionSchema,
      })
      .strict(),
  ]
);
export type SupplierOperatingFactProfileValue = z.infer<
  typeof SupplierOperatingFactProfileValueSchema
>;

const [
  statementValueSchema,
  capabilityValueSchema,
  responsibilityValueSchema,
  plansValueSchema,
  routingValueSchema,
  fulfillmentConnectionValueSchema,
] = SupplierOperatingFactProfileValueSchema.options;
const valueCoreSchema = z.strictObject(valueCoreShape);

export const SupplierOperatingFactValueSchema = z.discriminatedUnion("kind", [
  valueCoreSchema.extend(statementValueSchema.shape),
  valueCoreSchema.extend(capabilityValueSchema.shape),
  valueCoreSchema.extend(responsibilityValueSchema.shape),
  valueCoreSchema.extend(plansValueSchema.shape),
  valueCoreSchema.extend(routingValueSchema.shape),
  valueCoreSchema.extend(fulfillmentConnectionValueSchema.shape),
]);
export type SupplierOperatingFactValue = z.infer<
  typeof SupplierOperatingFactValueSchema
>;

export const SUPPLIER_OPERATING_FACT_EVIDENCE_ROLES = [
  "supports",
  "qualifies",
  "contradicts",
  "supersedes",
] as const;
export const SupplierOperatingFactEvidenceRoleSchema = z.enum(
  SUPPLIER_OPERATING_FACT_EVIDENCE_ROLES
);
export type SupplierOperatingFactEvidenceRole = z.infer<
  typeof SupplierOperatingFactEvidenceRoleSchema
>;

export const SUPPLIER_OPERATING_FACT_SOURCE_TYPES = [
  "official_public",
  "official_authenticated",
  "official_structured",
] as const;
export const SupplierOperatingFactSourceTypeSchema = z.enum(
  SUPPLIER_OPERATING_FACT_SOURCE_TYPES
);
export type SupplierOperatingFactSourceType = z.infer<
  typeof SupplierOperatingFactSourceTypeSchema
>;
