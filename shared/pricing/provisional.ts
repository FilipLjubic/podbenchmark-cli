/** Provisional option costs are display estimates, never supplier price observations. */
export const PRODIGI_PROVISIONAL_PRICE_SOURCE = "prodigi-option-estimate";
export const isProvisionalPriceSource = (
  source: string | null | undefined
): boolean => source === PRODIGI_PROVISIONAL_PRICE_SOURCE;
