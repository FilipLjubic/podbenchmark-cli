import type { ColorFamily } from "../data/color-families";
import { createClosedStringLookup } from "../kernel/closed-string-lookup";
import { srgbHexToOklab } from "./oklab";

/**
 * Bump whenever any color's family or texture can change: picker evidence
 * stores each shade's family, and its projection version includes this one,
 * so a bump re-materializes the stored families.
 */
export const PICKER_COLOR_CLASSIFIER_VERSION = "2026-11-07.1";

/**
 * The classifier before swatch-less colors kept a family from their name.
 * Its stored evidence stays readable (see the readable projection versions).
 */
export const PREVIOUS_PICKER_COLOR_CLASSIFIER_VERSION = "2026-10-27.1";

/**
 * How a color option looks beyond its hue. A seller who asks for "red"
 * expects a plain red; heathers, washes and patterns look different and are
 * often a different fabric, so they stand in for a solid only when their
 * swatch is near-identical.
 */
const PICKER_COLOR_TEXTURES = [
  "solid",
  "heather",
  "washed",
  "pattern",
] as const;

export type PickerColorTexture = (typeof PICKER_COLOR_TEXTURES)[number];

/**
 * Two solids or two heathers of one family can stand in for each other at
 * any distance; a washed shade or a pattern stands in only for a
 * near-identical swatch.
 */
export const INTERCHANGEABLE_PICKER_COLOR_TEXTURES: ReadonlySet<PickerColorTexture> =
  new Set(["solid", "heather"]);

export type PickerColorClass = {
  /** Null when the option is not a color a seller would filter by. */
  family: ColorFamily | null;
  texture: PickerColorTexture;
};

const PATTERN =
  /\b(tie ?dye[sd]?|dip ?dye[sd]?|spiral|camo|camouflage|cyclone|rainbow|multi(?:colou?r)?|stripes?|striped|plaid|leopard|floral|swirl|ombre|galaxy|scrunch|reverse dye|color ?block|colou?rblock|psychedelic)\b/;
const HEATHER =
  /\b(antique|heathers?|heathered|melange|mélange|tri ?blend|triblend|cvc|slub|marbled?|speckled?|flecked?|marled?|mock twist)\b/;
const WASHED =
  /\b(vintage|garment ?dyed|pigment(?: dyed)?|acid ?wash(?:ed)?|mineral ?wash(?:ed)?|stone ?wash(?:ed)?|washed|enzyme|vintage wash|snow ?wash(?:ed)?|faded)\b/;
/** Words that describe the yarn or dye rather than the color. */
const TEXTURE_WORDS = new RegExp(
  `${HEATHER.source}|${WASHED.source}|\\b(solid|blend|dyed)\\b`,
  "g"
);

/**
 * The color word a name ends on usually names its family ("Kelly Green",
 * "Cherry Red"); these words decide before the hue does.
 */
const COLOR_WORD_FAMILIES = {
  white: "white",
  snow: "white",
  pfd: "white",
  optic: "white",
  black: "black",
  jet: "black",
  onyx: "black",
  ebony: "black",
  caviar: "black",
  grey: "gray",
  gray: "gray",
  charcoal: "gray",
  ash: "gray",
  silver: "gray",
  slate: "gray",
  graphite: "gray",
  pewter: "gray",
  gunmetal: "gray",
  smoke: "gray",
  steel: "gray",
  cement: "gray",
  concrete: "gray",
  asphalt: "gray",
  granite: "gray",
  pebble: "gray",
  storm: "gray",
  iron: "gray",
  carbon: "gray",
  lead: "gray",
  coal: "gray",
  dove: "gray",
  platinum: "gray",
  navy: "navy",
  midnight: "navy",
  oxford: "navy",
  ink: "navy",
  insignia: "navy",
  dusk: "navy",
  blue: "blue",
  royal: "blue",
  cobalt: "blue",
  sapphire: "blue",
  azure: "blue",
  sky: "blue",
  denim: "blue",
  indigo: "blue",
  turquoise: "blue",
  aqua: "blue",
  teal: "blue",
  cyan: "blue",
  carolina: "blue",
  columbia: "blue",
  chambray: "blue",
  ocean: "blue",
  saltwater: "blue",
  glacier: "blue",
  pacific: "blue",
  liberty: "blue",
  lagoon: "blue",
  cornflower: "blue",
  periwinkle: "blue",
  red: "red",
  cardinal: "red",
  maroon: "red",
  burgundy: "red",
  garnet: "red",
  wine: "red",
  cherry: "red",
  crimson: "red",
  scarlet: "red",
  ruby: "red",
  cranberry: "red",
  brick: "red",
  merlot: "red",
  oxblood: "red",
  bordeaux: "red",
  claret: "red",
  chili: "red",
  tomato: "red",
  rouge: "red",
  cherrywood: "red",
  green: "green",
  kelly: "green",
  forest: "green",
  olive: "green",
  military: "green",
  army: "green",
  sage: "green",
  mint: "green",
  lime: "green",
  emerald: "green",
  jade: "green",
  hunter: "green",
  moss: "green",
  pine: "green",
  kiwi: "green",
  pistachio: "green",
  seafoam: "green",
  celadon: "green",
  fern: "green",
  avocado: "green",
  eucalyptus: "green",
  cypress: "green",
  aloe: "green",
  agave: "green",
  loden: "green",
  spruce: "green",
  juniper: "green",
  basil: "green",
  cactus: "green",
  ivy: "green",
  clover: "green",
  shamrock: "green",
  matcha: "green",
  peppermint: "green",
  pickle: "green",
  wasabi: "green",
  artichoke: "green",
  yellow: "yellow",
  citrine: "yellow",
  gold: "yellow",
  mustard: "yellow",
  lemon: "yellow",
  butter: "yellow",
  daisy: "yellow",
  banana: "yellow",
  sunflower: "yellow",
  canary: "yellow",
  maize: "yellow",
  citrus: "yellow",
  orange: "orange",
  tangerine: "orange",
  pumpkin: "orange",
  peach: "orange",
  apricot: "orange",
  mango: "orange",
  rust: "orange",
  copper: "orange",
  terracotta: "orange",
  cantaloupe: "orange",
  papaya: "orange",
  persimmon: "orange",
  sunset: "orange",
  coral: "orange",
  melon: "orange",
  peachy: "orange",
  peche: "orange",
  terracota: "orange",
  fiesta: "orange",
  purple: "purple",
  violet: "purple",
  lavender: "purple",
  lilac: "purple",
  plum: "purple",
  eggplant: "purple",
  grape: "purple",
  orchid: "purple",
  amethyst: "purple",
  mauve: "purple",
  berry: "purple",
  boysenberry: "purple",
  lilak: "purple",
  aubergine: "purple",
  pink: "pink",
  fuchsia: "pink",
  magenta: "pink",
  rose: "pink",
  blush: "pink",
  salmon: "pink",
  azalea: "pink",
  raspberry: "pink",
  heliconia: "pink",
  bubblegum: "pink",
  flamingo: "pink",
  blossom: "pink",
  peony: "pink",
  crunchberry: "pink",
  fuschia: "pink",
  brown: "brown",
  chocolate: "brown",
  espresso: "brown",
  coffee: "brown",
  mocha: "brown",
  chestnut: "brown",
  cocoa: "brown",
  walnut: "brown",
  mahogany: "brown",
  cognac: "brown",
  caramel: "brown",
  cinnamon: "brown",
  sepia: "brown",
  umber: "brown",
  latte: "brown",
  adobe: "brown",
  cacao: "brown",
  sienna: "brown",
  sand: "neutral",
  natural: "neutral",
  cream: "neutral",
  ivory: "neutral",
  oatmeal: "neutral",
  oat: "neutral",
  bone: "neutral",
  ecru: "neutral",
  stone: "neutral",
  camel: "neutral",
  taupe: "neutral",
  tan: "neutral",
  beige: "neutral",
  nude: "neutral",
  linen: "neutral",
  vanilla: "neutral",
  biscuit: "neutral",
  desert: "neutral",
  dune: "neutral",
  wheat: "neutral",
  putty: "neutral",
  champagne: "neutral",
  parchment: "neutral",
  eggshell: "neutral",
  khaki: "neutral",
  dust: "neutral",
  mushroom: "neutral",
  sandshell: "neutral",
  shell: "neutral",
  coconut: "neutral",
  safari: "neutral",
  clear: null,
  transparent: null,
  frosted: null,
} satisfies Record<string, ColorFamily | null>;

const lookupColorWordFamily = createClosedStringLookup<ColorFamily | null>(
  COLOR_WORD_FAMILIES
);

/** These words win over a trailing generic one: "Navy Blue", "Black Heather". */
const DOMINANT_COLOR_WORDS = ["navy", "midnight", "black"] as const;

/**
 * Pale words that also follow a stronger color: "Banana Cream" is a yellow,
 * "Grey Stone" a gray. They decide only when nothing else does.
 */
const WEAK_COLOR_WORDS = new Set([
  "smoke",
  "storm",
  "oatmeal",
  "stone",
  "cream",
  "natural",
  "sand",
  "shell",
  "dust",
  "ivory",
  "bone",
]);

/**
 * Reviewed decisions for names the word and hue rules get wrong, keyed by
 * the normalized name.
 */
const REVIEWED_COLOR_CLASSES = {
  "ink blue": { family: "navy" },
  "india ink grey": { family: "gray" },
  "dark blue": { family: "navy" },
  // Names without a color word whose suppliers' swatches fall in different
  // families, so each supplier would sort the same name apart.
  "athletic heather": { family: "gray" },
  ballerina: { family: "pink" },
  burro: { family: "neutral" },
  clay: { family: "brown" },
  "french oak": { family: "neutral" },
  hemp: { family: "green" },
  hibiscus: { family: "pink" },
  hydrangea: { family: "blue" },
  iris: { family: "purple" },
  lapis: { family: "blue" },
  paprika: { family: "red" },
  sandstone: { family: "neutral" },
} satisfies Record<string, Partial<PickerColorClass>>;

const lookupReviewedColorClass = createClosedStringLookup<
  Partial<PickerColorClass>
>(REVIEWED_COLOR_CLASSES);

function normalizePickerColorName(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9/&+ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Sort a picker color into one of the shared color families and a texture,
 * from the name a seller reads first and the swatch when the name has no
 * color word.
 */
export function classifyPickerColor(input: {
  label: string;
  hexes: readonly string[];
}): PickerColorClass {
  const name = normalizePickerColorName(input.label);
  const reviewed = lookupReviewedColorClass(name);
  const detected = detectTextureAndFamily(name, input.hexes);
  return {
    family:
      reviewed?.family !== undefined ? reviewed.family : detected.family,
    texture: reviewed?.texture ?? detected.texture,
  };
}

function detectTextureAndFamily(
  name: string,
  hexes: readonly string[]
): PickerColorClass {
  // "Navy/White" belongs with the navies but never stands in for a plain
  // navy; "Black/Black" is just black.
  const sides = name.split(/\s*(?:\/|&|\+|\band\b)\s*/).filter(Boolean);
  const sideFamilies = sides.map(side => wordFamily(stripTexture(side)));
  const twoTone = new Set(sides).size > 1;
  if (twoTone || PATTERN.test(name)) {
    const main = twoTone
      ? sideFamilies.find(family => family !== undefined)
      : wordFamily(stripTexture(name.replace(PATTERN, " ")));
    return { family: main ?? "multicolor", texture: "pattern" };
  }
  const texture: PickerColorTexture = HEATHER.test(name)
    ? "heather"
    : WASHED.test(name)
      ? "washed"
      : "solid";
  const family = wordFamily(stripTexture(name));
  return {
    family: family === undefined ? familyFromHexes(hexes) : family,
    texture,
  };
}

function stripTexture(name: string): string {
  return name.replace(TEXTURE_WORDS, " ").replace(/\s+/g, " ").trim();
}

/** Undefined when no word names a color; null when a word names a non-color. */
function wordFamily(name: string): ColorFamily | null | undefined {
  const words = name.split(/[\s/&+]+/).filter(Boolean);
  const dominant = DOMINANT_COLOR_WORDS.find(word => words.includes(word));
  if (dominant) return lookupColorWordFamily(dominant);
  const strong: (ColorFamily | null)[] = [];
  const weak: (ColorFamily | null)[] = [];
  for (const word of words) {
    const family = lookupColorWordFamily(word);
    if (family === undefined) continue;
    (WEAK_COLOR_WORDS.has(word) ? weak : strong).push(family);
  }
  if (strong.length > 0) return strong.at(-1);
  return weak.at(-1);
}

/**
 * Family of a swatch from its OKLCH lightness, chroma and hue. The supplier
 * shades of one option differ, so the median shade decides.
 */
function familyFromHexes(hexes: readonly string[]): ColorFamily | null {
  const colors = hexes.flatMap(hex => {
    const lab = srgbHexToOklab(hex);
    return lab ? [lab] : [];
  });
  if (colors.length === 0) return null;
  const median = (values: number[]) => {
    const sorted = [...values].sort((left, right) => left - right);
    return sorted[Math.floor(sorted.length / 2)] ?? 0;
  };
  const lightness = median(colors.map(color => color.lightness));
  const a = median(colors.map(color => color.a));
  const b = median(colors.map(color => color.b));
  return familyFromOklch({
    lightness,
    chroma: Math.hypot(a, b),
    hue: ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360,
  });
}

/**
 * Hue bands in OKLCH degrees, each with the family a light and a dark shade
 * of it reads as: light reds read pink, dark blues read navy.
 */
const HUE_BANDS: readonly {
  below: number;
  family: ColorFamily;
  /** Lighter than `lightAbove` reads as this family instead. */
  light?: { above: number; family: ColorFamily };
  /** Darker than `darkBelow` reads as this family instead. */
  dark?: { below: number; family: ColorFamily };
}[] = [
  { below: 20, family: "red", light: { above: 0.75, family: "pink" } },
  { below: 45, family: "red", light: { above: 0.68, family: "orange" } },
  { below: 80, family: "orange" },
  { below: 115, family: "yellow" },
  { below: 180, family: "green" },
  { below: 230, family: "blue" },
  { below: 290, family: "blue", dark: { below: 0.4, family: "navy" } },
  { below: 330, family: "purple", light: { above: 0.72, family: "pink" } },
  { below: 350, family: "purple", light: { above: 0.6, family: "pink" } },
  { below: 361, family: "red", light: { above: 0.75, family: "pink" } },
];

function familyFromOklch(color: {
  lightness: number;
  chroma: number;
  hue: number;
}): ColorFamily {
  const { lightness, chroma, hue } = color;
  if (chroma < 0.03) {
    if (lightness > 0.95) return "white";
    return lightness < 0.3 ? "black" : "gray";
  }
  if (hue >= 40 && hue < 110 && chroma < 0.09 && lightness > 0.7) {
    return "neutral";
  }
  if (hue >= 20 && hue < 100 && lightness < 0.55 && chroma < 0.16) {
    return "brown";
  }
  const band = HUE_BANDS.find(candidate => hue < candidate.below) ?? HUE_BANDS[0]!;
  if (band.light && lightness > band.light.above) return band.light.family;
  if (band.dark && lightness < band.dark.below) return band.dark.family;
  return band.family;
}
