# podbenchmark

Compare the same print-on-demand product across suppliers from your terminal: product cost, shipping, delivered total and delivery time for Printify, Printful, Gelato, Prodigi, CustomCat, Fourthwall and Inkthreadable. Built for sellers, developers and AI agents.

```sh
npx podbenchmark compare bella-canvas-3001 --size m --color black --to US
```

Prices come from [POD Benchmark](https://podbenchmark.com), which checks each supplier's price and shipping for the destination you pick. Full interactive comparison: <https://podbenchmark.com>.

## Install

```sh
npx podbenchmark          # run without installing
npm i -g podbenchmark     # or install the `podbenchmark` command
```

Needs Node.js 22 or newer. No other dependencies.

## Find a product, pick a size and color, compare

Three steps. Each step prints what to run next.

```sh
$ podbenchmark search "bella canvas 3001"

Products for “bella canvas 3001” · 138 found · delivered to the US in USD

ID                    PRODUCT                                             FROM  SUPPLIERS
bella-canvas-3001     Bella+Canvas 3001 Unisex Jersey Short Sleeve Tee  $15.38     6 of 6
bella-canvas-3001u    Bella+Canvas 3001U USA-Made Unisex Jersey Tee     $23.54     1 of 1
bella-canvas-3001rcy  Bella+Canvas 3001RCY Unisex Recycled Organic Tee  $22.95     1 of 1
FROM is the lowest delivered price (product + shipping) for the usual size and color. Compare a specific one with `compare`.

next: npx podbenchmark options bella-canvas-3001
```

`options` lists the sizes, colors and other choices a product comes in. Add words or flags to narrow the list:

```sh
$ podbenchmark options bella-canvas-3001 m black

bella-canvas-3001 · choices for the US in USD · 5 matching combinations

size    m
color   black, black-heather, oxblood-black, solid-black-blend, vintage-black

Opens on  Adult M · Black

SIZE  COLOR              SUPPLIERS
m     black                      6
m     black-heather              4
m     oxblood-black              3
m     solid-black-blend          1
m     vintage-black              5

next: npx podbenchmark compare bella-canvas-3001 --size m --color black --to US
```

```sh
$ podbenchmark compare bella-canvas-3001 --size m --color black --to US

Bella+Canvas 3001 · Adult M · Black · delivered to the US in USD

SUPPLIER                      PRODUCT                   SHIPPING  PRODUCT + SHIPPING  ARRIVES   VS CHEAPEST
Gelato                        Premium Unisex Crewneck…     $4.99     $15.68  4–6 days     cheapest
Fourthwall                    Bella+Canvas Unisex Sup…     $4.29     $16.04  6–8 days       +$0.36
Printify via Printify Choice  Unisex Jersey Short Sle…     $4.95     $16.24  3–7 days       +$0.56
CustomCat                     Bella + Canvas Unisex J…     $4.99     $16.46  3–9 days       +$0.78
Printful                      Unisex Staple T-Shirt |…     $4.69     $16.61  6–9 days       +$0.93
Prodigi                       Bella+Canvas 3001           $10.75     $22.75  3–8 days       +$7.07

Product + shipping excludes duty and sales tax; duty is shown separately.
Prices checked 2026-09-30 to 2026-10-21.

Full comparison  https://podbenchmark.com/t-shirts/bella-canvas-3001?destination=US&currency=USD&configuration=size%3Dapparel%253Aadult%253Am%26color%3Dblack
```

Every picker on the site has a flag with the same name: `--size`, `--color`, `--capacity`, `--page-count`, `--device-fit`… (`podbenchmark compare --help` lists them all). `--option <key>` takes an exact key from `options --json`.

Start from a supplier link instead of an id. The CLI finds the product, the color the link selects, and treats that supplier as yours:

```sh
podbenchmark compare https://printify.com/app/products/12/bella-canvas/unisex-jersey-short-sleeve-tee
```

Use the product page's own address, as you'd copy it from the supplier's catalog; tracking parameters such as `utm_…` are fine, and a Fourthwall `selectedColor` picks the color. Links with other options selected, editor links and referral paths aren't matched yet: open the plain product page and copy that, or pass the product id with `--current <supplier>`.

Other destinations and currencies:

```sh
podbenchmark compare bella-canvas-3001 --size m --color black --to GB             # prices in GBP
podbenchmark compare bella-canvas-3001 --size m --color black --to DE --currency USD
```

Destinations: `US`, `GB`, `DE`, `CA`, `AU`. Currencies: `USD`, `EUR`, `GBP`, `CAD`, `AUD`. The currency defaults to the destination's own.

## What you keep per sale

Say who you use today, what you charge and where you sell. The table switches to what you keep after product + shipping, deducted duty and platform fees, with your current supplier first:

```sh
$ podbenchmark compare bella-canvas-3001 --size m --color black \
    --current printful --sell-for 24 --on etsy

Bella+Canvas 3001 · Adult M · Black · delivered to the US in USD
selling at $24.00 on Etsy · your supplier: Printful

SUPPLIER                      PRODUCT + SHIPPING  YOU KEEP  VS PRINTFUL
Printful (yours)                 $16.61     $4.86        yours
──────────────────────────────────────────────────────────────────────────
Gelato                           $15.68     $5.79       +$0.93  keeps most
Fourthwall                       $16.04     $5.43       +$0.57
Printify via Printify Choice     $16.24     $5.23       +$0.37
CustomCat                        $16.46     $5.01       +$0.15
Prodigi                          $22.75    -$1.28       -$6.14

You keep = $24.00 − (product + shipping) − deducted duty − $2.53 Etsy fees (Transaction fee $1.56 + Etsy Payments percentage $0.72 + Etsy Payments fixed charge $0.25). Before tax.
Etsy fees checked 2026-08-19.
Product + shipping excludes duty and sales tax; duty is shown separately.
Prices checked 2026-09-30 to 2026-10-21.
```

| Flag | Meaning |
| --- | --- |
| `--current <supplier>` | The supplier you use now: `printify`, `printful`, `gelato`, `prodigi`, `customcat` or `fourthwall`. |
| `--sell-for <price>` | What your customer pays per item, in the chosen currency. |
| `--on <channel>` | `etsy`, `shopify`, `woocommerce` or `tiktok-shop`. |
| `--shop-in <country>` | The country your shop is in. Defaults to the destination when you give a price and a channel. |
| `--plan <plan>` | `base` (standard prices, the default), `tier1` or `tier2` (paid plans). |
| `--supplier <supplier>` | Only that supplier, with each of its products and print providers as extra rows. |
| `--similar` | Also list similar products, shown separately because they are not the same blank. |

### The price to charge

`price` turns it around: give the share of each sale you want to keep and see what to charge with each supplier.

```sh
$ podbenchmark price bella-canvas-3001 --size m --color black --margin 30 --on etsy --current printful

SUPPLIER                      PRODUCT + SHIPPING   FEES  CHARGE  YOU KEEP  VS PRINTFUL
Printful (yours)                 $16.61  $2.91  $28.00     $8.48        yours
───────────────────────────────────────────────────────────────────────────────────
Gelato                           $15.68  $2.77  $26.50     $8.05       -$1.50  lowest price
Fourthwall                       $16.04  $2.82  $27.00     $8.14       -$1.00
Printify via Printify Choice     $16.24  $2.87  $27.50     $8.39       -$0.50
CustomCat                        $16.46  $2.91  $28.00     $8.63        $0.00
Prodigi                          $22.75  $3.91  $38.50    $11.84      +$10.50

Charge = the price that leaves you 30% of the sale after product + shipping, deducted duty and Etsy fees. Before tax.
```

## Suppliers and guides

```sh
podbenchmark suppliers                                  # the seven suppliers compared
podbenchmark supplier printful                          # plans, fees, branding, who handles support and refunds
podbenchmark supplier printify --locations --country US # where it reports printing
podbenchmark supplier printify --providers              # a marketplace's print providers
podbenchmark supplier printify --prices --vs printful   # how many products each is cheapest for, and by how much
podbenchmark guide mugs --on etsy                       # which suppliers fit your shop, with dated reasons
```

`guide` takes `t-shirts`, `hoodies`, `mugs`, `wall-art`, `stickers` or `phone-cases`, plus `--branding`, `--free-start` and `--choose-provider`. `supplier --prices` takes `--category`, `--within 1` (or `5%`) for what counts as near-cheapest, `--search` and `--plan`.

Also: `podbenchmark categories [words]`, `podbenchmark product <id>` (specs, print methods, similar products), and `--facets` on `search` to count brands, suppliers, audiences and specs in the results. Filter `search` with `--category`, `--brand`, `--supplier`, `--for` (unisex, mens, womens, kids), `--fit`, `--material`, `--eco`, `--neckline`, `--sleeve`, `--construction`, `--label`, `--capacity`, `--fabric`, `--weight 4-8`, `--priced` and `--sort cheapest|priciest|most-suppliers|name`. Repeat a filter flag to accept several values.

Every list command takes `--limit` and `--offset`.

## Defaults

Save what you would otherwise repeat on every command:

```sh
podbenchmark config set --to GB --current printful --on etsy --shop-in GB
podbenchmark config show
podbenchmark config reset
```

Precedence, highest first: flag, environment variable, saved config, built-in default.

| Setting | Flag | Environment variable |
| --- | --- | --- |
| Destination | `--to` | `PODBENCHMARK_TO` |
| Currency | `--currency` | `PODBENCHMARK_CURRENCY` |
| Your supplier | `--current` | `PODBENCHMARK_CURRENT` |
| Sales channel | `--on` | `PODBENCHMARK_ON` |
| Shop country | `--shop-in` | `PODBENCHMARK_SHOP_IN` |

The config is a small JSON file at `$XDG_CONFIG_HOME/podbenchmark/config.json` (default `~/.config/podbenchmark/config.json`). `PODBENCHMARK_API_URL` points the CLI at a different server.

## For scripts and AI agents

Output is a table when you are at a terminal. It is JSON, exactly as the service returns it, when:

- you pass `--json`,
- stdout is not a terminal (a pipe or a file), or
- an agent harness is detected (Claude Code, Codex, Cursor, OpenCode, Gemini CLI, Amp, Augment, Qwen Code, Pi, Copilot, Warp, or `AI_AGENT=<name>`).

`--table` forces the tables back. When an agent is detected the CLI also sends its name in an `X-Podbenchmark-Agent` header so usage by agents can be counted; it sends `X-Podbenchmark-Client: cli/<version>` always, and nothing else about you.

```sh
podbenchmark compare bella-canvas-3001 --size m --color black --json | jq '.suppliers[].offer | {supplier, delivered}'
podbenchmark compare bella-canvas-3001 --schema        # exact input and output fields, as JSON Schema; no request
podbenchmark compare bella-canvas-3001 --size m --dry-run   # the request that would be sent; no request
```

In JSON, a missing price is `null`, never `0`. Treat `null` as unknown.

### Teach your agent

```sh
podbenchmark skills add                    # the agent you are in, else every one installed here
podbenchmark skills add --agent claude     # claude, codex, opencode, cursor or all
podbenchmark skills add --agent all --project   # write into this repository instead of your home folder
```

This writes a `podbenchmark` skill (a `SKILL.md`) to each agent's skills folder and prints every path:

| Agent | Personal | With `--project` |
| --- | --- | --- |
| Claude Code | `~/.claude/skills/podbenchmark/` | `.claude/skills/podbenchmark/` |
| Codex | `~/.agents/skills/podbenchmark/` | `.agents/skills/podbenchmark/` |
| OpenCode | `~/.config/opencode/skills/podbenchmark/` | `.opencode/skills/podbenchmark/` |
| Cursor | `~/.cursor/skills/podbenchmark/` | `.cursor/skills/podbenchmark/` |

Running it again updates the file. It never replaces a `SKILL.md` that it did not write unless you pass `--force`.

No skill folder? Paste this into your agent instead:

> Use `npx podbenchmark` to compare print-on-demand supplier prices. Flow: `search <words> --json` to find a product id, `options <id> --json` to see the exact size and color values (never guess them), then `compare <id> --size <value> --color <value> --to <US|GB|DE|CA|AU> --json`. Add `--current <supplier> --sell-for <price> --on <etsy|shopify|woocommerce|tiktok-shop>` only when the seller said so. `null` means unknown, never 0. Link `product.url` from the result when you answer. `--schema` shows every field.

### Use it as an MCP server

The same tools are available to MCP clients over streamable HTTP at `https://podbenchmark.com/api/mcp`, with no key or sign-in:

```json
{
  "mcpServers": {
    "podbenchmark": {
      "type": "streamable-http",
      "url": "https://podbenchmark.com/api/mcp"
    }
  }
}
```

Claude Code: `claude mcp add --transport http podbenchmark https://podbenchmark.com/api/mcp`. Codex: `codex mcp add podbenchmark --url https://podbenchmark.com/api/mcp`.

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Success. Unknown prices still exit 0; they show as `—` (or `null` in JSON). |
| `1` | Bad command, flags or option values (for example `--to FR`, or a size the product does not come in; the error lists the valid ones). |
| `2` | Nothing to compare: unknown product, a supplier link that could not be matched, or no supplier offers. |
| `3` | The service could not be reached, did not answer within 30 seconds, is unavailable, or rate-limited you (the message says how long to wait). |

With `--json` (or when piped), failures print the error as JSON on stdout (`{"ok": false, "error": {"code", "message", "retryable"}}`) and use the same exit codes. If the service cannot be reached at all, the code is `network`. The CLI retries once, after a short pause, on a network error or a 5xx answer, and never retries a 4xx.

## About the numbers

- Prices are supplier quotes checked on the dates shown (`Prices checked …`), in the destination's currency, before sales tax. Delivered is product plus shipping. Supplier-billed duty is separate: an established amount (including zero), one labelled estimate, or unverified. Profit deducts established duty or a converted estimate and retains its qualification. Estimated/unverified duty and conditional design/setup prices do not establish a best-profit winner or gap, including in target-margin mode.
- A price we do not have shows as `—`. It is never counted as zero and never as the cheapest.
- Printify is a marketplace: each row shows the print provider it would route the order to ("via Printify Choice"). Use `--supplier printify` to see every provider.
- A product a supplier does not list for your destination or size is not in the table.
- Profit figures use platform fee research with its check date (`Etsy fees checked …`), as an estimate before tax.
- Tables link only to POD Benchmark's own pages. In JSON, an offer's `actionUrl` can carry an affiliate reference (see `affiliateDisclosure`); it never changes a price or a ranking.
- Rate limit: 120 requests per minute per IP address. When you hit it the CLI tells you how many seconds to wait.

## Links

- Website and full comparison: <https://podbenchmark.com>
- This tool's page: <https://podbenchmark.com/tools/cli>
- MCP endpoint for AI assistants: <https://podbenchmark.com/api/mcp>
- Source code: <https://github.com/FilipLjubic/podbenchmark-cli>
- Questions or corrections: <https://podbenchmark.com/about>

MIT licensed.
