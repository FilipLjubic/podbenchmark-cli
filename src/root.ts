import { Command, Flag } from "effect/cli";
import { CLI_SHARED_FLAGS } from "shared/cli/shared-flags";

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
    to: Flag.String(CLI_SHARED_FLAGS.to.name).pipe(
      Flag.withDescription(CLI_SHARED_FLAGS.to.description),
      Flag.optional
    ),
    currency: Flag.String(CLI_SHARED_FLAGS.currency.name).pipe(
      Flag.withDescription(CLI_SHARED_FLAGS.currency.description),
      Flag.optional
    ),
    json: Flag.Boolean(CLI_SHARED_FLAGS.json.name).pipe(
      Flag.withDescription(CLI_SHARED_FLAGS.json.description),
      Flag.withDefault(false)
    ),
    table: Flag.Boolean(CLI_SHARED_FLAGS.table.name).pipe(
      Flag.withDescription(CLI_SHARED_FLAGS.table.description),
      Flag.withDefault(false)
    ),
    schema: Flag.Boolean(CLI_SHARED_FLAGS.schema.name).pipe(
      Flag.withDescription(CLI_SHARED_FLAGS.schema.description),
      Flag.withDefault(false)
    ),
    dryRun: Flag.Boolean(CLI_SHARED_FLAGS.dryRun.name).pipe(
      Flag.withDescription(CLI_SHARED_FLAGS.dryRun.description),
      Flag.withDefault(false)
    ),
    limit: Flag.Int(CLI_SHARED_FLAGS.limit.name).pipe(
      Flag.withDescription(CLI_SHARED_FLAGS.limit.description),
      Flag.optional
    ),
    offset: Flag.Int(CLI_SHARED_FLAGS.offset.name).pipe(
      Flag.withDescription(CLI_SHARED_FLAGS.offset.description),
      Flag.optional
    ),
  })
);
