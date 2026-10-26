import { z } from "zod";
import {
  PUBLIC_TOOLS,
  isPublicToolName,
  type PublicToolName,
} from "shared/public-api/tools";

/** The API tool behind each command, for `--schema`. */
const COMMAND_TOOLS = {
  search: "search_products",
  categories: "list_categories",
  product: "get_product",
  options: "get_product_options",
  compare: "compare_product",
  price: "compare_product",
  suppliers: "list_suppliers",
  supplier: "get_supplier",
  guide: "supplier_guide",
} as const satisfies Record<string, PublicToolName>;

const describeTool = (name: PublicToolName) => ({
  tool: name,
  description: PUBLIC_TOOLS[name].description,
  input: z.toJSONSchema(PUBLIC_TOOLS[name].inputSchema, { io: "input" }),
  output: z.toJSONSchema(PUBLIC_TOOLS[name].outputSchema, { io: "output" }),
});

export type SchemaAnswer =
  | { kind: "none" }
  | { kind: "print"; text: string }
  | { kind: "unsupported"; command: string };

const isCommandWithTool = (name: string): name is keyof typeof COMMAND_TOOLS =>
  Object.hasOwn(COMMAND_TOOLS, name);

/**
 * `--schema` prints a command's input and output JSON Schema without calling
 * the API, so it is answered before the arguments are parsed (a missing
 * product argument must not get in the way).
 */
export function answerSchemaRequest(argv: readonly string[]): SchemaAnswer {
  if (!argv.includes("--schema")) return { kind: "none" };
  // The first known command name: a flag value such as `--to GB` is not one.
  const command = argv.find(isCommandWithTool);
  const toolless = argv.find(token => token === "config" || token === "skills");
  if (command === undefined && toolless !== undefined)
    return { kind: "unsupported", command: toolless };
  if (command === undefined) {
    const all = Object.fromEntries(
      Object.entries(COMMAND_TOOLS).map(([name, tool]) => [
        name,
        describeTool(tool),
      ])
    );
    return { kind: "print", text: JSON.stringify(all, null, 2) };
  }
  const tool =
    command === "supplier" && argv.includes("--prices")
      ? "get_supplier_prices"
      : COMMAND_TOOLS[command];
  if (!isPublicToolName(tool)) return { kind: "unsupported", command };
  return {
    kind: "print",
    text: JSON.stringify({ command, ...describeTool(tool) }, null, 2),
  };
}
