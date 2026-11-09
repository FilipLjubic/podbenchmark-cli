/** The sales channels with fee research; kept apart so clients avoid the fee registry. */
export const SALES_CHANNELS = [
  "etsy",
  "shopify",
  "woocommerce",
  "tiktok-shop",
] as const;
export type SalesChannel = (typeof SALES_CHANNELS)[number];

export const SALES_CHANNEL_LABELS = {
  etsy: "Etsy",
  shopify: "Shopify",
  "tiktok-shop": "TikTok Shop",
  woocommerce: "WooCommerce",
} satisfies Readonly<Record<SalesChannel, string>>;
