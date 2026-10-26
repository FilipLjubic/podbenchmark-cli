import { Effect } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import { Option } from "effect";
import { PUBLIC_TOOLS } from "shared/public-api/tools";
import { parseInput } from "../input";
import { DESTINATION_NAMES, NPX, money } from "../render/money";
import { renderTable } from "../render/table";
import { present, withSession } from "../session";

const categoriesOk = PUBLIC_TOOLS.list_categories.outputSchema.options[0];
const productOk = PUBLIC_TOOLS.get_product.outputSchema.options[0];

export const categoriesCommand = Command.make(
  "categories",
  {
    words: Argument.String("words").pipe(
      Argument.withDescription("Words to find a category, such as hoodies."),
      Argument.variadic()
    ),
    parent: Flag.String("parent").pipe(
      Flag.withDescription("Only the children of this category."),
      Flag.optional
    ),
  },
  config =>
    withSession(session =>
      Effect.gen(function* () {
        const input = yield* parseInput(
          PUBLIC_TOOLS.list_categories.inputSchema,
          {
            query: config.words.join(" "),
            parent: Option.getOrUndefined(config.parent),
            destination: session.destination,
            currency: session.currency,
            limit: session.globals.limit,
            offset: session.globals.offset,
          }
        );
        const reply = yield* session.api.call("list_categories", input);
        yield* present(session, reply, categoriesOk, data => {
          const { style } = session;
          if (data.categories.length === 0) {
            return "No category matches those words.";
          }
          const lines = [
            style.bold(
              `Categories · ${data.totalCount} found · delivered to ${DESTINATION_NAMES[data.destination]} in ${data.currency}`
            ),
            "",
            renderTable(
              [
                { header: "ID", maxWidth: 30 },
                { header: "NAME", maxWidth: 28 },
                { header: "PRODUCTS", align: "right" },
                { header: "SUPPLIERS", align: "right" },
                { header: "FROM", align: "right" },
              ],
              data.categories.map(category => ({
                cells: [
                  category.parent ? `${category.id}` : category.id,
                  category.name,
                  String(category.productCount),
                  String(category.supplierCount),
                  money(category.startingPrice, data.currency),
                ],
                paint: category.parent ? undefined : style.bold,
              })),
              style.dim
            ),
          ];
          if (data.nextOffset !== null) {
            lines.push("", `More: --offset ${data.nextOffset}`);
          }
          const first = data.categories[0];
          if (first) {
            lines.push(
              "",
              style.dim(`next: ${NPX} search --category ${first.id}`)
            );
          }
          return lines.join("\n");
        });
      })
    )
).pipe(
  Command.withDescription(
    "Browse product categories with product counts and starting prices."
  )
);

export const productCommand = Command.make(
  "product",
  {
    product: Argument.String("product").pipe(
      Argument.withDescription("A product id from `search`.")
    ),
    similar: Flag.Int("similar").pipe(
      Flag.withDescription(
        "How many similar products to list (0 to 20, default 5)."
      ),
      Flag.optional
    ),
  },
  config =>
    withSession(session =>
      Effect.gen(function* () {
        const input = yield* parseInput(PUBLIC_TOOLS.get_product.inputSchema, {
          canonicalProductId: config.product,
          similarLimit: Option.getOrUndefined(config.similar),
        });
        const reply = yield* session.api.call("get_product", input);
        yield* present(session, reply, productOk, data => {
          const { style } = session;
          const { product } = data;
          const facts = [
            product.brand,
            product.category?.name,
            product.audience,
          ].filter((value): value is string => Boolean(value));
          const lines = [style.bold(product.name)];
          if (facts.length > 0) lines.push(style.dim(facts.join(" · ")));
          if (product.description) lines.push("", product.description);
          if (product.highlights.length > 0) {
            lines.push("", ...product.highlights.map(item => `• ${item}`));
          }
          if (product.printMethods.length > 0) {
            lines.push("", `Print methods  ${product.printMethods.join(", ")}`);
          }
          const specs = Object.entries(product.specs);
          if (specs.length > 0) {
            lines.push("", style.bold("Specs"));
            const width = Math.max(...specs.map(([key]) => key.length));
            for (const [key, value] of specs) {
              lines.push(`  ${key.padEnd(width)}  ${value}`);
            }
          }
          if (data.similar.length > 0) {
            lines.push(
              "",
              style.bold(
                `Similar products (${data.similar.length} of ${data.similarCount})`
              )
            );
            for (const item of data.similar) {
              lines.push(`  ${item.canonicalProductId}  ${item.name}`);
              lines.push(style.dim(`    ${item.similarity}`));
              if (item.differences.length > 0) {
                lines.push(
                  style.dim(`    differs: ${item.differences.join("; ")}`)
                );
              }
            }
          }
          if (product.url) lines.push("", `Product page  ${product.url}`);
          lines.push(
            "",
            style.dim(`next: ${NPX} options ${product.canonicalProductId}`)
          );
          return lines.join("\n");
        });
      })
    )
).pipe(
  Command.withDescription(
    "Read a product's specs, print methods and similar products."
  )
);
