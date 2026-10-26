import { Effect, FileSystem, Path } from "effect";
import { z } from "zod";
import { CurrencySchema } from "shared/pricing/schema";
import { TARGET_DESTINATIONS } from "shared/runtime/enums";
import { SALES_CHANNELS } from "shared/sales-channel-fees/channels";
import { PUBLIC_SUPPLIER_IDS } from "shared/public-api/common";
import { CliFailure, usageFailure } from "./failure";
import type { Destination } from "shared/runtime/enums";

/** The currency a destination's buyers pay in. */
export const DESTINATION_CURRENCY = {
  US: "USD",
  GB: "GBP",
  DE: "EUR",
  CA: "CAD",
  AU: "AUD",
} as const satisfies Record<Destination, z.infer<typeof CurrencySchema>>;

/** What `config set` stores and the environment can override. */
export const settingsSchema = z.strictObject({
  to: z.enum(TARGET_DESTINATIONS).optional(),
  currency: CurrencySchema.optional(),
  current: z.enum(PUBLIC_SUPPLIER_IDS).optional(),
  on: z.enum(SALES_CHANNELS).optional(),
  shopIn: z.enum(TARGET_DESTINATIONS).optional(),
});
export type Settings = z.infer<typeof settingsSchema>;
export type SettingKey = keyof Settings;

export const SETTING_KEYS = [
  "to",
  "currency",
  "current",
  "on",
  "shopIn",
] as const satisfies readonly SettingKey[];

/** The flag that sets each value, for messages. */
export const SETTING_FLAGS = {
  to: "--to",
  currency: "--currency",
  current: "--current",
  on: "--on",
  shopIn: "--shop-in",
} as const satisfies Record<SettingKey, string>;

export const SETTING_ENV = {
  to: "PODBENCHMARK_TO",
  currency: "PODBENCHMARK_CURRENCY",
  current: "PODBENCHMARK_CURRENT",
  on: "PODBENCHMARK_ON",
  shopIn: "PODBENCHMARK_SHOP_IN",
} as const satisfies Record<SettingKey, string>;

const SETTING_VALUES = {
  to: TARGET_DESTINATIONS,
  currency: CurrencySchema.options,
  current: PUBLIC_SUPPLIER_IDS,
  on: SALES_CHANNELS,
  shopIn: TARGET_DESTINATIONS,
} as const satisfies Record<SettingKey, readonly string[]>;

const UPPERCASE: ReadonlySet<SettingKey> = new Set([
  "to",
  "currency",
  "shopIn",
]);

/** Accept `us`, `US`, `Etsy`, `etsy`: the case people type is never the problem. */
const normalize = (key: SettingKey, value: string) =>
  UPPERCASE.has(key) ? value.trim().toUpperCase() : value.trim().toLowerCase();

const singleSettingSchemas = {
  to: settingsSchema.shape.to.unwrap(),
  currency: settingsSchema.shape.currency.unwrap(),
  current: settingsSchema.shape.current.unwrap(),
  on: settingsSchema.shape.on.unwrap(),
  shopIn: settingsSchema.shape.shopIn.unwrap(),
} as const;

/** Checks one value against the same enum the API uses. */
export function parseSetting(key: SettingKey, value: string, source: string) {
  const normalized = normalize(key, value);
  const parsed = singleSettingSchemas[key].safeParse(normalized);
  if (parsed.success) return Effect.succeed(parsed.data);
  return Effect.fail(
    usageFailure(
      `${source} ${JSON.stringify(value)} is not one of ${SETTING_VALUES[key].join(", ")}.`
    )
  );
}

export type SettingSource = "flag" | "env" | "config" | "default";
export interface ResolvedSettings {
  values: Settings;
  sources: Partial<Record<SettingKey, SettingSource>>;
}

type Env = Readonly<Record<string, string | undefined>>;

/** Precedence: flag > environment > config file. Defaults are applied by the caller. */
export const resolveSettings = (
  flags: Partial<Record<SettingKey, string | undefined>>,
  env: Env,
  file: Settings,
  /** Only these settings; others are not read, so a bad unused value can't fail. */
  keys: readonly SettingKey[] = SETTING_KEYS
) =>
  Effect.gen(function* () {
    const values: Settings = {};
    const sources: Partial<Record<SettingKey, SettingSource>> = {};
    for (const key of keys) {
      const fromFlag = flags[key];
      const fromEnv = env[SETTING_ENV[key]];
      if (fromFlag !== undefined) {
        const parsed = yield* parseSetting(
          key,
          fromFlag,
          `${SETTING_FLAGS[key]}`
        );
        Object.assign(values, { [key]: parsed });
        sources[key] = "flag";
      } else if (fromEnv !== undefined && fromEnv.trim() !== "") {
        const parsed = yield* parseSetting(key, fromEnv, SETTING_ENV[key]);
        Object.assign(values, { [key]: parsed });
        sources[key] = "env";
      } else if (file[key] !== undefined) {
        Object.assign(values, { [key]: file[key] });
        sources[key] = "config";
      }
    }
    return { values, sources } satisfies ResolvedSettings;
  });

export function configPath(env: Env, home: string) {
  const base = env["XDG_CONFIG_HOME"] ?? "";
  return Effect.gen(function* () {
    const path = yield* Path.Path;
    return base !== ""
      ? path.join(base, "podbenchmark", "config.json")
      : path.join(home, ".config", "podbenchmark", "config.json");
  });
}

const configFailure = (file: string, detail: string) =>
  new CliFailure({
    exitCode: 1,
    message: `Your settings file ${file} is not valid: ${detail}`,
    hint: "Fix it, or run `podbenchmark config reset` to start over.",
  });

/** The stored settings; an absent file means none are stored. */
export const readConfigFile = (file: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const present = yield* fs
      .exists(file)
      .pipe(Effect.orElseSucceed(() => false));
    if (!present) return {} satisfies Settings;
    const text = yield* fs
      .readFileString(file)
      .pipe(Effect.mapError(() => configFailure(file, "it cannot be read.")));
    const json = yield* Effect.try({
      try: () => z.json().parse(JSON.parse(text)),
      catch: () => configFailure(file, "it is not JSON."),
    });
    const parsed = settingsSchema.safeParse(json);
    if (!parsed.success) {
      return yield* configFailure(
        file,
        parsed.error.issues
          .slice(0, 2)
          .map(issue => `${issue.path.join(".") || "file"}: ${issue.message}`)
          .join("; ")
      );
    }
    return parsed.data;
  });

export const writeConfigFile = (file: string, settings: Settings) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    yield* fs.makeDirectory(path.dirname(file), { recursive: true });
    yield* fs.writeFileString(file, `${JSON.stringify(settings, null, 2)}\n`);
  }).pipe(
    Effect.mapError(
      () =>
        new CliFailure({
          exitCode: 1,
          message: `Could not write ${file}.`,
          hint: "Check that the folder is writable.",
        })
    )
  );

export const removeConfigFile = (file: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    yield* fs.remove(file, { force: true });
  }).pipe(
    Effect.mapError(
      () =>
        new CliFailure({ exitCode: 1, message: `Could not remove ${file}.` })
    )
  );
