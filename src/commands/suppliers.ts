import { Effect, Option } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import {
  PUBLIC_TOOLS,
  SUPPLIER_GUIDE_PRODUCT_TYPES,
} from "shared/public-api/tools";
import { usageFailure } from "../failure";
import { parseInput } from "../input";
import {
  DESTINATION_NAMES,
  NPX,
  UNKNOWN,
  readableDay,
  money,
  supplierName,
} from "../render/money";
import { renderTable } from "../render/table";
import { present, withSession, type Session } from "../session";
import { z } from "zod";

const suppliersOk = PUBLIC_TOOLS.list_suppliers.outputSchema.options[0];
const supplierOk = PUBLIC_TOOLS.get_supplier.outputSchema.options[0];
const pricesOk = PUBLIC_TOOLS.get_supplier_prices.outputSchema.options[0];
const guideOk = PUBLIC_TOOLS.supplier_guide.outputSchema.options[0];

const some = (name: string, description: string) =>
  Flag.String(name).pipe(Flag.withDescription(description), Flag.optional);

export const suppliersCommand = Command.make(
  "suppliers",
  {
    words: Argument.String("words").pipe(
      Argument.withDescription("Words to find a supplier."),
      Argument.variadic()
    ),
  },
  config =>
    withSession(session =>
      Effect.gen(function* () {
        const input = yield* parseInput(
          PUBLIC_TOOLS.list_suppliers.inputSchema,
          {
            query: config.words.join(" "),
            limit: session.globals.limit,
            offset: session.globals.offset,
          }
        );
        const reply = yield* session.api.call("list_suppliers", input);
        yield* present(session, reply, suppliersOk, data => {
          const { style } = session;
          if (data.suppliers.length === 0)
            return "No supplier matches those words.";
          return [
            style.bold(`Suppliers · ${data.totalCount}`),
            "",
            renderTable(
              [
                { header: "ID" },
                { header: "NAME" },
                { header: "TYPE" },
                { header: "WEBSITE" },
              ],
              data.suppliers.map(supplier => ({
                cells: [
                  supplier.id,
                  supplier.name,
                  supplier.type ?? UNKNOWN,
                  supplier.website,
                ],
              })),
              style.dim
            ),
            "",
            style.dim(
              `next: ${NPX} supplier ${data.suppliers[0]?.id ?? "printful"}`
            ),
          ].join("\n");
        });
      })
    )
).pipe(Command.withDescription("List the suppliers POD Benchmark compares."));

/** `1` is $1 (in the chosen currency); `5%` is five percent. */
function parseWithin(text: string) {
  const match = /^\s*(\d+(?:\.\d+)?)\s*(%?)\s*$/.exec(text);
  if (!match) {
    return Effect.fail(
      usageFailure(
        `--within ${JSON.stringify(text)} is not an amount.`,
        "Use 1 for one dollar, or 5% for five percent."
      )
    );
  }
  const value = Number(match[1]);
  return Effect.succeed(
    match[2] === "%"
      ? ({ kind: "percent", percent: value } as const)
      : ({ kind: "amount", amount: value } as const)
  );
}

export const supplierCommand = Command.make(
  "supplier",
  {
    supplier: Argument.String("supplier").pipe(
      Argument.withDescription(
        "printify, printful, gelato, prodigi, customcat or fourthwall."
      )
    ),
    facts: Flag.Boolean("facts").pipe(
      Flag.withDescription(
        "Plans, fees, branding and who handles what (the default)."
      ),
      Flag.withDefault(false)
    ),
    locations: Flag.Boolean("locations").pipe(
      Flag.withDescription("Where it reports printing."),
      Flag.withDefault(false)
    ),
    providers: Flag.Boolean("providers").pipe(
      Flag.withDescription("A marketplace's print providers."),
      Flag.withDefault(false)
    ),
    country: some(
      "country",
      "Only production locations in this country, such as US."
    ),
    provider: some("provider", "Only this print provider."),
    prices: Flag.Boolean("prices").pipe(
      Flag.withDescription(
        "Show where this supplier is cheapest instead of its facts."
      ),
      Flag.withDefault(false)
    ),
    vs: some("vs", "With --prices: compare against this one supplier."),
    category: some("category", "With --prices: only this category."),
    within: some(
      "within",
      "With --prices: what counts as near-cheapest: 1 or 5%."
    ),
    search: some(
      "search",
      "With --prices: only products matching these words."
    ),
    plan: some("plan", "With --prices: base, tier1 or tier2."),
  },
  config =>
    withSession(session =>
      config.prices
        ? pricesProgram(session, config)
        : factsProgram(session, config)
    )
).pipe(
  Command.withDescription(
    "How a supplier works (plans, fees, branding, where it prints), or with --prices where it is cheapest."
  ),
  Command.withExamples([
    { command: "podbenchmark supplier printful" },
    { command: "podbenchmark supplier printify --locations --country US" },
    { command: "podbenchmark supplier printify --prices --vs printful" },
  ])
);

interface SupplierConfig {
  supplier: string;
  facts: boolean;
  locations: boolean;
  providers: boolean;
  country: Option.Option<string>;
  provider: Option.Option<string>;
  vs: Option.Option<string>;
  category: Option.Option<string>;
  within: Option.Option<string>;
  search: Option.Option<string>;
  plan: Option.Option<string>;
}

function factsProgram(session: Session, config: SupplierConfig) {
  return Effect.gen(function* () {
    const include = [
      ...(config.facts || (!config.locations && !config.providers)
        ? ["facts"]
        : []),
      ...(config.locations ? ["locations"] : []),
      ...(config.providers ? ["providers"] : []),
    ];
    const input = yield* parseInput(PUBLIC_TOOLS.get_supplier.inputSchema, {
      supplierId: config.supplier.toLowerCase(),
      include,
      country: Option.getOrUndefined(config.country)?.toUpperCase(),
      provider: Option.getOrUndefined(config.provider),
      limit: session.globals.limit,
      offset: session.globals.offset,
    });
    const reply = yield* session.api.call("get_supplier", input);
    yield* present(session, reply, supplierOk, data =>
      renderSupplier(session, data)
    );
  });
}

type SupplierOutput = z.output<typeof supplierOk>;

function renderSupplier(session: Session, data: SupplierOutput) {
  const { style } = session;
  const lines = [
    style.bold(
      [data.supplier.name, data.supplier.type, data.supplier.website]
        .filter(Boolean)
        .join(" · ")
    ),
  ];
  if (data.introduction) lines.push("", data.introduction);
  if (data.activeListingCount !== null) {
    lines.push("", `Active listings  ${data.activeListingCount}`);
  }
  if (data.summary.length > 0 && data.facts) {
    lines.push("");
    const width = Math.max(...data.summary.map(item => item.label.length));
    for (const item of data.summary) {
      lines.push(
        `${style.cyan(item.label.padEnd(width))}  ${item.value}${item.detail ? style.dim(` · ${item.detail}`) : ""}`
      );
    }
  }
  if (data.facts) {
    lines.push(
      "",
      style.bold(
        `Facts (${data.facts.items.length} of ${data.facts.totalCount})`
      )
    );
    for (const fact of data.facts.items) {
      const checked = readableDay(fact.verifiedAt);
      lines.push(
        `• ${fact.title}${(fact.summary ?? fact.detail) ? ` — ${fact.summary ?? fact.detail}` : ""}`,
        style.dim(
          `  ${fact.status}${checked ? ` · verified ${checked}` : ""}${fact.sources[0] ? ` · ${fact.sources[0].url}` : ""}`
        )
      );
    }
    if (data.facts.nextOffset !== null) {
      lines.push(style.dim(`More facts: --offset ${data.facts.nextOffset}`));
    }
  }
  if (data.locations) {
    const checked = readableDay(data.locations.checkedAt);
    lines.push(
      "",
      style.bold(
        `Where it reports printing (${data.locations.totalCount}${checked ? `, checked ${checked}` : ""})`
      ),
      data.locations.countries
        .map(country => `${country.countryName} ${country.locationCount}`)
        .join(" · ")
    );
    for (const place of data.locations.items) {
      lines.push(
        `  ${place.label}, ${place.countryCode}${place.provider ? style.dim(` · ${place.provider}`) : ""}`
      );
    }
    if (data.locations.nextOffset !== null) {
      lines.push(style.dim(`More: --offset ${data.locations.nextOffset}`));
    }
  }
  if (data.providers) {
    lines.push(
      "",
      style.bold(`Print providers (${data.providers.totalCount})`)
    );
    for (const provider of data.providers.items)
      lines.push(`  ${provider.name}  ${style.dim(`--provider ${provider.id}`)}`);
    if (data.providers.nextOffset !== null) {
      lines.push(style.dim(`More: --offset ${data.providers.nextOffset}`));
    }
  }
  lines.push(
    "",
    style.dim(`next: ${NPX} supplier ${data.supplier.id} --prices`)
  );
  return lines.join("\n");
}

function pricesProgram(session: Session, config: SupplierConfig) {
  return Effect.gen(function* () {
    const within = Option.isSome(config.within)
      ? yield* parseWithin(config.within.value)
      : undefined;
    const input = yield* parseInput(
      PUBLIC_TOOLS.get_supplier_prices.inputSchema,
      {
        supplierId: config.supplier.toLowerCase(),
        versus: Option.getOrUndefined(config.vs)?.toLowerCase(),
        category: Option.getOrUndefined(config.category),
        search: Option.getOrUndefined(config.search),
        within,
        pricingTier: Option.getOrUndefined(config.plan),
        destination: session.destination,
        currency: session.currency,
        limit: session.globals.limit,
        offset: session.globals.offset,
      }
    );
    const reply = yield* session.api.call("get_supplier_prices", input);
    yield* present(session, reply, pricesOk, data => {
      const { style } = session;
      const name = supplierName(config.supplier);
      const vs = Option.getOrUndefined(config.vs);
      const against = vs ? supplierName(vs) : "other suppliers";
      if (data.status === "unavailable" || !data.overview) {
        return "Price comparison is not available for this supplier right now.";
      }
      const tally = data.overview;
      const checked = readableDay(data.checkedAt);
      const lines = [
        style.bold(
          `${name} vs ${against} · delivered to ${DESTINATION_NAMES[data.destination]} in ${data.currency}${checked ? ` · checked ${checked}` : ""}`
        ),
        "",
        `Compared ${tally.compared} products at their usual size and color.`,
        `Cheapest for ${tally.cheapest}, tied on ${tally.tied}, cheaper elsewhere on ${tally.cheaperElsewhere}, within reach of the cheapest on ${tally.nearCheapest}.`,
        `Typical gap when cheapest ${money(tally.medianWinningGap, data.currency)}; typical gap when not ${money(tally.medianLosingGap, data.currency)}.`,
      ];
      if (data.categories.length > 0) {
        lines.push(
          "",
          renderTable(
            [
              { header: "CATEGORY", maxWidth: 28 },
              { header: "COMPARED", align: "right" },
              { header: "CHEAPEST", align: "right" },
              { header: "ELSEWHERE", align: "right" },
              { header: "NEAR", align: "right" },
            ],
            data.categories.map(category => ({
              cells: [
                category.name,
                String(category.compared),
                String(category.cheapest),
                String(category.cheaperElsewhere),
                String(category.nearCheapest),
              ],
            })),
            style.dim
          )
        );
      }
      const productTable = (title: string, list: typeof data.cheapest) => {
        if (list.items.length === 0) return [];
        return [
          "",
          style.bold(`${title} (${list.items.length} of ${list.totalCount})`),
          renderTable(
            [
              { header: "ID", maxWidth: 30 },
              { header: "DELIVERED", align: "right" },
              { header: "NEXT BEST", align: "right" },
              { header: "GAP", align: "right" },
              { header: "SUPPLIER" },
            ],
            list.items.map(item => ({
              cells: [
                item.canonicalProductId,
                money(item.delivered, data.currency),
                money(item.otherDelivered, data.currency),
                money(item.gap, data.currency),
                item.otherSupplier ?? UNKNOWN,
              ],
            })),
            style.dim
          ),
        ];
      };
      lines.push(...productTable("Where it is cheapest", data.cheapest));
      lines.push(...productTable("Where it costs more", data.cheaperElsewhere));
      return lines.join("\n");
    });
  });
}

export const guideCommand = Command.make(
  "guide",
  {
    type: Argument.String("product-type").pipe(
      Argument.withDescription(
        `One of ${SUPPLIER_GUIDE_PRODUCT_TYPES.join(", ")}.`
      )
    ),
    on: some(
      "on",
      "Where you sell: etsy, shopify, woocommerce or tiktok-shop."
    ),
    shopIn: some("shop-in", "The country your shop is in."),
    branding: Flag.Boolean("branding").pipe(
      Flag.withDescription(
        "You need custom branding (packaging, inserts, labels)."
      ),
      Flag.withDefault(false)
    ),
    freeStart: Flag.Boolean("free-start").pipe(
      Flag.withDescription("You want to start without a monthly fee."),
      Flag.withDefault(false)
    ),
    chooseProvider: Flag.Boolean("choose-provider").pipe(
      Flag.withDescription("You want to choose your own print provider."),
      Flag.withDefault(false)
    ),
  },
  config =>
    withSession(session =>
      Effect.gen(function* () {
        const settings = yield* session.settings({
          on: Option.getOrUndefined(config.on),
          shopIn: Option.getOrUndefined(config.shopIn),
        });
        const input = yield* parseInput(
          PUBLIC_TOOLS.supplier_guide.inputSchema,
          {
            productType: config.type.toLowerCase(),
            destination: session.destination,
            salesChannel: settings.values.on,
            shopLocation: settings.values.shopIn,
            needsCustomBranding: config.branding,
            wantsFreeStart: config.freeStart,
            wantsToChooseProvider: config.chooseProvider,
            limit: session.globals.limit,
            offset: session.globals.offset,
          }
        );
        const reply = yield* session.api.call("supplier_guide", input);
        yield* present(session, reply, guideOk, data =>
          renderGuide(session, data)
        );
      })
    )
).pipe(
  Command.withDescription(
    "Which suppliers fit your shop for a product type, with dated reasons for each."
  ),
  Command.withExamples([
    { command: "podbenchmark guide mugs --on etsy" },
    { command: "podbenchmark guide t-shirts --on shopify --branding --to GB" },
  ])
);

type GuideOutput = z.output<typeof guideOk>;

const MARKS: Readonly<Record<string, string>> = {
  met: "✓",
  qualified: "~",
  blocked: "✗",
};

function renderGuide(session: Session, data: GuideOutput) {
  const { style } = session;
  const lines = [
    style.bold(
      `Suppliers for ${data.productType} · delivered to ${DESTINATION_NAMES[data.destination]}`
    ),
  ];
  if (data.exampleProduct) {
    const range = data.deliveredRange;
    lines.push(
      `Example: ${data.exampleProduct.name}${data.exampleProduct.option ? ` (${data.exampleProduct.option})` : ""}${
        range
          ? ` · ${money(range.minimum, range.currency)}–${money(range.maximum, range.currency)} delivered across suppliers`
          : ""
      }`
    );
  }
  const section = (
    title: string,
    list: typeof data.fits,
    paint: (text: string) => string
  ) => {
    if (list.items.length === 0) return;
    lines.push("", paint(`${title} (${list.totalCount})`));
    for (const supplier of list.items) {
      lines.push(`  ${style.bold(supplier.name)}`);
      for (const reason of supplier.reasons) {
        const checked = readableDay(reason.checkedAt);
        lines.push(
          `    ${MARKS[reason.status] ?? "?"} ${reason.label}`,
          style.dim(
            `      ${reason.detail}${checked ? ` (checked ${checked}` : " ("}${reason.source ? `${checked ? ", " : ""}${reason.source.label}` : ""})`
          )
        );
      }
    }
  };
  section("Fits", data.fits, style.green);
  section("Needs a check", data.needsCheck, style.yellow);
  section("Does not fit", data.doesNotFit, style.red);
  lines.push(
    "",
    style.dim(
      `next: ${NPX} compare ${data.exampleProduct?.canonicalProductId ?? "<product>"} --to ${data.destination}`
    )
  );
  return lines.join("\n");
}
