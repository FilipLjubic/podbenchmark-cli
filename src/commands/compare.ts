import { Effect, Option } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import { z } from "zod";
import { PUBLIC_TOOLS } from "shared/public-api/tools";
import { PUBLIC_SUPPLIER_IDS } from "shared/public-api/common";
import { formatSupplierList } from "shared/runtime/suppliers";
import { choicesFromFlags, dimensionFlags } from "../choices";
import { CliFailure, EXIT, nothingFailure, usageFailure } from "../failure";
import { parseInput } from "../input";
import { renderCompare } from "../render/compare";
import { NPX } from "../render/money";
import { present, readReply, withSession, type Session } from "../session";

const compareOk = PUBLIC_TOOLS.compare_product.outputSchema.options[0];
const resolveOk = PUBLIC_TOOLS.resolve_supplier_link.outputSchema.options[0];
const supplierIds = z.enum(PUBLIC_SUPPLIER_IDS);

const some = (name: string, description: string) =>
  Flag.String(name).pipe(Flag.withDescription(description), Flag.optional);

/** A price typed as 24, 24.50 or $24.50. */
export function parseAmount(flag: string, text: string) {
  const value = Number(text.replace(/^[^\d.-]+/, "").replaceAll(",", ""));
  return Number.isFinite(value)
    ? Effect.succeed(value)
    : Effect.fail(
        usageFailure(`${flag} ${JSON.stringify(text)} is not a number.`)
      );
}

const sellerFlags = {
  option: some(
    "option",
    "An exact option key from `options`, instead of size/color flags."
  ),
  current: some(
    "current",
    "The supplier you use today, so it is pinned first and every row shows the difference."
  ),
  sellFor: some(
    "sell-for",
    "What your customer pays per item, in the chosen currency."
  ),
  on: some("on", "Where you sell: etsy, shopify, woocommerce or tiktok-shop."),
  shopIn: some(
    "shop-in",
    "The country your shop is in (default: the destination)."
  ),
  plan: some("plan", "Pricing plan: base (standard), tier1 or tier2."),
  supplier: some(
    "supplier",
    "Only this supplier, with each of its products and print providers."
  ),
  margin: some(
    "margin",
    "The share of each sale, in percent, you want to keep."
  ),
};

const productArgument = Argument.String("product").pipe(
  Argument.withDescription(
    `A product id from \`search\`, or a supplier product link (${formatSupplierList("or")}).`
  )
);

interface CompareConfig {
  product: string;
  choice: Readonly<Record<string, Option.Option<string>>>;
  option: Option.Option<string>;
  current: Option.Option<string>;
  sellFor: Option.Option<string>;
  on: Option.Option<string>;
  shopIn: Option.Option<string>;
  plan: Option.Option<string>;
  supplier: Option.Option<string>;
  margin: Option.Option<string>;
  similar: boolean;
}

const isLink = (text: string) => /^https?:\/\//i.test(text);

/** Turns a pasted supplier link into the product, its choices and the supplier. */
const resolveLink = (session: Session, url: string) =>
  Effect.gen(function* () {
    const input = yield* parseInput(
      PUBLIC_TOOLS.resolve_supplier_link.inputSchema,
      { url }
    );
    const reply = yield* session.api.call("resolve_supplier_link", input);
    const data = yield* readReply(resolveOk, reply);
    const [match, ...others] = data.matches;
    if (data.status === "resolved" && match && others.length === 0) {
      return {
        productId: match.canonicalProductId,
        choices: match.choices,
        supplier: supplierIds.safeParse(match.supplierId).data,
      };
    }
    const details =
      data.status === "ambiguous"
        ? data.matches.map(
            candidate =>
              `  ${candidate.canonicalProductId}  ${candidate.name} (${candidate.supplierId})`
          )
        : [];
    return yield* nothingFailure(data.message, {
      hint:
        data.status === "ambiguous"
          ? `Pick one and run: ${NPX} compare <id>`
          : undefined,
      details,
      body: reply,
    });
  });

function compareProgram(
  session: Session,
  config: CompareConfig,
  priceMode: boolean
) {
  return Effect.gen(function* () {
    const settings = yield* session.settings({
      current: Option.getOrUndefined(config.current),
      on: Option.getOrUndefined(config.on),
      shopIn: Option.getOrUndefined(config.shopIn),
    });
    const link = isLink(config.product)
      ? yield* resolveLink(session, config.product)
      : null;
    const option = Option.getOrUndefined(config.option);
    const explicit = choicesFromFlags(config.choice);
    if (option !== undefined && Object.keys(explicit).length > 0) {
      return yield* usageFailure(
        "Choose with --option or with field flags such as --size, not both.",
        `Example: ${NPX} compare ${config.product} --size m --color black`
      );
    }
    const choices =
      option !== undefined ? {} : { ...link?.choices, ...explicit };

    const sellFor = Option.isSome(config.sellFor)
      ? yield* parseAmount("--sell-for", config.sellFor.value)
      : undefined;
    const margin = Option.isSome(config.margin)
      ? yield* parseAmount("--margin", config.margin.value)
      : undefined;
    if (priceMode && margin === undefined) {
      return yield* usageFailure(
        "price needs --margin, the share of each sale you want to keep.",
        `Example: ${NPX} price ${config.product} --margin 30 --on etsy`
      );
    }
    const hasPrice = sellFor !== undefined || margin !== undefined;
    // The link's own supplier is the most specific answer to "who do you use now".
    const yourSupplier = Option.isSome(config.current)
      ? settings.values.current
      : (link?.supplier ?? settings.values.current);
    const input = yield* parseInput(PUBLIC_TOOLS.compare_product.inputSchema, {
      canonicalProductId: link?.productId ?? config.product,
      destination: session.destination,
      currency: session.currency,
      optionKey: option,
      choices: Object.keys(choices).length > 0 ? choices : undefined,
      pricingTier: Option.getOrUndefined(config.plan),
      supplier: Option.getOrUndefined(config.supplier)?.toLowerCase(),
      yourSupplier,
      sellingPrice: sellFor,
      targetMargin: margin,
      salesChannel: hasPrice ? settings.values.on : undefined,
      shopLocation: hasPrice
        ? (settings.values.shopIn ??
          (settings.values.on ? session.destination : undefined))
        : undefined,
    });
    const reply = yield* session.api.call("compare_product", input);
    yield* present(session, reply, compareOk, data =>
      renderCompare(session, data, {
        similar: config.similar,
        fromLink: link !== null,
      })
    );
    const data = compareOk.safeParse(reply);
    if (data.success && data.data.suppliers.length === 0) {
      return yield* new CliFailure({ exitCode: EXIT.nothing, message: "" });
    }
  });
}

const baseConfig = {
  product: productArgument,
  choice: dimensionFlags,
  ...sellerFlags,
};

export const compareCommand = Command.make(
  "compare",
  {
    ...baseConfig,
    similar: Flag.Boolean("similar").pipe(
      Flag.withDescription("Also list similar products, shown separately."),
      Flag.withDefault(false)
    ),
  },
  config => withSession(session => compareProgram(session, config, false))
).pipe(
  Command.withDescription(
    "Compare suppliers for one product in one size and color: product cost, shipping, delivered total and delivery time."
  ),
  Command.withExamples([
    {
      command:
        "podbenchmark compare bella-canvas-3001 --size m --color black --to US",
    },
    {
      command:
        "podbenchmark compare bella-canvas-3001 --size m --color black --current printful --sell-for 24 --on etsy",
      description: "See what you keep per sale",
    },
    {
      command:
        "podbenchmark compare https://printify.com/app/products/12/bella-canvas/unisex-jersey-short-sleeve-tee",
      description: "Start from a supplier link",
    },
  ])
);

export const priceCommand = Command.make(
  "price",
  {
    ...baseConfig,
    similar: Flag.Boolean("similar").pipe(
      Flag.withDescription("Also list similar products."),
      Flag.withDefault(false)
    ),
  },
  config => withSession(session => compareProgram(session, config, true))
).pipe(
  Command.withDescription(
    "Find the price to charge with each supplier to keep a target margin after delivered cost and platform fees."
  ),
  Command.withExamples([
    {
      command:
        "podbenchmark price bella-canvas-3001 --size m --color black --margin 30 --on etsy",
    },
  ])
);
