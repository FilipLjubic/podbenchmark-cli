import { Effect } from "effect";
import type { z } from "zod";
import { usageFailure } from "./failure";

/** The flag behind each API input field, so errors talk about what was typed. */
const FIELD_FLAGS: Readonly<Record<string, string>> = {
  destination: "--to",
  currency: "--currency",
  limit: "--limit",
  offset: "--offset",
  sellingPrice: "--sell-for",
  targetMargin: "--margin",
  salesChannel: "--on",
  shopLocation: "--shop-in",
  pricingTier: "--plan",
  yourSupplier: "--current",
  supplier: "--supplier",
  suppliers: "--supplier",
  supplierId: "<supplier>",
  versus: "--vs",
  within: "--within",
  sort: "--sort",
  category: "--category",
  brands: "--brand",
  audiences: "--for",
  minWeightOz: "--weight",
  maxWeightOz: "--weight",
  optionKey: "--option",
  similarLimit: "--similar",
  country: "--country",
  provider: "--provider",
  productType: "<product-type>",
  canonicalProductId: "<product>",
  needsCustomBranding: "--branding",
  wantsFreeStart: "--free-start",
  wantsToChooseProvider: "--choose-provider",
};

const MESSAGE_FIELDS: ReadonlyArray<readonly [string, string]> = [
  ["sellingPrice", "--sell-for"],
  ["targetMargin", "--margin"],
  ["optionKey", "--option"],
  ["choices", "the size/color flags"],
  ["minWeightOz", "the --weight minimum"],
  ["maxWeightOz", "the --weight maximum"],
];

/** zod's `expected one of "a"|"b"` reads better as a plain list. */
const plainChoices = (message: string) =>
  message.replace(
    /Invalid option: expected one of ((?:"[^"]*"\|?)+)/,
    (_, list: string) =>
      `must be one of ${list.replaceAll('"', "").split("|").join(", ")}`
  );

const rename = (message: string) =>
  MESSAGE_FIELDS.reduce(
    (text, [field, flag]) => text.replaceAll(field, flag),
    plainChoices(message)
  );

/** Checks the request against the API's own schema before anything is sent. */
export function parseInput<S extends z.ZodType>(schema: S, raw: object) {
  const parsed = schema.safeParse(raw);
  if (parsed.success) return Effect.succeed(parsed.data);
  const issue = parsed.error.issues[0];
  if (!issue) return Effect.fail(usageFailure("The request is not valid."));
  const head = issue.path[0];
  const flag = typeof head === "string" ? FIELD_FLAGS[head] : undefined;
  return Effect.fail(
    usageFailure(
      flag ? `${flag}: ${rename(issue.message)}` : rename(issue.message)
    )
  );
}
