import { z } from "zod";

import { SUPPORTED_CURRENCIES } from "../runtime/fx/types";
import { PRICE_AUTHORITIES } from "./authority";
import { readSupplierDutyEstimate } from "./duty";
import {
  isEmbroideryPricingMethod,
  readSupplierPricingContext,
} from "./required-charges";
import type {
  PrintTechnologyDisplayOffer,
  PrintTechnologyDisplayOffers,
} from "./types";

export const CurrencySchema = z.enum(SUPPORTED_CURRENCIES);

const PositiveRatesSchema = z.partialRecord(
  CurrencySchema,
  z.number().positive()
);

export const RelativeRatesPolicyModelSchema = z.object({
  kind: z.literal("relative_rates"),
  rates: PositiveRatesSchema,
  roundingIncrement: z.number().positive(),
});
export const PrintfulTieredPolicyModelSchema = z.object({
  kind: z.literal("printful_tiered"),
  rates: z.object({
    low: PositiveRatesSchema,
    normal: PositiveRatesSchema,
    high: PositiveRatesSchema,
  }),
  roundingIncrement: z.number().positive(),
});
export const SupplierCurrencyPolicyModelSchema = z.discriminatedUnion("kind", [
  RelativeRatesPolicyModelSchema,
  PrintfulTieredPolicyModelSchema,
]);

export const SupplierCurrencyPolicySchema = z.object({
  snapshotId: z.string().min(1),
  supplierId: z.string().min(1),
  policyId: z.string().min(1),
  policyVersion: z.string().min(1),
  baseCurrency: CurrencySchema,
  supportedCurrencies: z.array(CurrencySchema).min(1),
  roundingPolicyId: z.string().min(1),
  model: SupplierCurrencyPolicyModelSchema,
  capturedAt: z.iso.datetime(),
});

export function parseSupplierCurrencyPolicy(
  value: unknown
): z.infer<typeof SupplierCurrencyPolicySchema> {
  return SupplierCurrencyPolicySchema.parse(value);
}

const AmountSchema = z.number().finite().nonnegative();
const NullableTextSchema = z.string().min(1).nullable();

const PrintTechnologyDisplayOfferSchema = z.object({
  basePrice: AmountSchema,
  shippingPrice: AmountSchema,
  dutyPrice: AmountSchema.nullable(),
  dutyEstimate: z.unknown().optional(),
  pricingContext: z.unknown().optional(),
  variantId: z.string().min(1),
  priceOrigin: z.object({
    authority: z.enum(PRICE_AUTHORITIES),
    priceSource: z.string().min(1),
    sourceCurrency: CurrencySchema,
    pricePolicyId: NullableTextSchema,
    pricePolicyVersion: NullableTextSchema,
    roundingPolicyId: NullableTextSchema,
    fxSnapshotId: NullableTextSchema,
  }),
  decorationRank: z.number().finite(),
  decorationToken: z.string().nullable(),
});

/**
 * Read a stored display-offer map. An entry that is malformed, carries a
 * context the shared schema rejects, or is embroidery without a context is
 * dropped, so its method price stays unknown rather than wrong.
 */
export function parsePrintTechnologyDisplayOffers(
  value: unknown
): PrintTechnologyDisplayOffers {
  const record = z.record(z.string(), z.unknown()).safeParse(value);
  if (!record.success) return {};
  const entries: Array<[string, PrintTechnologyDisplayOffer]> = [];
  for (const [technology, raw] of Object.entries(record.data)) {
    const parsed = PrintTechnologyDisplayOfferSchema.safeParse(raw);
    if (!parsed.success) continue;
    const { pricingContext, dutyEstimate: rawDutyEstimate, ...offer } = parsed.data;
    const dutyEstimate = offer.dutyPrice === null ? readSupplierDutyEstimate(rawDutyEstimate) : null;
    const dutyFields = dutyEstimate ? { dutyEstimate } : {};
    const context = readSupplierPricingContext(pricingContext);
    if (context.status === "invalid") continue;
    if (context.status === "absent") {
      if (isEmbroideryPricingMethod(technology)) continue;
      entries.push([technology, { ...offer, ...dutyFields }]);
      continue;
    }
    entries.push([technology, { ...offer, ...dutyFields, pricingContext: context.context }]);
  }
  return Object.fromEntries(entries);
}
