---
name: supplier-by-region
description: Build a print-on-demand seller's supplier table, one supplier per product and region (US, UK, EU, Canada, Australia), from POD Benchmark delivered costs and profit. Use when a seller sells in more than one country and asks which supplier should fulfil each product where, or before setting up order routing.
---

# Supplier per product and region

The cheapest supplier often changes with the destination. A framed poster can be
cheapest from one supplier in the US and from another in the UK and Germany. This
skill turns POD Benchmark's comparisons into one table the seller (or their order
routing) can follow.

Use the `podbenchmark` MCP tools. Without them, the same steps work with the CLI:
`npx podbenchmark search|options|compare ... --to <destination> --json`.

## 1. Collect what the seller already told you

- **Products**: what they sell, with size and colour or frame where it matters.
- **Regions**: where their customers are. POD Benchmark covers `US`, `GB`, `DE`
  (stands in for the EU), `CA` and `AU`. Say so if they sell elsewhere.
- **Selling price, sales channel and shop country** if they gave them. Never guess
  these: without them, rank by delivered cost and say that profit wasn't computed.
- **Their current supplier**, if any.

## 2. For each product

1. `search_products` to get the `canonicalProductId`.
2. `get_product_options` for the exact configuration. Take values from its answer;
   never invent a size, colour or frame.
3. `compare_product` once per region with that `optionKey`, the region as
   `destination`, and the seller's currency. Pass `sellingPrice`, `salesChannel`,
   `shopLocation` and `yourSupplier` only when the seller said them.

## 3. Pick per region

- With a selling price: the winner is the supplier that leaves the most per sale.
  Without one: the lowest delivered total (product + shipping).
- Unknown costs are unknown, never zero, and can't win.
- Estimated or unverified duty can't support a "best profit" claim. Mark such a row
  and name the runner-up whose duty is known.
- If the runner-up is within about 1 unit of the seller's currency, prefer the
  supplier the seller already uses in other regions. Fewer supplier accounts beat
  saving cents.

## 4. Answer

A table per product, one row per region:

| Region | Supplier | Keeps per sale (or delivered cost) | Next best | Gap |
|---|---|---|---|---|

Then one line on what a single supplier everywhere would cost: for the supplier that
wins most regions, the sum of its gaps where it doesn't win.

Finish with the table as a block the seller can save (for example to
`suppliers.yaml`) for their order routing later:

```yaml
checked: 2026-11-16        # the comparison's checked dates, oldest one
currency: USD
products:
  framed-poster-wooden:
    option: size=wall-art%3Adim%3A3048x4064&finish=matte&paperType=poster-paper&color=black
    US: artelo
    GB: gelato
    DE: gelato
```

Link each product's comparison on podbenchmark.com (`product.url`). Prices change.
Suggest re-running this monthly, or when POD Benchmark's prices move.
