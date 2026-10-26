import { Console, Effect } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import { z } from "zod";
import { PUBLIC_TOOLS } from "shared/public-api/tools";
import {
  choiceFlags,
  choicesFromFlags,
  choicesFromOptionKey,
  dimensionFlags,
} from "../choices";
import { jsonValueSchema, type JsonValue } from "../failure";
import { parseInput } from "../input";
import { DESTINATION_NAMES, NPX } from "../render/money";
import { renderTable, wrapList } from "../render/table";
import {
  present,
  printJson,
  readReply,
  withSession,
  type Session,
} from "../session";

const okSchema = PUBLIC_TOOLS.get_product_options.outputSchema.options[0];
type OptionsOutput = z.output<typeof okSchema>;
const MAX_PAGES = 100;
/** The service's largest options page; --all reads whole pages. */
const ALL_PAGE_SIZE = 100;
const asRecord = z.record(z.string(), jsonValueSchema);

export const optionsCommand = Command.make(
  "options",
  {
    product: Argument.String("product").pipe(
      Argument.withDescription(
        "A product id from `search`, such as bella-canvas-3001."
      )
    ),
    words: Argument.String("words").pipe(
      Argument.withDescription("Words to narrow the list, such as m black."),
      Argument.variadic()
    ),
    choice: dimensionFlags,
    all: Flag.Boolean("all").pipe(
      Flag.withDescription("Page through every matching option."),
      Flag.withDefault(false)
    ),
  },
  config =>
    withSession(session =>
      Effect.gen(function* () {
        const choices = choicesFromFlags(config.choice);
        const narrowed =
          config.words.length > 0 || Object.keys(choices).length > 0;
        const request = (offset: number | undefined) =>
          parseInput(PUBLIC_TOOLS.get_product_options.inputSchema, {
            canonicalProductId: config.product,
            destination: session.destination,
            currency: session.currency,
            query: config.words.join(" "),
            choices: Object.keys(choices).length > 0 ? choices : undefined,
            offset,
            limit: config.all ? ALL_PAGE_SIZE : session.globals.limit,
          });
        const pages: JsonValue[] = [];
        let offset = session.globals.offset;
        let remaining: number | null = null;
        for (let page = 0; page < MAX_PAGES; page++) {
          const input = yield* request(offset);
          const reply = yield* session.api.call("get_product_options", input);
          pages.push(reply);
          if (!config.all) break;
          remaining = (yield* readReply(okSchema, reply)).nextOffset;
          if (remaining === null) break;
          offset = remaining;
        }
        const first = pages[0];
        if (first === undefined) return;
        if (pages.length === 1) {
          return yield* present(session, first, okSchema, data =>
            renderOptions(session, config.product, narrowed, data, config.all)
          );
        }
        if (session.machine) return yield* printJson(mergePages(pages, remaining));
        // Each page is read on its own: together they exceed one page's size limit.
        const parsed = yield* Effect.forEach(pages, page =>
          readReply(okSchema, page)
        );
        const head = parsed[0];
        if (head === undefined) return;
        yield* Console.log(
          renderOptions(
            session,
            config.product,
            narrowed,
            {
              ...head,
              options: parsed.flatMap(page => page.options),
              nextOffset: remaining,
            },
            true
          )
        );
      })
    )
).pipe(
  Command.withDescription(
    "List the sizes, colors and other choices a product comes in, and the exact values to pass to `compare`."
  ),
  Command.withExamples([
    {
      command: "podbenchmark options bella-canvas-3001",
      description: "See every field and its values",
    },
    {
      command: "podbenchmark options bella-canvas-3001 m black",
      description: "Narrow to matching combinations",
    },
    {
      command: "podbenchmark options gildan-5000 --size xl --all",
      description: "Every color in XL",
    },
  ])
);

/** Every page's options in one answer, as if the service had returned them at once. */
function mergePages(
  pages: readonly JsonValue[],
  nextOffset: number | null
): JsonValue {
  const records = pages.map(page => asRecord.parse(page));
  const options = records.flatMap(record => {
    const list = record["options"];
    return Array.isArray(list) ? list : [];
  });
  return { ...records[0], options, nextOffset };
}

function optionLabel(data: OptionsOutput, key: string | null) {
  if (key === null) return null;
  const choices = choicesFromOptionKey(key);
  const labels = Object.entries(choices).map(([field, value]) => {
    const match = data.fields
      .find(candidate => candidate.field === field)
      ?.values.find(candidate => candidate.value === value);
    return match?.label ?? value;
  });
  return { choices, text: labels.join(" · ") };
}

const VALUE_SAMPLE = 12;

function renderOptions(
  session: Session,
  product: string,
  narrowed: boolean,
  data: OptionsOutput,
  showAll: boolean
) {
  const { style, terminal } = session;
  const where = `${DESTINATION_NAMES[session.destination]} in ${session.currency}`;
  const lines = [
    style.bold(
      `${product} · choices for ${where} · ${data.totalCount} ${narrowed ? "matching " : ""}${data.totalCount === 1 ? "combination" : "combinations"}`
    ),
    "",
  ];
  const labelWidth = Math.max(
    ...data.fields.map(field => field.field.length),
    5
  );
  for (const field of data.fields) {
    const values = field.values.map(value => value.value);
    // Long lists (colours) show a sample unless --all asks for every value.
    const shown =
      showAll || values.length <= VALUE_SAMPLE
        ? values
        : [
            ...values.slice(0, VALUE_SAMPLE),
            `… ${values.length - VALUE_SAMPLE} more with --all`,
          ];
    const list = wrapList(
      shown,
      Math.max(30, terminal.columns - labelWidth - 3),
      ", ",
      " ".repeat(labelWidth + 3)
    ).trimStart();
    lines.push(`${style.cyan(field.field.padEnd(labelWidth))}   ${list}`);
  }
  const opens = optionLabel(data, data.defaultOptionKey);
  if (opens) lines.push("", `Opens on  ${opens.text}`);
  if (narrowed) {
    lines.push("");
    if (data.options.length === 0) {
      lines.push(
        "Nothing matches those words. Try fewer, or check the values above."
      );
    } else {
      const fields = Object.keys(data.options[0]?.choices ?? {});
      lines.push(
        renderTable(
          [
            ...fields.map(field => ({
              header: field.toUpperCase(),
              maxWidth: 28,
            })),
            { header: "SUPPLIERS", align: "right" as const },
          ],
          data.options.map(option => ({
            cells: [
              ...fields.map(field => option.choices[field] ?? ""),
              String(option.supplierCount),
            ],
          })),
          style.dim
        )
      );
      if (data.options.length < data.totalCount) {
        lines.push(
          style.dim(
            `Showing ${data.options.length} of ${data.totalCount}. More: --offset ${data.nextOffset ?? data.options.length}, or --all.`
          )
        );
      }
    }
  }
  const pick = narrowed
    ? (data.options[0]?.choices ?? null)
    : (opens?.choices ?? null);
  const flags = pick ? choiceFlags(pick) : "";
  const unknownFields = pick
    ? Object.keys(pick).some(field => choiceFlags({ [field]: "x" }) === "")
    : false;
  const first = data.options[0];
  const selection = unknownFields && first ? `--option '${first.key}'` : flags;
  lines.push(
    "",
    style.dim(
      `next: ${NPX} compare ${product}${selection ? ` ${selection}` : ""} --to ${session.destination}`
    )
  );
  return lines.join("\n");
}
