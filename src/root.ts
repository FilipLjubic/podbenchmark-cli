import { Command, Flag } from "effect/cli";

/**
 * The flags every command accepts, before or after the command name. Commands
 * read them with `yield* root`.
 */
export const root = Command.make("podbenchmark").pipe(
  Command.withDescription(
    "Compare print-on-demand supplier prices: product cost, shipping and delivered total, by size, color and destination."
  ),
  Command.withExamples([
    {
      command: "podbenchmark search bella canvas 3001",
      description: "1. Find the product",
    },
    {
      command: "podbenchmark options bella-canvas-3001 m black",
      description: "2. See the exact size and color values",
    },
    {
      command:
        "podbenchmark compare bella-canvas-3001 --size m --color black --to US",
      description: "3. Compare suppliers",
    },
    {
      command: "podbenchmark skills add",
      description: "Teach your coding agent these steps",
    },
  ]),
  Command.withSharedFlags({
    to: Flag.String("to").pipe(
      Flag.withDescription(
        "Where the buyer lives: US, GB, DE, CA or AU (default US)."
      ),
      Flag.optional
    ),
    currency: Flag.String("currency").pipe(
      Flag.withDescription(
        "Currency for every price: USD, EUR, GBP, CAD or AUD (default: the destination's own)."
      ),
      Flag.optional
    ),
    json: Flag.Boolean("json").pipe(
      Flag.withDescription(
        "Print the result as JSON, exactly as the service returns it."
      ),
      Flag.withDefault(false)
    ),
    table: Flag.Boolean("table").pipe(
      Flag.withDescription(
        "Print tables even when output is piped or an agent is detected."
      ),
      Flag.withDefault(false)
    ),
    schema: Flag.Boolean("schema").pipe(
      Flag.withDescription(
        "Print the JSON Schema of this command's input and output, then exit."
      ),
      Flag.withDefault(false)
    ),
    dryRun: Flag.Boolean("dry-run").pipe(
      Flag.withDescription(
        "Print the request that would be sent, without sending it."
      ),
      Flag.withDefault(false)
    ),
    limit: Flag.Int("limit").pipe(
      Flag.withDescription("How many results to show."),
      Flag.optional
    ),
    offset: Flag.Int("offset").pipe(
      Flag.withDescription("How many results to skip."),
      Flag.optional
    ),
  })
);
