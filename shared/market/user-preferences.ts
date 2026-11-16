import { readUnknownRecord } from "../schemas/record";
import { DESTINATION_FALLBACK_ORDER } from "../offers/destination-fallback";
import { type Destination, TARGET_DESTINATIONS } from "../kernel/enums";
import { SUPPORTED_CURRENCIES, type Currency } from "./fx/types";
import { isFiniteNumberValue } from "../kernel/primitives";

export { SUPPORTED_CURRENCIES };

export type UserPreferences = {
	destination: Destination;
	currency: Currency;
	shippableOnly: boolean;
};

type PriceRange = {
	min: number;
	max: number;
};

export type DestinationCurrencyPriceMap = Partial<
	Record<Destination, Partial<Record<Currency, PriceRange>>>
>;

function readDestinationCurrencyPriceRange(value: unknown): PriceRange | null {
	const record = readUnknownRecord(value);
	if (!record) {
		return null;
	}

	const min = record.min;
	const max = record.max;
	if (!isFiniteNumberValue(min) || min < 0) {
		return null;
	}
	if (!isFiniteNumberValue(max) || max < min) {
		return null;
	}

	return { min, max };
}

export function parseDestinationCurrencyPriceMap(
	value: unknown,
): DestinationCurrencyPriceMap | null {
	const parsed = readUnknownRecord(value);
	if (!parsed) {
		return null;
	}

	const prices: DestinationCurrencyPriceMap = {};
	let rangeCount = 0;

	for (const destination of TARGET_DESTINATIONS) {
		const destinationRecord = readUnknownRecord(parsed[destination]);
		if (!destinationRecord) {
			continue;
		}

		const destinationPrices: Partial<Record<Currency, PriceRange>> = {};
		for (const currency of SUPPORTED_CURRENCIES) {
			const range = readDestinationCurrencyPriceRange(
				destinationRecord[currency],
			);
			if (!range) {
				continue;
			}

			destinationPrices[currency] = range;
			rangeCount += 1;
		}

		if (Object.keys(destinationPrices).length > 0) {
			prices[destination] = destinationPrices;
		}
	}

	return rangeCount > 0 ? prices : null;
}

type ResolvedPreferencePrice = PriceRange & {
	destination: Destination;
	currency: Currency;
	isDestinationFallback: boolean;
	isCurrencyFallback: boolean;
};

export const DEFAULT_DESTINATION: Destination = "US";

export const DESTINATION_TO_CURRENCY: Record<Destination, Currency> = {
	US: "USD",
	GB: "GBP",
	DE: "EUR",
	AU: "AUD",
	CA: "CAD",
};

export const DEFAULT_CURRENCY: Currency =
	DESTINATION_TO_CURRENCY[DEFAULT_DESTINATION];

export const DESTINATION_LABELS: Record<Destination, string> = {
	US: "United States",
	GB: "United Kingdom",
	DE: "Germany",
	AU: "Australia",
	CA: "Canada",
};

/** “US”, “UK”, “DE”: the market on switches, chips and tickets. */
export const DESTINATION_CODE: Record<Destination, string> = {
	US: "US",
	GB: "UK",
	DE: "DE",
	AU: "AU",
	CA: "CA",
};

export const DESTINATION_FLAGS: Record<Destination, string> = {
	US: "🇺🇸",
	GB: "🇬🇧",
	DE: "🇩🇪",
	AU: "🇦🇺",
	CA: "🇨🇦",
};

export const CURRENCY_LABELS: Record<Currency, string> = {
	USD: "US Dollar",
	EUR: "Euro",
	GBP: "British Pound",
	AUD: "Australian Dollar",
	CAD: "Canadian Dollar",
};

export const PREFERENCE_COOKIE_NAME = "pod-pref";
export const DESTINATION_STORAGE_KEY = "pod-destination";
export const CURRENCY_STORAGE_KEY = "pod-currency";
export const SHIPPABLE_ONLY_STORAGE_KEY = "pod-shippable-only";
export const PREFERENCES_CHANGED_EVENT = "pod:preferences-change";

const DESTINATION_SET = new Set<string>(TARGET_DESTINATIONS);
const CURRENCY_SET = new Set<string>(SUPPORTED_CURRENCIES);

export function isDestination(value: string | null | undefined): value is Destination {
	return !!value && DESTINATION_SET.has(value);
}

export function isCurrency(value: string | null | undefined): value is Currency {
	return !!value && CURRENCY_SET.has(value);
}

export function getDefaultCurrencyForDestination(
	destination: Destination,
): Currency {
	return DESTINATION_TO_CURRENCY[destination];
}

export function sanitizeUserPreferences(
	value:
		| Partial<UserPreferences>
		| {
			destination?: string | null | undefined;
			currency?: string | null | undefined;
			shippableOnly?: boolean | null | undefined;
		}
		| null
		| undefined,
): UserPreferences {
	const destination = isDestination(value?.destination)
		? value.destination
		: DEFAULT_DESTINATION;
	const fallbackCurrency = getDefaultCurrencyForDestination(destination);
	const currency = isCurrency(value?.currency) ? value.currency : fallbackCurrency;

	return {
		destination,
		currency,
		shippableOnly: value?.shippableOnly === true,
	};
}

export function serializePreferencesCookie(preferences: UserPreferences): string {
	const params = new URLSearchParams();
	params.set("d", preferences.destination);
	params.set("c", preferences.currency);
	if (preferences.shippableOnly) {
		params.set("s", "1");
	}
	return params.toString();
}

export function parsePreferencesCookie(
	rawCookieValue: string | null | undefined,
): UserPreferences | null {
	if (!rawCookieValue) return null;

	try {
		const decoded = decodeURIComponent(rawCookieValue);
		const params = new URLSearchParams(decoded);
		return sanitizeUserPreferences({
			destination: params.get("d") ?? undefined,
			currency: params.get("c") ?? undefined,
			shippableOnly: params.get("s") === "1",
		});
	} catch {
		return null;
	}
}

export function resolvePriceForPreferences(
	prices: DestinationCurrencyPriceMap | undefined,
	preferences: Pick<UserPreferences, "destination" | "currency">,
): ResolvedPreferencePrice | null {
	if (!prices) return null;

	const destinations = [
		preferences.destination,
		...DESTINATION_FALLBACK_ORDER[preferences.destination],
	];

	for (const destination of destinations) {
		const destinationPrices = prices[destination];
		if (!destinationPrices) continue;

		const range = destinationPrices[preferences.currency];
		if (!range) continue;

		return {
			...range,
			destination,
			currency: preferences.currency,
			isDestinationFallback: destination !== preferences.destination,
			isCurrencyFallback: false,
		};
	}

	return null;
}
