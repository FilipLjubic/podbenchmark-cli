import { createClosedStringLookup } from "../kernel/closed-string-lookup";
import { PRINT_DECORATION_AREAS, type PrintDecorationArea } from "../data/print-tech-map";
import {
  BRANDED_APPAREL_PICKER_CATEGORIES,
  T_SHIRT_PICKER_CATEGORIES,
} from "../options/variant-picker-policy";

/**
 * Where the artwork goes and how it is applied, normalized from a variant's
 * print position and technology. Suppliers price every placement separately
 * (Printify quotes a neck label, each sleeve and the front as separate
 * variants), so a comparison has to say which one it prices: the category's
 * standard decoration. Every other decoration stays a real offer, ranked by
 * how far it is from that standard and disclosed when it is the closest one
 * available.
 */
export const PRINT_DECORATION_RESOLUTION_VERSION = "2026-11-09.1";

const PRINT_DECORATION_METHODS = [
  // DTG, or a print whose technique the supplier doesn't state.
  "print",
  // A direct-to-film transfer: the same placement as a print, but a supplier
  // that also prints DTG is priced on its DTG (readPrintMethodPreference).
  "dtf",
  "embroidery",
  "glitter",
  "metallic",
  "puff",
] as const;

type PrintDecorationMethod = (typeof PRINT_DECORATION_METHODS)[number];
export type PrintDecoration = `${PrintDecorationArea}:${PrintDecorationMethod}`;

type PrintDecorationParts = {
  readonly value: PrintDecoration;
  readonly area: PrintDecorationArea;
  readonly method: PrintDecorationMethod;
};

const PRINT_DECORATION_PARTS: readonly PrintDecorationParts[] =
  PRINT_DECORATION_AREAS.flatMap(area =>
    PRINT_DECORATION_METHODS.map(method => ({
      value: `${area}:${method}` as const,
      area,
      method,
    }))
  );

export const PRINT_DECORATIONS: readonly PrintDecoration[] =
  PRINT_DECORATION_PARTS.map(parts => parts.value);

/**
 * Tees, tank tops, hoodies and sweatshirts price one front print. Polos,
 * button-ups, jackets, vests, quarter-zips and headwear are usually decorated
 * on the chest or front panel, so any single front or chest print or
 * embroidery is their standard. Headwear ranks the same way, but embroidery
 * is its standard method: a supplier that embroiders a hat is priced on the
 * embroidery even where it also prints one for less.
 */
export type PrintDecorationSurface =
  | "front-print"
  | "front-decoration"
  | "headwear";

/** The decoration a comparison asks for, recorded as the requested value. */
export const STANDARD_PRINT_DECORATION = {
  "front-print": "front:print",
  "front-decoration": "front:embroidery",
  headwear: "front:embroidery",
} as const satisfies Record<PrintDecorationSurface, PrintDecoration>;

export function printDecorationSurfaceForStandard(
  value: string | null | undefined
): PrintDecorationSurface {
  return value === STANDARD_PRINT_DECORATION["front-decoration"]
    ? "front-decoration"
    : "front-print";
}

const HEADWEAR_DECORATION_CATEGORIES = new Set<string>([
  "baseball-caps",
  "beanies",
  "bucket-hats",
  "dad-hats",
  "golf-caps",
  "hats",
  "snapbacks",
  "trucker-hats",
  "visors",
]);
const FRONT_DECORATION_CATEGORIES = new Set<string>([
  ...HEADWEAR_DECORATION_CATEGORIES,
  "button-up-shirts",
  "jackets",
  "polo-shirts",
  "quarter-zips",
  "vests",
]);
// Every structured apparel picker category, plus tops compared from product
// summaries. Dresses, swimwear and bottoms have no single standard placement.
const FRONT_PRINT_CATEGORIES = new Set<string>(
  [
    ...T_SHIRT_PICKER_CATEGORIES,
    ...BRANDED_APPAREL_PICKER_CATEGORIES,
    "jerseys",
    "tank-tops",
  ].filter(category => !FRONT_DECORATION_CATEGORIES.has(category))
);

/** The profile fact apparel offers are ranked by; read and published as one. */
export const PRINT_DECORATION_FACT_FIELD = "printDecoration";

export function printDecorationSurfaceForCategory(
  categorySlug: string | null | undefined
): PrintDecorationSurface | null {
  const category = categorySlug?.trim().toLowerCase() ?? "";
  if (HEADWEAR_DECORATION_CATEGORIES.has(category)) return "headwear";
  if (FRONT_DECORATION_CATEGORIES.has(category)) return "front-decoration";
  return FRONT_PRINT_CATEGORIES.has(category) ? "front-print" : null;
}

const EFFECT_METHODS = ["glitter", "metallic", "puff"] as const;

function readMethod(
  position: string | null,
  technology: string | null
): PrintDecorationMethod {
  for (const effect of EFFECT_METHODS) {
    if (technology === `${effect}-print` || position?.includes(effect)) {
      return effect;
    }
  }
  if (technology === "embroidery" || position?.includes("embroider")) {
    return "embroidery";
  }
  if (technology === "dtf" || (position && /(^|[-_])dtf($|[-_])/.test(position))) {
    return "dtf";
  }
  return "print";
}

// Checked in order; the first matching area wins. Garment parts that are
// neither the torso nor a sleeve (legs, hoods, waistbands, shoes) come first so
// "back_left_leg" is not read as a back print.
const AREA_PATTERNS: readonly [PrintDecorationArea, RegExp][] = [
  ["front-back", /\+|^(all|multiple|both)$|front[-_](and[-_])?back|full[-_]wrap/],
  [
    "other",
    /leg|hip|shoe|waist|hood|strap|gusset|tongue|placket|hem\b|trim|lining|panties|cup|(left|right)[-_]hat|^(left|right)([-_](dtf|dtg|side))?$/,
  ],
  ["neck", /neck|collar|(^|[-_])label([-_]|$)/],
  ["sleeve", /sleeve|wrist|cuff/],
  ["pocket", /pocket/],
  ["chest", /chest|^front[-_](left|right)($|[-_](dtf|dtg)$)/],
  ["back", /(^|[-_:])back([-_:]|$)/],
  ["front", /(^|[-_:])front([-_:]|$)|^(large[-_])?center|^standard$|^default$/],
];

function readArea(position: string | null): PrintDecorationArea {
  if (!position) return "unstated";
  return AREA_PATTERNS.find(([, pattern]) => pattern.test(position))?.[0] ?? "other";
}

/** `null` when the variant states neither a position nor a technology. */
export function resolvePrintDecoration(input: {
  printPosition: string | null | undefined;
  printTechnology: string | null | undefined;
}): PrintDecoration | null {
  const position = input.printPosition?.trim().toLowerCase() || null;
  const technology = input.printTechnology?.trim().toLowerCase() || null;
  if (!position && !technology) return null;
  return `${readArea(position)}:${readMethod(position, technology)}`;
}

const lookupPrintDecorationParts = createClosedStringLookup<PrintDecorationParts>(
  Object.fromEntries(PRINT_DECORATION_PARTS.map(parts => [parts.value, parts]))
);

function readPrintDecorationParts(
  value: string | null | undefined
): PrintDecorationParts | null {
  return value ? (lookupPrintDecorationParts(value) ?? null) : null;
}

function parsePrintDecoration(
  value: string | null | undefined
): PrintDecoration | null {
  return readPrintDecorationParts(value)?.value ?? null;
}

/** The materialized `printDecoration` fact of one selected profile. */
export function readPrintDecorationFact(
  facts:
    | readonly { field: string; normalizedValue: string | null }[]
    | null
    | undefined
): PrintDecoration | null {
  return parsePrintDecoration(
    facts?.find(fact => fact.field === PRINT_DECORATION_FACT_FIELD)
      ?.normalizedValue
  );
}

type RankTable = Record<PrintDecorationArea, number>;

// Distance from one standard front print. A single print on another side is
// closest, then both sides, embroidery, special-effect inks, small placements,
// and a neck label last: it prices a label, not the design.
const FRONT_PRINT_AREA_RANKS: RankTable = {
  front: 0,
  unstated: 0,
  back: 1,
  "front-back": 2,
  chest: 5,
  pocket: 5,
  sleeve: 6,
  neck: 7,
  other: 8,
};
// A left-chest logo, a centered front panel or a front print are all the
// standard; anywhere else is further away.
const FRONT_DECORATION_AREA_RANKS: RankTable = {
  front: 0,
  unstated: 0,
  chest: 0,
  "front-back": 1,
  back: 2,
  pocket: 3,
  sleeve: 3,
  neck: 4,
  other: 4,
};

// Embroidery and effect inks are further from a front print than a single
// print on the back or on both sides, wherever they are placed.
const FRONT_PRINT_METHOD_FLOORS: Record<PrintDecorationMethod, number> = {
  print: 0,
  dtf: 0,
  embroidery: 3,
  glitter: 4,
  metallic: 4,
  puff: 4,
};
const METHOD_ORDER: Record<PrintDecorationMethod, number> = {
  print: 0,
  dtf: 0,
  embroidery: 1,
  glitter: 2,
  metallic: 2,
  puff: 2,
};

/**
 * 0 is the comparison standard; larger is further from it. A variant with no
 * decoration evidence is the supplier's standard print, not a guess at one.
 */
export function readPrintDecorationRank(
  value: string | null | undefined,
  surface: PrintDecorationSurface
): number {
  const decoration = readPrintDecorationParts(value);
  if (!decoration) return 0;
  const { area, method } = decoration;
  if (surface !== "front-print") {
    const areaRank = FRONT_DECORATION_AREA_RANKS[area];
    return method === "print" || method === "dtf" || method === "embroidery"
      ? areaRank
      : areaRank + 1;
  }
  // Tens are the distance; units order decorations at the same distance, so
  // a front glitter print (40) comes before a back one (41) and a chest print
  // (50) before chest embroidery (51).
  const areaRank = FRONT_PRINT_AREA_RANKS[area];
  const methodFloor = FRONT_PRINT_METHOD_FLOORS[method];
  return methodFloor > areaRank
    ? methodFloor * 10 + areaRank
    : areaRank * 10 + METHOD_ORDER[method];
}

/**
 * Rank among one print method's own offers. Embroidery's standard is a chest
 * logo or a front panel on any garment, so its placements rank as a decorated
 * front does; print methods keep the surface rank, where a full front print
 * is the standard and a chest print is further away.
 */
export function readWithinMethodDecorationRank(
  value: string | null | undefined,
  surfaceRank: number
): number {
  const decoration = readPrintDecorationParts(value);
  if (decoration?.method !== "embroidery") return surfaceRank;
  return FRONT_DECORATION_AREA_RANKS[decoration.area];
}

/**
 * Among one product's variants at the same decoration rank, 0 is the
 * category's standard method and 1 another one: DTG (or an unstated print
 * technique) before a DTF transfer, and embroidery before a print on a hat.
 * Selectors apply it after the rank and before price, so a supplier that
 * offers both is priced on its standard method, while one that only prints
 * DTF still competes as the standard (owner, 2026-11-09).
 */
export function readPrintMethodPreference(
  value: string | null | undefined,
  surface: PrintDecorationSurface
): number {
  const method = readPrintDecorationParts(value)?.method;
  if (!method) return 0;
  if (surface === "front-print") return method === "dtf" ? 1 : 0;
  if (surface === "headwear") return method === "embroidery" ? 0 : 1;
  return 0;
}

const PRINT_LABELS: Record<PrintDecorationArea, string> = {
  front: "Front print",
  unstated: "Front print",
  back: "Back print",
  "front-back": "Front and back print",
  chest: "Chest print",
  pocket: "Pocket print",
  sleeve: "Sleeve print",
  neck: "Neck label print",
  other: "Print on another area",
};
const METHOD_LABELS: Record<
  Exclude<PrintDecorationMethod, "print" | "dtf">,
  string
> = {
  embroidery: "Embroidered",
  glitter: "Glitter print",
  metallic: "Metallic print",
  puff: "Puff print",
};
const AREA_PHRASES: Record<PrintDecorationArea, string> = {
  front: "",
  unstated: "",
  back: " on the back",
  "front-back": " front and back",
  chest: " on the chest",
  pocket: " on the pocket",
  sleeve: " on a sleeve",
  neck: " on the neck label",
  other: " on another area",
};

/** What a seller gets instead of the standard decoration, else `null`. */
function describePrintDecoration(
  value: string | null | undefined,
  surface: PrintDecorationSurface
): string | null {
  const decoration = readPrintDecorationParts(value);
  if (!decoration || readPrintDecorationRank(decoration.value, surface) === 0) {
    return null;
  }
  const { area, method } = decoration;
  return method === "print" || method === "dtf"
    ? PRINT_LABELS[area]
    : `${METHOD_LABELS[method]}${AREA_PHRASES[area]}`;
}

/** Why a row's price is for another decoration, or `null` for the standard. */
export function describePrintDecorationNote(
  value: string | null | undefined,
  surface: PrintDecorationSurface
): string | null {
  const label = describePrintDecoration(value, surface);
  if (!label) return null;
  return surface !== "front-print"
    ? `${label} — no front decoration offered for this option.`
    : `${label} — no front print offered for this option.`;
}
