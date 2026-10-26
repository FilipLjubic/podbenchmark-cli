import type {
	EurBaseRatesSchema,
	FxContextSchema,
	FxSourceModeSchema,
} from "./schema";

/** The 5 MVP currencies. Attempting to use anything else is an error. */
export const SUPPORTED_CURRENCIES = ["USD", "EUR", "GBP", "AUD", "CAD"] as const;
export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

/** EUR-based rate map. EUR itself is always 1.0 (implicit, not stored). */
export type EurBaseRates = typeof EurBaseRatesSchema.Type;

export type FxSourceMode = typeof FxSourceModeSchema.Type;

/**
 * The loaded rate environment. Created once by `initFxRates()`,
 * passed to every conversion function.
 */
export type FxContext = typeof FxContextSchema.Type;

/** Frozen, immutable copy of an FxContext for deterministic scraping. */
export interface FxSnapshot extends Readonly<FxContext> {
	/** Unique identifier for this snapshot (typically scrape job ID or timestamp). */
	snapshotId: string;
}

/** Per-variant metadata stored in ProductVariant.data.fx. */
export interface FxProvenance {
	// ── REQUIRED ──────────────────────────────────────────────
	fxRateUsed: number;
	fxRateDate: string;
	fxPolicyVersion: string;
	fxSourceMode: FxSourceMode;
	capturedAt: string;

	// ── OPTIONAL (enrichment) ─────────────────────────────────
	fxFromCurrency?: Currency;
	fxToCurrency?: Currency;
	fxFallbackReason?: string;
	fxProviderName?: string;
}

/** Returned by every conversion function. Amount + full provenance in one object. */
export interface ConvertedPriceResult {
	/** Converted amount, rounded to nearest cent (Math.round(x * 100) / 100). */
	amount: number;

	/** Full provenance metadata ready to store in ProductVariant.data.fx. */
	provenance: FxProvenance;
}

/** Summary of the rate environment for logging, debugging, and build metadata. */
export interface FxMetadata {
	rateDate: string;
	policyVersion: string;
	providerName: string;
	sourceMode: FxSourceMode;
	fetchedAt: string;
	stale: boolean;
	currencyCount: number;
}

/** Options for `initFxRates()`. */
export interface FxInitOptions {
	/**
	 * Which context this init serves.
	 * - "scrape_snapshot": scraper run (default)
	 * - "build_live": SSG build pipeline
	 */
	sourceMode?: Exclude<FxSourceMode, "native">;

	/** Override provider name in provenance. Default: "frankfurter" */
	providerName?: string;

	/** Force fresh fetch, ignoring cache. Respects NO_CACHE env var as well. */
	forceRefresh?: boolean;
}
