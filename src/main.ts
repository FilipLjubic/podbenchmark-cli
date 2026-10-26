import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Console, Effect, Layer } from "effect";
import {
  CliConfig,
  CliError,
  CliOutput,
  Command,
  GlobalFlag,
} from "effect/cli";
import { VERSION } from "./api";
import { categoriesCommand, productCommand } from "./commands/catalog";
import { compareCommand, priceCommand } from "./commands/compare";
import { configCommand } from "./commands/config";
import { optionsCommand } from "./commands/options";
import { searchCommand } from "./commands/search";
import { skillsCommand } from "./commands/skills";
import {
  guideCommand,
  supplierCommand,
  suppliersCommand,
} from "./commands/suppliers";
import { makeFormatter } from "./help";
import { root } from "./root";
import { answerSchemaRequest } from "./schema";
import { readTerminal } from "./terminal";
import { bodyForExit, EXIT, machineOutput } from "./failure";

const cli = root.pipe(
  Command.withSubcommands([
    searchCommand,
    categoriesCommand,
    productCommand,
    optionsCommand,
    compareCommand,
    priceCommand,
    suppliersCommand,
    supplierCommand,
    guideCommand,
    configCommand,
    skillsCommand,
  ])
);

const KNOWN_COMMANDS: ReadonlySet<string> = new Set([
  "search",
  "categories",
  "product",
  "options",
  "compare",
  "price",
  "suppliers",
  "supplier",
  "guide",
  "config",
  "skills",
  "config set",
  "config show",
  "config reset",
  "skills add",
]);
const GROUP_COMMANDS = new Set(["config", "skills"]);

/** Bare `podbenchmark`, `config` and `skills` show their help. */
function withDefaultHelp(args: readonly string[]) {
  const words = args.filter(token => !token.startsWith("-"));
  const first = words[0];
  const needsHelp =
    args.length === 0 ||
    (words.length === 1 && first !== undefined && GROUP_COMMANDS.has(first));
  return needsHelp ? [...args, "--help"] : [...args];
}

const argv = withDefaultHelp(process.argv.slice(2));
const terminal = readTerminal(process.env, process.stdout, process.stderr);

const schema = answerSchemaRequest(argv);
if (schema.kind === "print") {
  process.stdout.write(`${schema.text}\n`);
} else if (schema.kind === "unsupported") {
  process.stderr.write(
    `error: ${schema.command} has no input schema; it does not call the API.\n`
  );
  process.exitCode = 1;
} else {
  // The help page that follows a parse error is dropped by the formatter; the
  // blank line it would leave behind is dropped here.
  const quietBlank = Layer.succeed(Console.Console, {
    ...globalThis.console,
    log: (...args: readonly string[]) => {
      if (args.length === 1 && args[0] === "") return;
      globalThis.console.log(...args);
    },
  });
  const layer = Layer.mergeAll(
    NodeServices.layer,
    CliOutput.layer(makeFormatter(terminal, argv, KNOWN_COMMANDS)),
    // Only --help and --version: no wizard, log-level or completions to clutter help.
    CliConfig.layer({ builtIns: [GlobalFlag.Help, GlobalFlag.Version] }),
    quietBlank
  );
  Command.runWith(cli, { version: VERSION })(argv).pipe(
    Effect.catch(error =>
      Effect.sync(() => {
        // Parse errors were already described by the formatter.
        if (!CliError.isCliError(error)) {
          const message = `Something went wrong. ${String(error)}`;
          if (machineOutput(argv, terminal))
            process.stdout.write(
              `${JSON.stringify(bodyForExit(EXIT.usage, message), null, 2)}\n`
            );
          process.stderr.write(`error: ${message}\n`);
        }
        process.exitCode = 1;
      })
    ),
    Effect.provide(layer),
    NodeRuntime.runMain
  );
}
