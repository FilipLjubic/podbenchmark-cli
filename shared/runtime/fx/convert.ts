import { isTextValue } from "../text";
import { FxRateError } from "./errors";
import {
  SUPPORTED_CURRENCIES,
  type ConvertedPriceResult,
  type Currency,
  type FxContext,
} from "./types";

const CURRENCY_SET = new Set<string>(SUPPORTED_CURRENCIES);

function assertCurrency(value: string): asserts value is Currency {
  if (!CURRENCY_SET.has(value)) {
    throw new FxRateError(`Unsupported currency: ${value}`);
  }
}

export function parseCurrency(value: unknown): Currency {
  if (!isTextValue(value)) {
    throw new FxRateError(`Unsupported currency: ${String(value)}`);
  }
  assertCurrency(value);
  return value;
}

function getEurRate(currency: Currency, context: FxContext): number {
  if (currency === "EUR") return 1;

  const rate = context.rates[currency];
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new FxRateError(`Missing rate for ${currency}`);
  }

  return rate;
}

function buildProvenance(
  effectiveRate: number,
  from: Currency,
  to: Currency,
  context: FxContext
) {
  return {
    fxRateUsed: effectiveRate,
    fxRateDate: context.rateDate,
    fxPolicyVersion: context.policyVersion,
    fxSourceMode: from === to ? ("native" as const) : context.sourceMode,
    capturedAt: new Date().toISOString(),
    fxFromCurrency: from,
    fxToCurrency: to,
    fxProviderName: context.providerName,
  };
}

export function convertPrice(
  amount: number,
  from: Currency,
  to: Currency,
  context: FxContext
): ConvertedPriceResult {
  assertCurrency(from);
  assertCurrency(to);

  if (from === to) {
    return {
      amount,
      provenance: buildProvenance(1, from, to, context),
    };
  }

  const fromRate = getEurRate(from, context);
  const toRate = getEurRate(to, context);
  const crossRate = toRate / fromRate;
  const converted = Math.round(amount * crossRate * 100) / 100;

  return {
    amount: converted,
    provenance: buildProvenance(
      Math.round(crossRate * 10000) / 10000,
      from,
      to,
      context
    ),
  };
}
