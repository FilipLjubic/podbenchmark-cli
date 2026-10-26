/** The sales channels with fee research; kept apart so clients avoid the fee registry. */
export const SALES_CHANNELS = [
  "etsy",
  "shopify",
  "woocommerce",
  "tiktok-shop",
] as const;
export type SalesChannel = (typeof SALES_CHANNELS)[number];
