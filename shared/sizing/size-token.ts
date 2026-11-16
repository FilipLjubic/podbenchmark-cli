import type { UnknownRecord } from "../schemas/record";
import { createClosedStringLookup } from "../kernel/closed-string-lookup";
import { deviceIdentityFromToken } from "./device-fit-identity";
import { resolveOrdinalSizeSortKey } from "./size-sort-policy";
import { readNonBlankString } from "../kernel/text";
import { ML_PER_US_FLUID_OUNCE } from "../kernel/units.ts";
import { formatCompactNumber, formatTokenLabel } from "./token-label";
import { readWallArtLayoutToken } from "./wall-art-layout";
import { captureGroup } from "../kernel/required";

/**
 * Every kind of normalized size token, defined once: how a token of the kind
 * reads, what sellers see, and where it sorts in a size picker.
 *
 * A normalized size (`home-stationery:len:318`, `apparel:adult:2xl`) is read by
 * picker labels, priced-row labels and picker order. Each used to parse tokens
 * with its own regexes, so a new token shape had to be remembered in each; a
 * shape one of them missed lost its label or order silently. A new shape is a
 * new entry here, and the type requires its label and order.
 *
 * Comparison semantics (equivalence, nearest-size fallback) stay in
 * `size-equivalence-policy.ts` and `selected-source-measurement-policy.ts`:
 * an unknown kind matches exactly only, which is the safe default.
 */

/** What a label may draw on besides the token. */
type SizeLabelContext = {
  /** The supplier's own size label (raw), or the picker label when ordering. */
  readonly displayLabel?: string | null;
  /** One priced variant's stored fact evidence (device brand and model). */
  readonly evidence?: UnknownRecord | null;
};

/**
 * Position in a size picker, smallest first, compared element by element. The
 * first element groups kinds: 0 named scales, 1 measurements, 2 capacities,
 * 3 counts, 4 device size classes.
 */
type SizeOrder = readonly number[];

type SizeTokenKind<Parts> = {
  /** The token's first segment, which routes it to this kind. */
  readonly prefix: string;
  /** The token's parts, or null when the token is not this kind. */
  readonly read: (token: string) => Parts | null;
  /** What sellers see; null only when the kind needs context it didn't get. */
  readonly label: (parts: Parts, context: SizeLabelContext) => string | null;
  /** Picker position; null orders the value by its label after ordered ones. */
  readonly order: (parts: Parts, context: SizeLabelContext) => SizeOrder | null;
};

type SizeTokenReader = (token: string) => {
  readonly label: (context: SizeLabelContext) => string | null;
  readonly order: (context: SizeLabelContext) => SizeOrder | null;
} | null;

type DefinedSizeTokenKind<Name extends string> = {
  readonly name: Name;
  readonly prefix: string;
  readonly read: SizeTokenReader;
};

/** Checks a kind against its own parts, then keeps only what the registry needs. */
function defineKind<const Name extends string, Parts>(
  name: Name,
  kind: SizeTokenKind<Parts>
): DefinedSizeTokenKind<Name> {
  return {
    name,
    prefix: kind.prefix,
    read: token => {
      const parts = kind.read(token);
      return parts === null
        ? null
        : {
            label: context => kind.label(parts, context),
            order: context => kind.order(parts, context),
          };
    },
  };
}

// ---- Measurements -------------------------------------------------------

type Dimension = { widthTenthsMm: number; heightTenthsMm: number };

function readDimension(prefix: string, token: string): Dimension | null {
  const match = /^([a-z0-9-]+):dim:(\d+)x(\d+)$/.exec(token);
  if (match?.[1] !== prefix) return null;
  return { widthTenthsMm: Number(match[2]), heightTenthsMm: Number(match[3]) };
}

function dimensionOrder({ widthTenthsMm, heightTenthsMm }: Dimension): SizeOrder {
  return [
    1,
    Math.min(widthTenthsMm, heightTenthsMm),
    Math.max(widthTenthsMm, heightTenthsMm),
    widthTenthsMm,
    heightTenthsMm,
  ];
}

function formatDimensionInches({ widthTenthsMm, heightTenthsMm }: Dimension): string {
  return `${formatInchValue(widthTenthsMm / 254)}" x ${formatInchValue(heightTenthsMm / 254)}"`;
}

/** The inches a size label shows for a length: whole inches within 0.03, else tenths. */
function labelInches(value: number): number {
  const nearestWhole = Math.round(value);
  return Math.abs(value - nearestWhole) < 0.03
    ? nearestWhole
    : Math.round(value * 10) / 10;
}

function formatInchValue(value: number): string {
  const shown = labelInches(value);
  return Number.isInteger(shown) ? String(shown) : formatCompactNumber(shown);
}

/**
 * The tenths of a millimetre a measured width or height is keyed by: the length
 * its size label shows, so one key reads as one label. Suppliers state one
 * physical size in metric, in inches to two decimals, rounded to one (A4 is
 * 210 × 297 mm, 8.27 × 11.69 in and 8.3 × 11.7 in), or measure it a millimetre
 * apart between products; a finer key would show sellers the same label twice
 * and price the suppliers on different options. Nominal inch sizes sit on the
 * grid already.
 */
export function sizeKeyTenthsMm(millimetres: number): number {
  return Math.round(labelInches(millimetres / 25.4) * 254);
}

const wallArtDimension = defineKind("wallArtDimension", {
  prefix: "wall-art",
  read: token => readDimension("wall-art", token),
  label: dimension => {
    const { widthTenthsMm: width, heightTenthsMm: height } = dimension;
    const orientation =
      width === height ? "Square" : width < height ? "Portrait" : "Landscape";
    return `${formatDimensionInches(dimension)} · ${orientation}`;
  },
  order: dimensionOrder,
});

const wallArtLayout = defineKind("wallArtLayout", {
  prefix: "wall-art",
  read: readWallArtLayoutToken,
  label: (layout, { displayLabel }) => {
    const components = layout.components
      .map(
        part =>
          `${formatCompactNumber(part.widthMm / 25.4)}" × ${formatCompactNumber(part.heightMm / 25.4)}"`
      )
      .join(", ");
    return [displayLabel?.trim(), `${layout.quantity} prints`, components]
      .filter(Boolean)
      .join(" · ");
  },
  order: () => null,
});

const homeStationeryDimension = defineKind("homeStationeryDimension", {
  prefix: "home-stationery",
  read: token => readDimension("home-stationery", token),
  label: formatDimensionInches,
  order: dimensionOrder,
});

const homeStationeryLength = defineKind("homeStationeryLength", {
  prefix: "home-stationery",
  read: token => {
    const match = /^home-stationery:len:(\d+)$/.exec(token);
    return match ? { lengthTenthsMm: Number(match[1]) } : null;
  },
  label: ({ lengthTenthsMm }) => {
    // Two decimals: pin and badge diameters are quarter inches (1.25").
    const inches = lengthTenthsMm / 254;
    const nearestWhole = Math.round(inches);
    return Math.abs(inches - nearestWhole) < 0.03
      ? `${nearestWhole}"`
      : `${String(Math.round(inches * 100) / 100)}"`;
  },
  order: ({ lengthTenthsMm }) => [1, lengthTenthsMm, lengthTenthsMm, lengthTenthsMm, lengthTenthsMm],
});

const homeStationeryPaper = defineKind("homeStationeryPaper", {
  prefix: "home-stationery",
  read: token => {
    const match = /^home-stationery:paper:([a-z0-9-]+)$/i.exec(token);
    return match ? { paper: captureGroup(match, 1).toLowerCase() } : null;
  },
  label: ({ paper }) => {
    if (/^a\d+$/.test(paper)) return paper.toUpperCase();
    if (paper === "us-letter") return "US letter";
    return formatTokenLabel(paper);
  },
  order: ({ paper }) => ordinalOrder(`home-stationery:paper:${paper}`),
});

// ---- Capacity -----------------------------------------------------------

type Capacity = { amount: number; unit: string };

const CAPACITY_RE = /^(?:pet:)?capacity:(\d+(?:\.\d+)?)([a-z]+)$/i;

function readCapacity(prefix: string, token: string): Capacity | null {
  if (!token.startsWith(`${prefix}:`)) return null;
  const match = CAPACITY_RE.exec(token);
  return match ? { amount: Number(match[1]), unit: captureGroup(match, 2).toLowerCase() } : null;
}

const lookupMillilitresPerUnit = createClosedStringLookup<number>({
  ml: 1,
  cl: 10,
  l: 1000,
  oz: ML_PER_US_FLUID_OUNCE,
});

function capacityOrder({ amount, unit }: Capacity): SizeOrder | null {
  const factor = lookupMillilitresPerUnit(unit);
  return factor === undefined ? null : [2, amount * factor];
}

function formatCapacity({ amount, unit }: Capacity): string {
  return `${formatCompactNumber(amount)} ${unit}`;
}

const capacity = defineKind("capacity", {
  prefix: "capacity",
  read: token => readCapacity("capacity", token),
  label: formatCapacity,
  order: capacityOrder,
});

// ---- Named scales -------------------------------------------------------

function ordinalOrder(token: string): SizeOrder | null {
  const key = resolveOrdinalSizeSortKey(token);
  return key
    ? [0, key.scaleRank, key.sortRank, key.lowerRank, key.upperRank]
    : null;
}

const APPAREL_SIZE_FAMILY_LABELS = {
  "adult-range": "Adult",
  headwear: "",
  "sock-range": "",
} as const satisfies Readonly<Record<string, string>>;

const lookupApparelSizeFamilyLabel = createClosedStringLookup<string>(
  APPAREL_SIZE_FAMILY_LABELS
);

/**
 * "adult:2xl" reads "Adult 2XL", "youth:ys" reads "Youth S" and
 * "baby:12-18m" reads "Baby 12–18M". Families that only name a size
 * namespace, such as headwear ranges, add no words.
 */
function formatApparelSizeLabel(parts: readonly string[]): string | null {
  const [family, ...sizes] = parts;
  if (!family) return null;

  const familyLabel =
    lookupApparelSizeFamilyLabel(family) ?? formatTokenLabel(family);
  const sizeLabels = sizes.map(size =>
    formatApparelSizeToken(
      family === "youth" ? size.replace(/^y(?=\d*x{0,3}[sml]$)/, "") : size
    )
  );
  return [familyLabel, ...sizeLabels].filter(Boolean).join(" ") || null;
}

function formatApparelSizeToken(token: string): string {
  // Letter sizes (2xl, xlt), toddler 2t, baby 18m, youth 10y and girls' 6x.
  if (/^(?:\d*x{0,3}[sml]t?|\d+[tmyx])$/.test(token)) {
    return token.toUpperCase();
  }

  const ageRange = /^(\d+)-(\d+)([tmy])$/.exec(token);
  if (ageRange) {
    return `${ageRange[1]}–${ageRange[2]}${captureGroup(ageRange, 3).toUpperCase()}`;
  }

  const letterRange = /^(\d*x{0,3}[sml])-(\d*x{0,3}[sml])$/.exec(token);
  if (letterRange) {
    return `${captureGroup(letterRange, 1).toUpperCase()}/${captureGroup(letterRange, 2).toUpperCase()}`;
  }

  return formatTokenLabel(token);
}

/** Nominal waist, with an inseam when the supplier sells both: `apparel:waist:32:inseam:30`. */
const apparelWaist = defineKind("apparelWaist", {
  prefix: "apparel",
  read: token => {
    const match = /^apparel:waist:(\d+)(?::inseam:(\d+))?$/.exec(token);
    return match
      ? { waist: Number(match[1]), inseam: match[2] ? Number(match[2]) : null }
      : null;
  },
  label: ({ waist, inseam }) =>
    inseam === null ? `Waist ${waist}` : `Waist ${waist} Inseam ${inseam}`,
  order: ({ waist, inseam }) => [0, 45_000, waist, inseam ?? 0, inseam ?? 0],
});

const apparel = defineKind("apparel", {
  prefix: "apparel",
  read: token => {
    const parts = token.toLowerCase().split(":").slice(1).filter(Boolean);
    return parts.length > 0 ? { parts } : null;
  },
  label: ({ parts }) => formatApparelSizeLabel(parts),
  order: ({ parts }) => ordinalOrder(`apparel:${parts.join(":")}`),
});

const FOOTWEAR_AUDIENCE_LABELS = {
  mens: "men's",
  womens: "women's",
  kids: "kids'",
  youth: "youth",
  unisex: "unisex",
} as const satisfies Readonly<Record<string, string>>;

const lookupFootwearAudienceLabel = createClosedStringLookup<string>(
  FOOTWEAR_AUDIENCE_LABELS
);

/** "footwear:us-womens:6" reads "US women's 6", "footwear:eu-mens:38" reads "EU men's 38". */
const footwear = defineKind("footwear", {
  prefix: "footwear",
  read: token => {
    const alpha = /^footwear:alpha:([a-z0-9]+)$/i.exec(token);
    if (alpha) return { token, label: captureGroup(alpha, 1).toUpperCase() };
    const size =
      /^footwear:(us|eu|uk)(?:-(mens|womens|kids|youth|unisex))?:(\d+(?:\.\d+)?)(?:-(\d+(?:\.\d+)?))?$/i.exec(
        token
      );
    if (!size) return null;
    const audience = size[2]
      ? lookupFootwearAudienceLabel(size[2].toLowerCase())
      : null;
    const label = [
      captureGroup(size, 1).toUpperCase(),
      audience,
      size[4] ? `${size[3]}–${size[4]}` : size[3],
    ]
      .filter(Boolean)
      .join(" ");
    return { token, label };
  },
  label: ({ label }) => label,
  order: ({ token }) => ordinalOrder(token),
});

const petSize = defineKind("petSize", {
  prefix: "pet",
  read: token => {
    const match = /^pet:size:([a-z0-9-]+)$/i.exec(token);
    return match ? { size: captureGroup(match, 1).toLowerCase() } : null;
  },
  label: ({ size }) => `Pet ${formatApparelSizeToken(size)}`,
  order: ({ size }) => ordinalOrder(`pet:size:${size}`),
});

const petCapacity = defineKind("petCapacity", {
  prefix: "pet",
  read: token => readCapacity("pet", token),
  label: formatCapacity,
  order: capacityOrder,
});

// ---- Counts and device classes -------------------------------------------

/** A jigsaw's piece count: `puzzle:pieces:252`. */
const puzzlePieces = defineKind("puzzlePieces", {
  prefix: "puzzle",
  read: token => {
    const match = /^puzzle:pieces:(\d+)$/.exec(token);
    return match ? { count: Number(match[1]) } : null;
  },
  label: ({ count }) => `${count} pieces`,
  order: ({ count }) => [3, count],
});

/** Fit tokens that name a size class rather than a device model: `13" laptop`, `38–41 mm case`. */
const deviceSizeClass = defineKind("deviceSizeClass", {
  prefix: "device-fit",
  read: token => {
    const laptop = /^device-fit:laptop-(\d+)(?:-(\d))?in$/.exec(token);
    if (laptop) {
      const inches = Number(`${laptop[1]}${laptop[2] ? `.${laptop[2]}` : ""}`);
      return { label: `${inches}" laptop`, lower: inches * 25.4, upper: inches * 25.4 };
    }
    const watchCase = /^device-fit:watch-case-(\d+)(?:-(\d+))?mm$/.exec(token);
    if (watchCase) {
      const lower = Number(watchCase[1]);
      const upper = watchCase[2] ? Number(watchCase[2]) : lower;
      return {
        label: `${lower}${watchCase[2] ? `–${upper}` : ""} mm case`,
        lower,
        upper,
      };
    }
    return null;
  },
  label: ({ label }) => label,
  order: ({ lower, upper }) => [4, lower, upper],
});

/**
 * A device model (`device-fit:iphone-16-pro` is Apple iPhone 16 Pro), named
 * from the token the way the profile builder records its fit evidence. A
 * model the token can't name keeps the evidence's own wording.
 */
const deviceModel = defineKind("deviceModel", {
  prefix: "device-fit",
  read: token => {
    const model = token.slice("device-fit:".length);
    return token.startsWith("device-fit:") && model ? { model } : null;
  },
  label: ({ model: token }, { evidence }) => {
    const identity = deviceIdentityFromToken(token);
    const model = identity?.model ?? readNonBlankString(evidence?.model);
    if (!model) return readNonBlankString(evidence?.raw);
    const brand = identity?.brand ?? readNonBlankString(evidence?.brand);
    return brand && !model.toLowerCase().startsWith(brand.toLowerCase())
      ? `${brand} ${model}`
      : model;
  },
  order: () => null,
});

// ---- Supplier-scoped selectors --------------------------------------------

export function slugifyOpaqueToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const LITERAL_SUPPLIER_ALPHA_SIZE_LABELS = new Set([
  "XXS", "XS", "S", "M", "L", "XL", "XXL", "2XL", "XXXL", "3XL", "4XL", "5XL", "6XL", "7XL",
]);

/**
 * Reviewed labels for terse supplier selectors, keyed by the owning product.
 * Evidence: Red Kap CS20 sells regular-length sizes SR-6XLR ("R" = regular
 * length; its long sizes are a separate product); Printify's MM4001 women's
 * trousers are sized 0-20 (US women's); the signet rings state "Available
 * Sizes: US 6 - 8". Choice identity is unchanged: only the wording is.
 */
type ReviewedSupplierSizeName = { label: string; scaleToken?: string };
const REVIEWED_SUPPLIER_SIZE_NAMES = {
  "printify:4073": selector => {
    const match = /^(\d*x{0,3}[sml])r$/.exec(selector);
    return match
      ? { label: `${captureGroup(match, 1).toUpperCase()} Regular`, scaleToken: captureGroup(match, 1) }
      : null;
  },
  "printify:5472": selector =>
    /^\d+$/.test(selector) ? { label: `US women's ${selector}` } : null,
  "printify:2943": selector =>
    /^\d+$/.test(selector) ? { label: `US ring size ${selector}` } : null,
  "printify:2944": selector =>
    /^\d+$/.test(selector) ? { label: `US ring size ${selector}` } : null,
} as const satisfies Readonly<
  Record<string, (selector: string) => ReviewedSupplierSizeName | null>
>;

const lookupReviewedSupplierSizeNamer = createClosedStringLookup<
  (selector: string) => ReviewedSupplierSizeName | null
>(REVIEWED_SUPPLIER_SIZE_NAMES);

function readReviewedSupplierSizeName(
  owner: string,
  selector: string
): ReviewedSupplierSizeName | null {
  return lookupReviewedSupplierSizeNamer(owner)?.(selector) ?? null;
}

/**
 * One supplier product's reviewed selector (`supplier-size:printify:957:front-mat`):
 * its identity, with no shared fit. The supplier's own wording names it, unless
 * a reviewed token renamed a terse label (Prodigi's "l" is `large`).
 */
const supplierSize = defineKind("supplierSize", {
  prefix: "supplier-size",
  read: token => {
    const match = /^supplier-size:(.+):([^:]+)$/.exec(token);
    return match ? { owner: captureGroup(match, 1), selector: captureGroup(match, 2) } : null;
  },
  label: ({ owner, selector }, { displayLabel }) => {
    const label = displayLabel?.trim();
    const reviewed = readReviewedSupplierSizeName(owner, selector);
    if (reviewed) return reviewed.label;
    if (selector.startsWith("literal-")) return label || null;
    if (label && slugifyOpaqueToken(label) === selector) return label;
    return formatTokenLabel(selector);
  },
  order: ({ owner, selector }, { displayLabel }) => {
    const scaleToken = readReviewedSupplierSizeName(owner, selector)?.scaleToken;
    if (scaleToken) return ordinalOrder(scaleToken);
    // Literal selectors hash the label; only the label can say it is a letter size.
    if (selector.startsWith("literal-")) {
      const label = displayLabel?.split(" — ")[0]?.trim().toUpperCase() ?? "";
      return LITERAL_SUPPLIER_ALPHA_SIZE_LABELS.has(label) ? ordinalOrder(label) : null;
    }
    // Letter sizes and ranges only: numeric selectors (trouser 0–20) already
    // sort by their labels, and no other scale is established for them.
    return resolveOrdinalSizeSortKey(selector)?.scale === "apparel:adult"
      ? ordinalOrder(selector)
      : null;
  },
});

// ---- Registry ------------------------------------------------------------

/**
 * Tried in order within a prefix: the specific kinds before the catch-all for
 * that prefix (apparel waist before apparel, device size classes before models).
 */
const SIZE_TOKEN_KINDS = [
  wallArtDimension,
  wallArtLayout,
  homeStationeryDimension,
  homeStationeryLength,
  homeStationeryPaper,
  capacity,
  apparelWaist,
  apparel,
  footwear,
  petSize,
  petCapacity,
  puzzlePieces,
  deviceSizeClass,
  deviceModel,
  supplierSize,
] as const;

type SizeTokenKindName = (typeof SIZE_TOKEN_KINDS)[number]["name"];

/** A token read as its kind; label and order take the context the caller has. */
type SizeTokenReading = {
  readonly kind: SizeTokenKindName;
  label(context?: SizeLabelContext): string | null;
  order(context?: SizeLabelContext): SizeOrder | null;
};

const KINDS_BY_PREFIX = (() => {
  const byPrefix = new Map<string, (typeof SIZE_TOKEN_KINDS)[number][]>();
  for (const kind of SIZE_TOKEN_KINDS) {
    const entries = byPrefix.get(kind.prefix) ?? [];
    entries.push(kind);
    byPrefix.set(kind.prefix, entries);
  }
  return byPrefix;
})();

/** The token's kind and parts, or null for a token no kind reads. */
export function readSizeToken(token: string | null | undefined): SizeTokenReading | null {
  const trimmed = token?.trim();
  if (!trimmed) return null;
  const prefix = trimmed.slice(0, trimmed.indexOf(":"));
  for (const kind of KINDS_BY_PREFIX.get(prefix) ?? []) {
    const reading = kind.read(trimmed);
    if (reading === null) continue;
    return {
      kind: kind.name,
      label: (context = {}) => reading.label(context),
      order: (context = {}) => reading.order(context),
    };
  }
  return null;
}

export function formatSizeTokenLabel(
  token: string | null | undefined,
  context: SizeLabelContext = {}
): string | null {
  return readSizeToken(token)?.label(context) ?? null;
}

export function sizeTokenOrder(
  token: string | null | undefined,
  context: SizeLabelContext = {}
): SizeOrder | null {
  return readSizeToken(token)?.order(context) ?? null;
}

// ---- Builders --------------------------------------------------------------

/** One measured length (a pin's diameter) in tenths of a millimetre. */
export function lengthSizeToken(lengthTenthsMm: number): string {
  return `home-stationery:len:${lengthTenthsMm}`;
}

export function puzzlePiecesSizeToken(count: number): string {
  return `puzzle:pieces:${count}`;
}

/** A reviewed selector of one supplier product; `productId` is lowercased. */
export function supplierSizeToken(productId: string, selector: string): string {
  return `supplier-size:${productId.trim().toLowerCase()}:${selector}`;
}

