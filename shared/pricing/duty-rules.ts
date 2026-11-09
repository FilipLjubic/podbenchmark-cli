import { convertPrice } from "../runtime/fx/convert";
import { readUnknownRecord } from "../schemas/record";
import type { Currency, FxContext } from "../runtime/fx/types";

/**
 * Seller-billed duty: a charge the supplier bills the seller on top of
 * `productPrice` and `shippingPrice`. It is stored apart in
 * `ProductVariant.dutyPrice` (offer currency): `0` when the rules know none
 * applies, `null` when a charge may apply but cannot be established.
 */
export type DutyOutcome = "charged" | "not_applicable" | "estimated" | "unknown";

/** Inclusive native amount bounds, derived from compatible rounded quotes. */
export type SupplierDutyEstimate = {
	min: number;
	max: number;
	currency: Currency;
	basis: "line_net_x_compatible_product_rate";
};

/** Native evidence survives even when independent duty FX is unavailable. */
export type SupplierDutyEstimateProjection = {
	native: SupplierDutyEstimate;
	converted: { min: number; max: number; currency: Currency } | null;
};

const DUTY_CURRENCIES: readonly string[] = ["USD", "EUR", "GBP", "AUD", "CAD"];

export function isDutyCurrency(value: unknown): value is Currency {
	return typeof value === "string" && DUTY_CURRENCIES.includes(value);
}

/** A non-negative amount that is a whole number of minor units. */
export function isMinorUnitAmount(value: unknown): value is number {
	return typeof value === "number"
		&& Number.isFinite(value)
		&& value >= 0
		&& Number.isSafeInteger(Math.round(value * 100))
		&& Math.abs(value * 100 - Math.round(value * 100)) < 0.000001;
}

function hasExactKeys(record: Record<string, unknown>, keys: readonly string[]): boolean {
	const own = Object.keys(record);
	return own.length === keys.length && keys.every(key => own.includes(key));
}

function readDutyRange(value: unknown): { min: number; max: number; currency: Currency } | null {
	const record = readUnknownRecord(value);
	if (!record || !hasExactKeys(record, ["min", "max", "currency"])) return null;
	const { min, max, currency } = record;
	if (!isMinorUnitAmount(min) || !isMinorUnitAmount(max) || !isDutyCurrency(currency) || min > max) return null;
	return { min, max, currency };
}

export function readSupplierDutyEstimate(value: unknown): SupplierDutyEstimate | null {
	const record = readUnknownRecord(value);
	if (!record || !hasExactKeys(record, ["min", "max", "currency", "basis"])) return null;
	if (record.basis !== "line_net_x_compatible_product_rate") return null;
	const range = readDutyRange({ min: record.min, max: record.max, currency: record.currency });
	return range && range.min < range.max ? { ...range, basis: "line_net_x_compatible_product_rate" } : null;
}

/** An exact scalar always takes precedence over an incompatible stored estimate. */
export function readStoredSupplierDutyEstimate(data: unknown, dutyPrice: number | null): SupplierDutyEstimate | null {
	if (dutyPrice !== null) return null;
	const duty = readUnknownRecord(readUnknownRecord(data)?.duty);
	return duty?.outcome === "estimated" ? readSupplierDutyEstimate(duty.estimate) : null;
}

export function readSupplierDutyEstimateProjection(value: unknown): SupplierDutyEstimateProjection | null {
	const record = readUnknownRecord(value);
	if (!record || !hasExactKeys(record, ["native", "converted"])) return null;
	const native = readSupplierDutyEstimate(record.native);
	if (!native) return null;
	if (record.converted === null) return { native, converted: null };
	const converted = readDutyRange(record.converted);
	return converted ? { native, converted } : null;
}

/** Convert each endpoint using duty FX, never a supplier's goods-price policy. */
export function projectSupplierDutyEstimate(
	estimate: SupplierDutyEstimate | null | undefined,
	targetCurrency: Currency,
	fxContext: FxContext | null,
): SupplierDutyEstimateProjection | null {
	const native = readSupplierDutyEstimate(estimate);
	if (!native) return null;
	if (native.currency === targetCurrency) return { native, converted: { min: native.min, max: native.max, currency: targetCurrency } };
	const result: SupplierDutyEstimateProjection = { native, converted: null };
	if (!fxContext || !isDutyCurrency(targetCurrency)) return result;
	const fromRate = native.currency === "EUR" ? 1 : fxContext.rates[native.currency];
	const toRate = targetCurrency === "EUR" ? 1 : fxContext.rates[targetCurrency];
	if (!Number.isFinite(fromRate) || !Number.isFinite(toRate) || fromRate <= 0 || toRate <= 0) return result;
	try {
		const min = convertPrice(native.min, native.currency, targetCurrency, fxContext).amount;
		const max = convertPrice(native.max, native.currency, targetCurrency, fxContext).amount;
		result.converted = readDutyRange({ min, max, currency: targetCurrency });
	} catch {
		// The goods price can still be usable when independent duty FX is absent.
	}
	return result;
}

function formatDutyAmount(amount: number, currency: Currency): string {
	return new Intl.NumberFormat(currency === "USD" ? "en-US" : "en-GB", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
}

/** Show one estimate matching the amount used for profit; keep bounds in evidence. */
export function formatSupplierDutyEstimate(estimate: SupplierDutyEstimateProjection): string {
	const range = estimate.converted ?? estimate.native;
	const formatted = formatDutyAmount(range.max, range.currency);
	return `${formatted}${estimate.converted ? "" : " (not converted)"}`;
}

export function describeSupplierDuty(input: {
	duty: number | null;
	currency: Currency;
	dutyEstimate?: SupplierDutyEstimateProjection | null;
}): string {
	if (input.duty !== null) return `Duty ${formatDutyAmount(input.duty, input.currency)} (separate)`;
	const estimate = input.dutyEstimate ?? null;
	return estimate ? `Estimated duty ${formatSupplierDutyEstimate(estimate)} (separate)` : "Duty unverified (separate)";
}

/** Rule inputs and results, stored verbatim in `ProductVariant.data.duty`. */
type SellerDutyEvidenceBase = {
	ruleId: string;
	ruleVersion: string;
	reason: string;
	originCountry: string | null;
	destination: string;
	/**
	 * The reviewed source a documented outcome rests on: an evidence id from
	 * `shared/runtime/tax-treatment.ts`, e.g. `fourthwall-tax`.
	 */
	evidenceId?: string;
	/** The supplier's own charge, in the currency its rule is written in. */
	source?: { amount: number; currency: Currency; basis: string };
	/** Comparison scope; this is not the seller's actual customs declaration. */
	assumptions?: readonly string[];
	/** Supplier-price feasibility guard, not a declared retail value. */
	threshold?: {
		limit: number;
		currency: Currency;
		goodsValue: number;
		goodsValueEur: number | null;
		basis: "supplier-price-guard";
	};
	/** How the source amount became the offer currency. */
	conversion?: {
		from: Currency;
		to: Currency;
		rate: number;
		rateDate: string;
		fxPolicyVersion: string;
		fxProvider: string;
		fxSnapshotId: string | null;
	};
};

export type SellerDutyEvidence = SellerDutyEvidenceBase & (
	| { outcome: Exclude<DutyOutcome, "estimated">; estimate?: never }
	| { outcome: "estimated"; estimate: SupplierDutyEstimate; source?: never }
);

export type DutyAssessment = {
	/** Offer-currency amount: `0` when known none, `null` when unknown. */
	dutyPrice: number | null;
	evidence: SellerDutyEvidence;
};

export type DutyFxEnvironment = {
	context: FxContext;
	snapshotId?: string | null;
};

export const EU_MEMBER_COUNTRIES: ReadonlySet<string> = new Set([
	"AT",
	"BE",
	"BG",
	"HR",
	"CY",
	"CZ",
	"DK",
	"EE",
	"FI",
	"FR",
	"DE",
	"GR",
	"HU",
	"IE",
	"IT",
	"LV",
	"LT",
	"LU",
	"MT",
	"NL",
	"PL",
	"PT",
	"RO",
	"SK",
	"SI",
	"ES",
	"SE",
]);

/** Normalizes a fulfillment country to ISO 3166-1 alpha-2, or null if unusable. */
export function normalizeOriginCountry(
	value: string | null | undefined,
): string | null {
	const code = value?.trim().toUpperCase();
	if (!code || !/^[A-Z]{2}$/.test(code)) return null;
	return code === "UK" ? "GB" : code;
}

const roundCents = (value: number): number => Math.round(value * 100) / 100;

function convertDuty(
	amount: number,
	from: Currency,
	to: Currency,
	fx: DutyFxEnvironment | null,
): {
	amount: number;
	conversion: NonNullable<SellerDutyEvidence["conversion"]> | null;
} | null {
	if (from === to) return { amount, conversion: null };
	if (!fx) return null;
	try {
		const result = convertPrice(amount, from, to, fx.context);
		return {
			amount: result.amount,
			conversion: {
				from,
				to,
				rate: result.provenance.fxRateUsed,
				rateDate: fx.context.rateDate,
				fxPolicyVersion: fx.context.policyVersion,
				fxProvider: fx.context.providerName,
				fxSnapshotId: fx.snapshotId ?? null,
			},
		};
	} catch {
		return null;
	}
}

/**
 * Printify bills EU deliveries from outside the EU a temporary customs duty:
 * EUR 3 per commodity code per parcel, on parcels under EUR 150, since
 * 2026-07-01 (https://printify.com/blog/eu-customs-duty/, modified 2026-10-05).
 * A comparison prices one item, so one parcel and one commodity code.
 *
 * Printify announces a second duty of about EUR 2 per parcel from November
 * 2026. It stays out of `perParcel` until Printify confirms it applies.
 */
export const PRINTIFY_EU_IMPORT_DUTY = {
	ruleId: "printify-eu-import-duty",
	ruleVersion: "2026-07-01",
	currency: "EUR",
	perCommodityCode: 3,
	perParcel: 0,
	parcelValueLimit: 150,
} as const;

/**
 * A duty billed as a fixed amount in its own currency. The stored `dutyPrice`
 * is only our conversion of it into the offer currency.
 */
function fixedSupplierDutyCharge(input: {
	supplierId: string;
	destination: string;
	dutyPrice: number | null;
}): { amount: number; currency: Currency } | null {
	if (input.dutyPrice === null || input.dutyPrice <= 0) return null;
	if (input.supplierId !== "printify" || !EU_MEMBER_COUNTRIES.has(input.destination)) return null;
	return { amount: PRINTIFY_EU_IMPORT_DUTY.perCommodityCode + PRINTIFY_EU_IMPORT_DUTY.perParcel, currency: PRINTIFY_EU_IMPORT_DUTY.currency };
}

/** The duty has its own currency basis, independent of supplier catalog FX. */
export function supplierDutySource(input: {
	supplierId: string;
	destination: string;
	dutyPrice: number | null;
	currency: Currency;
}): { amount: number; currency: Currency } | null {
	if (input.dutyPrice === null) return null;
	return fixedSupplierDutyCharge(input) ?? { amount: input.dutyPrice, currency: input.currency };
}

/**
 * True when two stored duties are the same charge, even if our conversion of a
 * fixed foreign-currency charge moved with the exchange rate.
 */
export function isSameSupplierDuty(input: {
	supplierId: string;
	destination: string;
	before: number | null;
	after: number | null;
}): boolean {
	if (input.before === input.after) return true;
	const before = fixedSupplierDutyCharge({ ...input, dutyPrice: input.before });
	const after = fixedSupplierDutyCharge({ ...input, dutyPrice: input.after });
	return before !== null && after !== null &&
		before.amount === after.amount && before.currency === after.currency;
}

/** Catalog conversion policies price goods, not an independently billed levy. */
export function convertSupplierDutyPrice(input: {
	supplierId: string;
	destination: string;
	dutyPrice: number | null;
	sourceCurrency: Currency;
	targetCurrency: Currency;
	fxContext: FxContext | null;
}): number | null {
	if (input.dutyPrice === null || input.dutyPrice === 0) return input.dutyPrice;
	const fx = input.fxContext ? { context: input.fxContext } : null;
	// Convert a fixed charge from its own currency, so a stored conversion that
	// the writer kept through exchange-rate moves never shows a stale amount.
	const fixed = fixedSupplierDutyCharge(input);
	if (fixed) {
		const converted = convertDuty(fixed.amount, fixed.currency, input.targetCurrency, fx);
		if (converted) return roundCents(converted.amount);
		return input.sourceCurrency === input.targetCurrency ? input.dutyPrice : null;
	}
	if (input.sourceCurrency === input.targetCurrency) return input.dutyPrice;
	return convertDuty(input.dutyPrice, input.sourceCurrency, input.targetCurrency, fx)?.amount ?? null;
}

/**
 * The flat duty needs three facts: the real fulfillment country (the UK is
 * outside the EU; a broad "Europe" region is not enough), whether the goods
 * stay under the parcel limit, and a EUR conversion of the charge. Any it
 * cannot establish leaves the duty unknown rather than zero. The caller must
 * explicitly opt into the low-value comparison scenario: supplier cost alone
 * never proves an actual parcel's declared value.
 */
export function assessPrintifyEuImportDuty(input: {
	originCountry: string | null | undefined;
	destination: string;
	/** Explicit scenario: one item/parcel/code with declared value below EUR 150. */
	assumeLowValueParcel: boolean;
	/** Supplier price is a conservative guard; it does not prove declared value. */
	goodsPrice: number;
	currency: Currency;
	fx: DutyFxEnvironment | null;
}): DutyAssessment {
	const rule = PRINTIFY_EU_IMPORT_DUTY;
	const originCountry = normalizeOriginCountry(input.originCountry);
	const base = {
		ruleId: rule.ruleId,
		ruleVersion: rule.ruleVersion,
		originCountry,
		destination: input.destination,
	};
	const finish = (
		dutyPrice: number | null,
		outcome: Exclude<DutyOutcome, "estimated">,
		reason: string,
		extra: Partial<SellerDutyEvidenceBase> = {},
	): DutyAssessment => ({
		dutyPrice,
		evidence: { ...base, outcome, reason, ...extra },
	});

	if (!EU_MEMBER_COUNTRIES.has(input.destination)) {
		return finish(0, "not_applicable", "destination_outside_eu");
	}
	if (!originCountry) return finish(null, "unknown", "origin_unknown");
	if (EU_MEMBER_COUNTRIES.has(originCountry)) {
		return finish(0, "not_applicable", "origin_in_eu");
	}

	if (!input.assumeLowValueParcel) return finish(null, "unknown", "declared_value_unknown");
	const goodsEur = convertDuty(input.goodsPrice, input.currency, "EUR", input.fx);
	if (!goodsEur) return finish(null, "unknown", "fx_unavailable");
	const threshold = {
		limit: rule.parcelValueLimit,
		currency: rule.currency,
		goodsValue: input.goodsPrice,
		goodsValueEur: roundCents(goodsEur.amount),
		basis: "supplier-price-guard" as const,
	};
	if (goodsEur.amount >= rule.parcelValueLimit) {
		return finish(null, "unknown", "parcel_value_over_limit", { threshold });
	}

	const sourceAmount = rule.perCommodityCode + rule.perParcel;
	const charge = convertDuty(sourceAmount, rule.currency, input.currency, input.fx);
	if (!charge) return finish(null, "unknown", "fx_unavailable", { threshold });
	const evidence: Partial<SellerDutyEvidence> = {
		assumptions: ["one_item", "one_parcel", "one_commodity_code", "declared_value_below_eur_150"],
		threshold,
		source: {
			amount: sourceAmount,
			currency: rule.currency,
			basis: "per_commodity_code_per_parcel",
		},
	};
	if (charge.conversion) evidence.conversion = charge.conversion;
	return finish(roundCents(charge.amount), "charged", "non_eu_origin_to_eu", evidence);
}
