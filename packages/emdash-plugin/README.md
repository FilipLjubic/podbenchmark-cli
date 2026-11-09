# POD Benchmark for EmDash

Ask your site's AI agent what a print-on-demand product costs at each supplier. [POD Benchmark](https://podbenchmark.com) compares the same product across Printify, Printful, Gelato, Prodigi, CustomCat, Fourthwall, Inkthreadable, Apliiq, Artelo and merchOne. For each one you get product cost, shipping, the delivered total and the delivery estimate, for buyers in the US, UK, Germany, Canada and Australia.

Once the tools are on, you can ask your agent things like:

- "Which supplier is cheapest for a black Bella+Canvas 3001 in size M, shipped to the UK?"
- "I sell this hoodie on Etsy for $45 through Printify. Would another supplier leave me more profit?"
- "Here's a Printful product link. What does the same product cost elsewhere?"

## Tools

| Tool | What it answers |
| --- | --- |
| `search_products` | Find a product by type, brand or model, with a starting delivered price |
| `list_categories` | Browse product categories |
| `get_product` | A product's specs, fabric, fit and similar products |
| `get_product_options` | The sizes, colours and other options you can compare |
| `compare_product` | Every supplier's product cost, shipping, delivered total, delivery time and profit for one option |
| `resolve_supplier_link` | The product behind a supplier link |
| `list_suppliers`, `get_supplier` | How a supplier works: plans and fees, branding, support and refunds, where it prints |
| `get_supplier_prices` | Where a supplier is cheapest, where it costs more, and by how much |
| `supplier_guide` | Suppliers that fit a shop's product type, buyers and platform |

They use the same data as the [POD Benchmark site](https://podbenchmark.com), its [MCP server](https://podbenchmark.com/api/mcp) and its [CLI](https://www.npmjs.com/package/podbenchmark). Prices are refreshed every week.

## Install

1. In your EmDash admin, open **Registry** and search for `@podbenchmark.com/podbenchmark`.
2. Install it. The only permission it asks for is network access to `podbenchmark.com`.
3. Open the plugin's MCP tools, check them and turn them on. Your agent can use them after that.

No account or API key is needed. The plugin reads no content from your site. It sends only the agent's question to `podbenchmark.com`.

## Develop

```sh
bun install
bun run test       # builds, then runs the tests through EmDash's production sandbox
bun run typecheck
```

`src/tools.json` is generated from POD Benchmark's public tool contract (`shared/public-api/tools.ts`) by `bun run generate`. Every `build`, `bundle` and `publish` regenerates it first. Each route forwards its input to `https://podbenchmark.com/api/v1/tools/<name>` and returns the service's JSON unchanged.

Publish a release with `bun run publish` after bumping `version` in `package.json`.
