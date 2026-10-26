import { Console, Effect, Option } from "effect";
import { Command, Flag } from "effect/cli";
import { usageFailure } from "../failure";
import { DESTINATION_NAMES } from "../render/money";
import { printJson, withSession, type Session } from "../session";
import {
  DESTINATION_CURRENCY,
  SETTING_ENV,
  SETTING_FLAGS,
  SETTING_KEYS,
  parseSetting,
  readConfigFile,
  removeConfigFile,
  writeConfigFile,
  type SettingKey,
  type Settings,
} from "../settings";

const some = (name: string, description: string) =>
  Flag.String(name).pipe(Flag.withDescription(description), Flag.optional);

const describe = (key: SettingKey, value: string | undefined) => {
  if (value === undefined) return "not set";
  if (key === "to" || key === "shopIn") {
    const name = DESTINATION_NAMES[value as keyof typeof DESTINATION_NAMES];
    return name ? `${value} (${name})` : value;
  }
  return value;
};

const LABELS = {
  to: "Destination",
  currency: "Currency",
  current: "Your supplier",
  on: "Sales channel",
  shopIn: "Shop country",
} as const satisfies Record<SettingKey, string>;

const setCommand = Command.make(
  "set",
  {
    current: some("current", "The supplier you use today."),
    on: some(
      "on",
      "Where you sell: etsy, shopify, woocommerce or tiktok-shop."
    ),
    shopIn: some("shop-in", "The country your shop is in."),
  },
  config =>
    withSession(
      session =>
        Effect.gen(function* () {
          const flags: Partial<Record<SettingKey, string | undefined>> = {
            to: session.globals.to,
            currency: session.globals.currency,
            current: Option.getOrUndefined(config.current),
            on: Option.getOrUndefined(config.on),
            shopIn: Option.getOrUndefined(config.shopIn),
          };
          const given = SETTING_KEYS.filter(key => flags[key] !== undefined);
          if (given.length === 0) {
            return yield* usageFailure(
              "Nothing to save. Give at least one of --to, --currency, --current, --on, --shop-in.",
              "Example: podbenchmark config set --to GB --on etsy --shop-in GB"
            );
          }
          const stored = yield* readConfigFile(session.configFile);
          const next: Settings = { ...stored };
          for (const key of given) {
            const value = flags[key];
            if (value === undefined) continue;
            Object.assign(next, {
              [key]: yield* parseSetting(key, value, SETTING_FLAGS[key]),
            });
          }
          yield* writeConfigFile(session.configFile, next);
          if (session.machine) {
            return yield* printJson({
              ok: true,
              path: session.configFile,
              config: next,
            });
          }
          yield* Console.log(`Saved to ${session.configFile}`);
          yield* Console.log(renderSettings(session, next));
        }),
      { lenientConfig: true }
    )
).pipe(
  Command.withDescription(
    "Remember your destination, currency, supplier, sales channel and shop country as defaults."
  ),
  Command.withExamples([
    {
      command:
        "podbenchmark config set --to GB --current printful --on etsy --shop-in GB",
    },
  ])
);

function renderSettings(session: Session, values: Settings) {
  const width = Math.max(...SETTING_KEYS.map(key => LABELS[key].length));
  return SETTING_KEYS.map(
    key =>
      `${session.style.cyan(LABELS[key].padEnd(width))}  ${describe(key, values[key])}`
  ).join("\n");
}

const showCommand = Command.make("show", {}, () =>
  withSession(
    session =>
      Effect.gen(function* () {
        const stored = yield* readConfigFile(session.configFile);
        const effective = yield* session.settings({});
        const to = effective.values.to ?? "US";
        const resolved: Settings = {
          ...effective.values,
          to,
          currency: effective.values.currency ?? DESTINATION_CURRENCY[to],
        };
        const sources = {
          ...effective.sources,
          ...(effective.values.to ? {} : { to: "default" as const }),
          ...(effective.values.currency
            ? {}
            : { currency: "default" as const }),
        };
        if (session.machine) {
          return yield* printJson({
            ok: true,
            path: session.configFile,
            stored,
            effective: resolved,
            sources,
          });
        }
        const { style } = session;
        const width = Math.max(...SETTING_KEYS.map(key => LABELS[key].length));
        const lines = [style.bold("Your defaults"), ""];
        for (const key of SETTING_KEYS) {
          const source = sources[key];
          lines.push(
            `${style.cyan(LABELS[key].padEnd(width))}  ${describe(key, resolved[key]).padEnd(24)}${
              source
                ? style.dim(
                    source === "env"
                      ? `from ${SETTING_ENV[key]}`
                      : source === "flag"
                        ? `from ${SETTING_FLAGS[key]}`
                        : source === "config"
                          ? "saved"
                          : "built in"
                  )
                : ""
            }`
          );
        }
        lines.push("", style.dim(`File: ${session.configFile}`));
        yield* Console.log(lines.map(line => line.trimEnd()).join("\n"));
      }),
    { lenientConfig: true }
  )
).pipe(
  Command.withDescription("Show the defaults in use and where each comes from.")
);

const resetCommand = Command.make("reset", {}, () =>
  withSession(
    session =>
      Effect.gen(function* () {
        yield* removeConfigFile(session.configFile);
        if (session.machine) {
          return yield* printJson({
            ok: true,
            path: session.configFile,
            config: {},
          });
        }
        yield* Console.log(
          `Removed ${session.configFile}. Defaults are back to the built-in ones.`
        );
      }),
    { lenientConfig: true }
  )
).pipe(Command.withDescription("Forget every saved default."));

export const configCommand = Command.make("config").pipe(
  Command.withDescription(
    "Save defaults so you do not repeat --to, --current, --on and --shop-in."
  ),
  Command.withSubcommands([setCommand, showCommand, resetCommand])
);
