import { Option } from "effect";
import { Flag } from "effect/cli";
import {
  VARIANT_PICKER_DIMENSIONS,
  type VariantPickerDimension,
} from "shared/runtime/variant-picker-policy";

/** `pageCount` → `page-count`. */
export const kebab = (field: string) =>
  field.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);

const words = (field: string) => kebab(field).replaceAll("-", " ");

/**
 * One optional flag per way a product can vary, named like the field:
 * `--size`, `--color`, `--capacity`, `--page-count`, `--device-fit`…
 */
export const dimensionFlags = Object.fromEntries(
  VARIANT_PICKER_DIMENSIONS.map(dimension => [
    dimension,
    Flag.String(kebab(dimension)).pipe(
      Flag.withDescription(`Choose the ${words(dimension)}.`),
      Flag.optional
    ),
  ])
);

const DIMENSIONS: ReadonlySet<string> = new Set(VARIANT_PICKER_DIMENSIONS);
export const isDimension = (field: string): field is VariantPickerDimension =>
  DIMENSIONS.has(field);

/** The picked values by field, ready for the API's `choices`. */
export function choicesFromFlags(
  flags: Readonly<Record<string, Option.Option<string>>>
) {
  const choices: Record<string, string> = {};
  for (const [field, value] of Object.entries(flags)) {
    if (Option.isSome(value)) choices[field] = value.value;
  }
  return choices;
}

const SAFE = /^[\w.:+/-]+$/;
/** Quotes a value for a shell only when it needs it. */
export const shellWord = (value: string) =>
  SAFE.test(value) ? value : `'${value.replaceAll("'", "'\\''")}'`;

/** `--size m --color black` for the choices that have a flag. */
export function choiceFlags(choices: Readonly<Record<string, string>>) {
  return Object.entries(choices)
    .filter(([field]) => isDimension(field))
    .map(([field, value]) => `--${kebab(field)} ${shellWord(value)}`)
    .join(" ");
}

/** `size=apparel%3Aadult%3Am&color=black` → `{ size: "m", color: "black" }`. */
export function choicesFromOptionKey(key: string) {
  const choices: Record<string, string> = {};
  for (const [field, value] of new URLSearchParams(key)) {
    choices[field] = value.split(":").pop() ?? value;
  }
  return choices;
}
