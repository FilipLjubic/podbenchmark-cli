import { Effect, Option } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import { PUBLIC_TOOLS, SEARCH_SORTS } from "shared/public-api/tools";
import { usageFailure } from "../failure";
import { parseInput } from "../input";
import { renderTable, wrapList } from "../render/table";
import { DESTINATION_NAMES, UNKNOWN, money } from "../render/money";
import { NPX } from "../render/money";
import { present, withSession, type Session } from "../session";

const repeated = (name: string, description: string) =>
  Flag.String(name).pipe(Flag.withDescription(description), Flag.atLeast(0));
const some = (name: string, description: string) =>
  Flag.String(name).pipe(Flag.withDescription(description), Flag.optional);

/** `4-8`, `4-` or `-8` (ounces) as a minimum and maximum. */
export function parseWeightRange(text: string) {
  const match = /^\s*(\d+(?:\.\d+)?)?\s*(-)?\s*(\d+(?:\.\d+)?)?\s*$/.exec(text);
  const [, low, dash, high] = match ?? [];
  if (!match || (low === undefined && high === undefined)) {
    return Effect.fail(
      usageFailure(
        `--weight ${JSON.stringify(text)} is not a range in ounces.`,
        "Use 4-8, 4- (at least 4) or -8 (at most 8); write --weight=-8 to start with a dash."
      )
    );
  }
  if (dash === undefined) {
    return Effect.succeed({
      minWeightOz: Number(low),
      maxWeightOz: Number(low),
    });
  }
  return Effect.succeed({
    ...(low === undefined ? {} : { minWeightOz: Number(low) }),
    ...(high === undefined ? {} : { maxWeightOz: Number(high) }),
  });
}

const searchFlags = {
  words: Argument.String("words").pipe(
    Argument.withDescription(
      "Product type, brand or model, such as hoodie or bella canvas 3001."
    ),
    Argument.variadic()
  ),
  category: some(
    "category",
    "Only this category (see `podbenchmark categories`)."
  ),
  brand: repeated("brand", "Only this brand; repeat for several."),
  supplier: repeated(
    "supplier",
    "Only products this supplier sells; repeat for several."
  ),
  audience: repeated(
    "for",
    "Who it is for: unisex, mens, womens, kids…; repeat for several."
  ),
  fit: repeated("fit", "Fit, such as classic or relaxed."),
  material: repeated("material", "Material, such as cotton."),
  eco: repeated("eco", "Eco-friendly claims."),
  neckline: repeated("neckline", "Neckline, such as crew."),
  sleeve: repeated("sleeve", "Sleeve length."),
  construction: repeated("construction", "Construction, such as side-seamed."),
  label: repeated("label", "Label type, such as tear-away."),
  capacity: repeated("capacity", "Capacity, such as 11 oz."),
  fabric: repeated("fabric", "Fabric blend, such as 100% cotton."),
  weight: some("weight", "Weight in ounces: 4-8, 4- or -8."),
  priced: Flag.Boolean("priced").pipe(
    Flag.withDescription(
      "Only products with a delivered price for the destination."
    ),
    Flag.withDefault(false)
  ),
  sort: some("sort", `Order: ${SEARCH_SORTS.join(", ")}.`),
  facets: Flag.Boolean("facets").pipe(
    Flag.withDescription(
      "Also count brands, suppliers, audiences and specs in the results."
    ),
    Flag.withDefault(false)
  ),
};

const okSchema = PUBLIC_TOOLS.search_products.outputSchema.options[0];

export const searchCommand = Command.make("search", searchFlags, config =>
  withSession(session =>
    Effect.gen(function* () {
      // Each flag filters one catalog spec field.
      const specGroups: ReadonlyArray<readonly [string, readonly string[]]> = [
        ["fit", config.fit],
        ["material", config.material],
        ["ecoFriendly", config.eco],
        ["neckline", config.neckline],
        ["sleeve", config.sleeve],
        ["construction", config.construction],
        ["labelType", config.label],
        ["capacity", config.capacity],
        ["fabricBlendCategory", config.fabric],
      ];
      const specs = Object.fromEntries(
        specGroups.filter(([, values]) => values.length > 0)
      );
      const weight = Option.isSome(config.weight)
        ? yield* parseWeightRange(config.weight.value)
        : {};
      const input = yield* parseInput(
        PUBLIC_TOOLS.search_products.inputSchema,
        {
          query: config.words.join(" "),
          category: Option.getOrUndefined(config.category),
          brands: config.brand,
          suppliers: config.supplier.map(value => value.toLowerCase()),
          audiences: config.audience,
          specs,
          ...weight,
          pricedOnly: config.priced,
          sort: Option.getOrUndefined(config.sort),
          destination: session.destination,
          currency: session.currency,
          includeFacets: config.facets,
          limit: session.globals.limit,
          offset: session.globals.offset,
        }
      );
      const reply = yield* session.api.call("search_products", input);
      yield* present(session, reply, okSchema, data =>
        renderSearch(session, input.query, data)
      );
    })
  )
).pipe(
  Command.withDescription(
    "Find products by type, brand or model, with the lowest delivered price for a destination."
  ),
  Command.withExamples([
    {
      command: "podbenchmark search bella canvas 3001",
      description: "Find a specific blank",
    },
    {
      command:
        "podbenchmark search hoodie --supplier gelato --sort cheapest --to GB",
    },
    {
      command:
        "podbenchmark search t-shirt --fit classic --weight 4-6 --facets",
    },
  ])
);

type SearchOutput = ReturnType<typeof okSchema.parse>;

function renderSearch(session: Session, query: string, data: SearchOutput) {
  const { style, terminal } = session;
  const where = `delivered to ${DESTINATION_NAMES[data.destination]} in ${data.currency}`;
  const lines: string[] = [];
  const subject = query === "" ? "Products" : `Products for “${query}”`;
  lines.push(
    style.bold(`${subject} · ${data.totalCount} found · ${where}`),
    ""
  );
  if (data.products.length === 0) {
    lines.push(
      "No products match. Try fewer words or remove a filter.",
      style.dim(`next: ${NPX} categories`)
    );
    return lines.join("\n");
  }
  const nameWidth = Math.max(18, terminal.columns - 44);
  lines.push(
    renderTable(
      [
        { header: "ID", maxWidth: 30 },
        { header: "PRODUCT", maxWidth: nameWidth },
        { header: "FROM", align: "right" },
        { header: "SUPPLIERS", align: "right" },
      ],
      data.products.map(product => ({
        cells: [
          product.canonicalProductId,
          product.name,
          money(product.startingPrice, data.currency),
          product.pricedSuppliers.length > 0
            ? `${product.pricedSuppliers.length} of ${product.suppliers.length}`
            : UNKNOWN,
        ],
      })),
      style.dim
    ),
    style.dim(
      "FROM is the lowest delivered price (product + shipping) for the usual size and color. Compare a specific one with `compare`."
    )
  );
  if (data.facets) {
    lines.push("", style.bold("In these results"));
    const labelWidth = Math.max(
      9,
      ...Object.keys(data.facets.specs).map(field => field.length)
    );
    const facetLine = (
      label: string,
      values: readonly { value: string; count: number }[]
    ) => {
      if (values.length === 0) return;
      const list = wrapList(
        values.map(item => `${item.value} (${item.count})`),
        Math.max(30, terminal.columns - labelWidth - 4),
        ", ",
        " ".repeat(labelWidth + 3)
      ).trimStart();
      lines.push(`  ${label.padEnd(labelWidth)} ${list}`);
    };
    facetLine("Brands", data.facets.brands);
    facetLine("Suppliers", data.facets.suppliers);
    facetLine("Audiences", data.facets.audiences);
    for (const [field, values] of Object.entries(data.facets.specs)) {
      facetLine(field, values);
    }
  }
  const shown = (data.nextOffset ?? data.totalCount) - data.products.length;
  if (data.nextOffset !== null) {
    lines.push(
      "",
      `Showing ${shown + 1}–${data.nextOffset} of ${data.totalCount}. More: --offset ${data.nextOffset}`
    );
  }
  const first = data.products[0];
  if (first) {
    lines.push(
      "",
      style.dim(`next: ${NPX} options ${first.canonicalProductId}`)
    );
  }
  return lines.join("\n");
}
