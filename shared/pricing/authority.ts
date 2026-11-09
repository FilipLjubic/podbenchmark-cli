import { isProvisionalPriceSource } from "./provisional.ts";
import { readUnknownRecord } from "../schemas/record.ts";
import { SUPPORTED_CURRENCIES, type Currency } from "../runtime/fx/types";

export const PRICE_AUTHORITIES = [
  "supplier_quote",
  "supplier_model",
  "market_fx",
] as const;

export type PriceAuthority = (typeof PRICE_AUTHORITIES)[number];

export const PRICE_AUTHORITY_RANK: Record<PriceAuthority, number> = {
  supplier_quote: 3,
  supplier_model: 2,
  market_fx: 1,
};

export type StoredPriceOrigin = {
  authority: PriceAuthority;
  priceSource: string;
  sourceCurrency: Currency;
  pricePolicyId: string | null;
  pricePolicyVersion: string | null;
  roundingPolicyId: string | null;
  fxSnapshotId: string | null;
};

type StoredPriceOriginInput = {
  supplierId: string;
  currency: string;
  data: unknown;
  explicitAuthority?: string | null;
  explicitPriceSource?: string | null;
  explicitSourceCurrency?: string | null;
  explicitPricePolicyId?: string | null;
  explicitPricePolicyVersion?: string | null;
  explicitRoundingPolicyId?: string | null;
  explicitFxSnapshotId?: string | null;
};

const CURRENCY_SET = new Set<string>(SUPPORTED_CURRENCIES);
const PRICE_AUTHORITY_SET = new Set<string>(PRICE_AUTHORITIES);

export function isPriceAuthority(value: unknown): value is PriceAuthority {
  return typeof value === "string" && PRICE_AUTHORITY_SET.has(value);
}

export function isSupportedCurrency(value: unknown): value is Currency {
  return typeof value === "string" && CURRENCY_SET.has(value);
}

/* eslint-disable podbenchmark/no-runtime-typeof -- Reads one stored string field; this module ships to browsers, which load no schema library. */
function readString(
  record: Record<string, unknown> | null,
  key: string
): string | null {
  const value = record?.[key];
  return typeof value === "string" && /\S/u.test(value) ? value : null;
}
/* eslint-enable podbenchmark/no-runtime-typeof */

function parseCurrency(value: unknown, fallback: string): Currency {
  if (isSupportedCurrency(value)) return value;
  if (isSupportedCurrency(fallback)) return fallback;
  throw new Error(`Unsupported stored price currency: ${fallback}`);
}

function provisionalPriceOrigin(input: StoredPriceOriginInput, fx: Record<string, unknown> | null): StoredPriceOrigin {
  return {
    authority: "supplier_model",
    priceSource: "prodigi-option-estimate",
    sourceCurrency: parseCurrency(readString(fx, "fxFromCurrency"), input.currency),
    pricePolicyId: "prodigi-provisional-option-cost",
    pricePolicyVersion: "v1",
    roundingPolicyId: "nearest-cent",
    fxSnapshotId: input.explicitFxSnapshotId ?? readString(fx, "snapshotId"),
  };
}

export function resolveStoredPriceOrigin(
  input: StoredPriceOriginInput
): StoredPriceOrigin {
  const data = readUnknownRecord(input.data);
  const fx = readUnknownRecord(data?.fx);
  const dataPriceSource = readString(data, "priceSource");

  if (isProvisionalPriceSource(input.explicitPriceSource ?? dataPriceSource)) {
    return provisionalPriceOrigin(input, fx);
  }

  if (input.supplierId === "printful" && input.currency !== "USD") {
    return {
      authority: "supplier_model",
      priceSource: "printful-three-tier-model",
      sourceCurrency: "USD",
      pricePolicyId: "printful-three-tier",
      pricePolicyVersion: "v1",
      roundingPolicyId: "nearest-quarter",
      fxSnapshotId: null,
    };
  }

  const explicitAuthority = isPriceAuthority(input.explicitAuthority)
    ? input.explicitAuthority
    : null;
  const currency = parseCurrency(input.explicitSourceCurrency, input.currency);

  return {
    authority: explicitAuthority ?? "supplier_quote",
    priceSource:
      input.explicitPriceSource ?? dataPriceSource ?? "supplier-native",
    sourceCurrency: currency,
    pricePolicyId: input.explicitPricePolicyId ?? null,
    pricePolicyVersion: input.explicitPricePolicyVersion ?? null,
    roundingPolicyId: input.explicitRoundingPolicyId ?? null,
    fxSnapshotId: input.explicitFxSnapshotId ?? null,
  };
}
