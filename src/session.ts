import { Console, Effect, Option } from "effect";
import type { z } from "zod";
import type { Currency } from "shared/runtime/fx/types";
import type { Destination } from "shared/runtime/enums";
import { apiOrigin, makeApi, type ApiClient } from "./api";
import { bodyForExit, CliFailure, type JsonValue } from "./failure";
import { root } from "./root";
import {
  DESTINATION_CURRENCY,
  configPath,
  readConfigFile,
  resolveSettings,
  type ResolvedSettings,
  type SettingKey,
} from "./settings";
import { makeStyle, type Style } from "./style";
import { readTerminal, type Terminal } from "./terminal";
import { homedir } from "node:os";

export interface Globals {
  to: string | undefined;
  currency: string | undefined;
  json: boolean;
  table: boolean;
  schema: boolean;
  dryRun: boolean;
  limit: number | undefined;
  offset: number | undefined;
}

export interface Session {
  globals: Globals;
  terminal: Terminal;
  style: Style;
  /** JSON in, JSON out: scripts, pipes and agents. */
  machine: boolean;
  api: ApiClient;
  /** Where the buyer lives and which currency prices use, after flags, env and config. */
  destination: Destination;
  currency: Currency;
  /** Resolves the seller settings a command accepts as flags. */
  settings: (
    flags: Partial<Record<SettingKey, string | undefined>>
  ) => Effect.Effect<ResolvedSettings, CliFailure>;
  configFile: string;
}

const optional = <A>(value: Option.Option<A>) => Option.getOrUndefined(value);

const readGlobals = Effect.gen(function* () {
  const raw = yield* root;
  return {
    to: optional(raw.to),
    currency: optional(raw.currency),
    json: raw.json,
    table: raw.table,
    schema: raw.schema,
    dryRun: raw.dryRun,
    limit: optional(raw.limit),
    offset: optional(raw.offset),
  } satisfies Globals;
});

const isMachine = (globals: Globals, terminal: Terminal) =>
  globals.json ||
  (!globals.table && (!terminal.stdoutIsTty || terminal.agent !== null));

const printFailure = (
  failure: CliFailure,
  globals: Globals,
  terminal: Terminal
) =>
  Effect.gen(function* () {
    const machine = isMachine(globals, terminal);
    if (failure.exitCode !== 0) {
      process.exitCode = failure.exitCode;
    }
    if (failure.message === "") return;
    if (machine) {
      // Scripts always get a JSON answer, even for failures the CLI found itself.
      const body =
        failure.body ?? bodyForExit(failure.exitCode, failure.message);
      yield* Console.log(JSON.stringify(body, null, 2));
    }
    // A person piping JSON still deserves to see why it failed.
    const showText =
      !machine || (terminal.stderrIsTty && terminal.agent === null);
    if (!showText) return;
    const style = makeStyle(terminal.colorErr);
    const lines = [`${style.red("error:")} ${failure.message}`];
    if (failure.details) lines.push(...failure.details);
    if (failure.hint) lines.push(style.dim(failure.hint));
    yield* Console.error(lines.join("\n"));
  });

/**
 * Wraps a command body: builds the session (output mode, settings, API
 * client), and turns every expected failure into the right stderr lines,
 * JSON and exit code.
 */
export const withSession = <R>(
  body: (session: Session) => Effect.Effect<void, CliFailure, R>,
  options: { lenientConfig?: boolean } = {}
) =>
  Effect.gen(function* () {
    const globals = yield* readGlobals;
    const terminal = readTerminal(process.env, process.stdout, process.stderr);
    const run = Effect.gen(function* () {
      const machine = isMachine(globals, terminal);
      const home = homedir();
      const configFile = yield* configPath(process.env, home);
      // `config reset` must still work when the file is what is broken.
      const file = yield* options.lenientConfig
        ? readConfigFile(configFile).pipe(
            Effect.catchTag("CliFailure", () => Effect.succeed({}))
          )
        : readConfigFile(configFile);
      const resolve = (
        flags: Partial<Record<SettingKey, string | undefined>>
      ) =>
        resolveSettings(
          { ...flags, to: globals.to, currency: globals.currency },
          process.env,
          file
        );
      // The market is needed up front; seller settings resolve later with
      // the command's own flags, so a flag always beats the environment.
      const base = yield* resolveSettings(
        { to: globals.to, currency: globals.currency },
        process.env,
        file,
        ["to", "currency"]
      );
      const destination = base.values.to ?? "US";
      const session: Session = {
        globals,
        terminal,
        style: makeStyle(terminal.color),
        machine,
        api: makeApi({
          origin: apiOrigin(process.env),
          agent: terminal.agent,
          dryRun: globals.dryRun,
          machine,
        }),
        destination,
        currency: base.values.currency ?? DESTINATION_CURRENCY[destination],
        settings: resolve,
        configFile,
      };
      return yield* body(session);
    });
    yield* run.pipe(
      Effect.catchTag("CliFailure", failure =>
        printFailure(failure, globals, terminal)
      )
    );
  });

export const printJson = (value: JsonValue) =>
  Console.log(JSON.stringify(value, null, 2));

/**
 * Prints a successful reply: the service's JSON as-is in machine mode,
 * otherwise `render` of the parsed result. A reply this version cannot read
 * falls back to JSON rather than failing.
 */
export const present = <S extends z.ZodType>(
  session: Session,
  reply: JsonValue,
  schema: S,
  render: (data: z.output<S>) => string
) =>
  Effect.gen(function* () {
    if (session.machine) return yield* printJson(reply);
    const parsed = schema.safeParse(reply);
    if (!parsed.success) {
      yield* Console.error(
        "This version of the CLI does not recognise the answer, so it is shown as JSON. Update with: npm i -g podbenchmark@latest"
      );
      return yield* printJson(reply);
    }
    yield* Console.log(render(parsed.data));
  });

/** Reads a reply with the success schema when a command needs its fields. */
export const readReply = <S extends z.ZodType>(schema: S, reply: JsonValue) => {
  const parsed = schema.safeParse(reply);
  return parsed.success
    ? Effect.succeed(parsed.data)
    : Effect.fail(
        new CliFailure({
          exitCode: 3,
          message:
            "The answer is in a format this version of the CLI does not recognise.",
          hint: "Update with: npm i -g podbenchmark@latest",
        })
      );
};
