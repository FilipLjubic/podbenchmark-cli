import { VERSION } from "./api";

export const SKILL_NAME = "podbenchmark";
/** Present in every file this CLI writes, so it never overwrites someone else's. */
export const SKILL_MARKER = "Installed by the podbenchmark CLI";

export const skillText = () => `---
name: ${SKILL_NAME}
description: Compare print-on-demand (POD) supplier prices for a product, size, color and destination with the podbenchmark CLI. Use when a seller asks which supplier is cheapest (Printify, Printful, Gelato, Prodigi, CustomCat, Fourthwall, Inkthreadable), what delivered cost or shipping a blank costs, how much they keep per sale on Etsy or Shopify, or which supplier fits their shop.
---

<!-- ${SKILL_MARKER} v${VERSION} (npx podbenchmark skills add). Run it again to update this file. -->

# POD Benchmark

Compare the same print-on-demand product across suppliers from the terminal. Prices are supplier quotes checked on the dates in each answer, before sales tax.

Run commands as \`npx podbenchmark <command>\`. Output is JSON when run by an agent; add \`--json\` to be sure.

## Flow: search, then options, then compare

1. \`npx podbenchmark search "bella canvas 3001" --json\` finds products. Use a \`canonicalProductId\` from the result.
2. \`npx podbenchmark options bella-canvas-3001 --json\` lists the product's fields (size, color…) and their values. Narrow with words or flags: \`options bella-canvas-3001 m black\`.
3. \`npx podbenchmark compare bella-canvas-3001 --size m --color black --to US --json\` compares every supplier for that configuration.

Never guess a size or color. Take values from \`options\`. If a value is rejected, the error lists the valid ones.

## Seller context (only when the seller said it)

- \`--current printful\`: the supplier they use now; it is pinned first and every row shows the difference.
- \`--sell-for 24 --on etsy --shop-in US\`: what they charge and where they sell; rows show what they keep per sale after delivered cost and platform fees. \`--on\` is etsy, shopify, woocommerce or tiktok-shop.
- \`npx podbenchmark price bella-canvas-3001 --size m --color black --margin 30 --on etsy\`: the price to charge with each supplier to keep 30%.
- A pasted supplier link works as the product: \`compare https://printify.com/app/products/...\`.

## Other commands

- \`categories\`, \`product <id>\` (specs, print methods, similar products).
- \`suppliers\`, \`supplier <id>\` (plans, fees, branding, where it prints), \`supplier <id> --prices --vs <other>\` (where it is cheapest).
- \`guide mugs --on etsy\`: which suppliers fit a shop for t-shirts, hoodies, mugs, wall-art, stickers or phone-cases.
- \`--to US|GB|DE|CA|AU\`, \`--currency USD|EUR|GBP|CAD|AUD\`, \`--schema\` (exact input and output fields of a command), \`--dry-run\` (show the request).

## Reading results

- \`null\` or "—" means unknown, never 0. Do not treat a missing price as free or as the cheapest.
- Product + shipping excludes duty and sales tax. Show duty separately: established (including zero), one labelled estimate, or unverified. Profit may deduct known or estimated duty; retain its qualification. Estimated/unverified duty and conditional design/setup prices do not support best-profit or gap claims in either profit mode.
- Printify is a marketplace: a row can say "via" a print provider.
- Exit codes: 0 ok, 1 bad flags or option values, 2 nothing to compare (unknown product, unresolved link), 3 service unreachable or rate limited (120 requests per minute; the error says how long to wait).
- Link the full comparison (\`product.url\` in compare results) when you answer the seller. Do not invent figures the output does not contain.
`;
