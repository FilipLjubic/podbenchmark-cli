const SIZE_SORT_RANK_GAP = 1_000;

export type OrdinalSizeSortKey = {
  readonly scale: string;
  readonly scaleRank: number;
  readonly sortRank: number;
  readonly lowerRank: number;
  readonly upperRank: number;
};

type RankRange = {
  readonly lowerRank: number;
  readonly upperRank: number;
};

const SIZE_SCALE_RANKS = new Map<string, number>([
  ["apparel:adult", 1_000],
  ["apparel:adult-tall", 2_000],
  ["apparel:youth", 3_000],
  ["apparel:toddler", 4_000],
  ["apparel:baby", 5_000],
  ["apparel:one-size", 6_000],
  ["paper:iso-a", 7_000],
  ["paper:us", 8_000],
  ["footwear:alpha", 9_000],
  ["footwear:us", 10_000],
  ["footwear:us-mens", 11_000],
  ["footwear:us-womens", 12_000],
  ["footwear:us-kids", 13_000],
  ["footwear:us-youth", 14_000],
  ["footwear:us-unisex", 15_000],
  ["footwear:uk", 20_000],
  ["footwear:uk-mens", 21_000],
  ["footwear:uk-womens", 22_000],
  ["footwear:uk-kids", 23_000],
  ["footwear:uk-youth", 24_000],
  ["footwear:uk-unisex", 25_000],
  ["footwear:eu", 30_000],
  ["footwear:eu-mens", 31_000],
  ["footwear:eu-womens", 32_000],
  ["footwear:eu-kids", 33_000],
  ["footwear:eu-youth", 34_000],
  ["footwear:eu-unisex", 35_000],
  ["pet:size", 40_000],
]);

const ADULT_SIZE_RANKS = new Map<string, number>([
  ["xxs", 1_000],
  ["xs", 2_000],
  ["s", 3_000],
  ["m", 4_000],
  ["l", 5_000],
  ["xl", 6_000],
  ["2xl", 7_000],
  ["3xl", 8_000],
  ["4xl", 9_000],
  ["5xl", 10_000],
  ["6xl", 11_000],
  ["7xl", 12_000],
]);

const ADULT_TALL_SIZE_RANKS = new Map<string, number>([
  ["lt", 1_000],
  ["xlt", 2_000],
  ["2xlt", 3_000],
  ["3xlt", 4_000],
  ["4xlt", 5_000],
]);

const YOUTH_ALPHA_SIZE_RANKS = new Map<string, number>([
  ["y2xs", 500],
  ["yxs", 1_000],
  ["ys", 2_000],
  ["ym", 3_000],
  ["yl", 4_000],
  ["yxl", 5_000],
  ["y2xl", 6_000],
]);

const ISO_PAPER_SIZE_RANKS = new Map<string, number>([
  ["a5", 1_000],
  ["a5-long", 1_500],
  ["a4", 2_000],
  ["a3", 3_000],
  ["a2", 4_000],
  ["a1", 5_000],
  ["a0", 6_000],
]);

const US_PAPER_SIZE_RANKS = new Map<string, number>([
  ["letter", 1_000],
  ["legal", 2_000],
  ["tabloid", 3_000],
  ["ledger", 3_000],
]);

const SIZE_TOKEN_ALIASES = new Map<string, string>([
  ["extra-extra-small", "xxs"],
  ["2x-small", "xxs"],
  ["2xs", "xxs"],
  ["xx-small", "xxs"],
  ["extra-small", "xs"],
  ["x-small", "xs"],
  ["small", "s"],
  ["medium", "m"],
  ["large", "l"],
  ["extra-large", "xl"],
  ["x-large", "xl"],
  ["xxl", "2xl"],
  ["xxxl", "3xl"],
  ["xxxxl", "4xl"],
  ["xxxxxl", "5xl"],
  ["xxxxxxl", "6xl"],
  ["xxxxxxxl", "7xl"],
  ["onesize", "one-size"],
  ["os", "one-size"],
  ["osfa", "one-size"],
  ["o-s", "one-size"],
]);

const APPAREL_ADULT_SYSTEMS = new Set([
  "adult",
  "adult-range",
  "alpha",
  "headwear",
  "sock-range",
]);

/**
 * Returns a display-only order for named size scales.
 *
 * Ranks are deliberately sparse so a new size can be inserted without
 * renumbering the scale. A range uses the midpoint of its endpoint ranks, so
 * S/M naturally lands at 3,500 between S (3,000) and M (4,000).
 *
 * These ranks are ordinal UI policy. Rank differences must never be used as
 * evidence that two sizes fit alike or as nearest-size matching distance.
 */
export function resolveOrdinalSizeSortKey(
  value: string
): OrdinalSizeSortKey | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const parts = trimmed
    .toLowerCase()
    .split(":")
    .map(part => part.trim())
    .filter(Boolean);

  if (parts[0] === "apparel") {
    return resolveApparelSizeSortKey(parts);
  }

  if (parts[0] === "footwear") {
    return resolveFootwearSizeSortKey(parts);
  }

  if (parts[0] === "pet") {
    return resolvePetSizeSortKey(parts);
  }

  if (parts[0] === "home-stationery" && parts[1] === "paper") {
    return resolvePaperSizeSortKey(parts[2] ?? "");
  }

  if (parts.length > 1) {
    return null;
  }

  return resolveUnscopedSizeSortKey(trimmed);
}

export function compareOrdinalSizeSortKeys(
  left: OrdinalSizeSortKey,
  right: OrdinalSizeSortKey
): number {
  return (
    left.scaleRank - right.scaleRank ||
    left.sortRank - right.sortRank ||
    left.lowerRank - right.lowerRank ||
    left.upperRank - right.upperRank ||
    left.scale.localeCompare(right.scale)
  );
}

function resolveApparelSizeSortKey(
  parts: readonly string[]
): OrdinalSizeSortKey | null {
  if (parts.length === 2 && parts[1] === "one-size") {
    return buildSortKey("apparel:one-size", {
      lowerRank: 1_000,
      upperRank: 1_000,
    });
  }

  const system = parts[1];
  const token = parts.slice(2).join(":");
  if (!system || !token) return null;

  if (APPAREL_ADULT_SYSTEMS.has(system)) {
    return buildSortKey(
      "apparel:adult",
      resolveMappedRankRange(token, ADULT_SIZE_RANKS)
    );
  }

  if (system === "adult-tall") {
    return buildSortKey(
      "apparel:adult-tall",
      resolveMappedRankRange(token, ADULT_TALL_SIZE_RANKS)
    );
  }

  if (system === "youth") {
    return buildSortKey("apparel:youth", resolveYouthRankRange(token));
  }

  if (system === "toddler") {
    return buildSortKey("apparel:toddler", resolveToddlerRankRange(token));
  }

  if (system === "baby") {
    return buildSortKey("apparel:baby", resolveBabyRankRange(token));
  }

  if (system === "one-size") {
    return buildSortKey("apparel:one-size", {
      lowerRank: 1_000,
      upperRank: 1_000,
    });
  }

  if (system === "generic") {
    return resolveUnscopedSizeSortKey(token);
  }

  return null;
}

function resolveFootwearSizeSortKey(
  parts: readonly string[]
): OrdinalSizeSortKey | null {
  const system = parts[1];
  const token = parts.slice(2).join(":");
  if (!system || !token) return null;

  const scale = `footwear:${system}`;
  if (system === "alpha") {
    return buildSortKey(
      scale,
      resolveMappedRankRange(token, ADULT_SIZE_RANKS)
    );
  }

  return buildSortKey(scale, resolveNumericFootwearRankRange(token));
}

function resolvePetSizeSortKey(
  parts: readonly string[]
): OrdinalSizeSortKey | null {
  if (parts[1] !== "size") return null;
  const token = parts.slice(2).join(":");
  if (!token) return null;

  return buildSortKey(
    "pet:size",
    resolveMappedRankRange(token, ADULT_SIZE_RANKS)
  );
}

function resolveUnscopedSizeSortKey(
  value: string
): OrdinalSizeSortKey | null {
  const token = canonicalizeSizeToken(value);

  return (
    buildSortKey(
      "apparel:adult",
      resolveMappedRankRange(token, ADULT_SIZE_RANKS)
    ) ??
    buildSortKey(
      "apparel:adult-tall",
      resolveMappedRankRange(token, ADULT_TALL_SIZE_RANKS)
    ) ??
    buildSortKey("apparel:youth", resolveYouthRankRange(token)) ??
    buildSortKey("apparel:toddler", resolveToddlerRankRange(token)) ??
    buildSortKey("apparel:baby", resolveBabyRankRange(token)) ??
    resolveOneSizeSortKey(token) ??
    resolvePaperSizeSortKey(token)
  );
}

function resolveOneSizeSortKey(
  token: string
): OrdinalSizeSortKey | null {
  if (token !== "one-size" && token !== "standard") {
    return null;
  }

  const rank = token === "one-size" ? 1_000 : 2_000;
  return buildSortKey("apparel:one-size", {
    lowerRank: rank,
    upperRank: rank,
  });
}

function resolvePaperSizeSortKey(
  rawToken: string
): OrdinalSizeSortKey | null {
  const token = normalizeSizeToken(rawToken);
  const isoRank = ISO_PAPER_SIZE_RANKS.get(token);
  if (isoRank !== undefined) {
    return buildSortKey("paper:iso-a", {
      lowerRank: isoRank,
      upperRank: isoRank,
    });
  }

  const usRank = US_PAPER_SIZE_RANKS.get(token);
  if (usRank === undefined) return null;

  return buildSortKey("paper:us", {
    lowerRank: usRank,
    upperRank: usRank,
  });
}

function resolveMappedRankRange(
  rawToken: string,
  ranks: ReadonlyMap<string, number>
): RankRange | null {
  const token = canonicalizeSizeToken(rawToken);
  const exactRank = ranks.get(token);
  if (exactRank !== undefined) {
    return {
      lowerRank: exactRank,
      upperRank: exactRank,
    };
  }

  const endpoints = token.split("-");
  if (endpoints.length !== 2) return null;

  const lowerRank = ranks.get(endpoints[0] ?? "");
  const upperRank = ranks.get(endpoints[1] ?? "");
  if (
    lowerRank === undefined ||
    upperRank === undefined ||
    lowerRank >= upperRank
  ) {
    return null;
  }

  return { lowerRank, upperRank };
}

function resolveYouthRankRange(rawToken: string): RankRange | null {
  const token = canonicalizeSizeToken(rawToken);
  const alphaRank = YOUTH_ALPHA_SIZE_RANKS.get(token);
  if (alphaRank !== undefined) {
    return {
      lowerRank: alphaRank,
      upperRank: alphaRank,
    };
  }

  if (token === "6x") {
    return {
      lowerRank: 16_500,
      upperRank: 16_500,
    };
  }

  const match = /^(\d+(?:\.\d+)?)(?:-(\d+(?:\.\d+)?))?y$/.exec(token);
  if (!match) return null;

  return buildNumericRange(match[1], match[2], 10_000);
}

function resolveToddlerRankRange(rawToken: string): RankRange | null {
  const token = canonicalizeSizeToken(rawToken);
  const match = /^(\d+(?:\.\d+)?)(?:-(\d+(?:\.\d+)?))?t$/.exec(token);
  if (!match) return null;

  return buildNumericRange(match[1], match[2]);
}

function resolveBabyRankRange(rawToken: string): RankRange | null {
  const token = canonicalizeSizeToken(rawToken);
  if (token === "preemie") {
    return { lowerRank: 1_000, upperRank: 1_000 };
  }
  if (token === "newborn") {
    return { lowerRank: 2_000, upperRank: 2_000 };
  }

  const match = /^(\d+(?:\.\d+)?)(?:-(\d+(?:\.\d+)?))?m$/.exec(token);
  if (!match) return null;

  return buildNumericRange(match[1], match[2], 3_000);
}

function resolveNumericFootwearRankRange(
  rawToken: string
): RankRange | null {
  const token = normalizeSizeToken(rawToken);
  const match =
    /^(\d+(?:\.\d+)?)(?:-(\d+(?:\.\d+)?))?(?:-[a-z]+)?$/.exec(token);
  if (!match) return null;

  return buildNumericRange(match[1], match[2]);
}

function buildNumericRange(
  rawLower: string | undefined,
  rawUpper: string | undefined,
  baseRank = 0
): RankRange | null {
  const lowerValue = Number(rawLower);
  const upperValue = rawUpper === undefined ? lowerValue : Number(rawUpper);
  if (
    !Number.isFinite(lowerValue) ||
    !Number.isFinite(upperValue) ||
    lowerValue > upperValue
  ) {
    return null;
  }

  return {
    lowerRank: baseRank + lowerValue * SIZE_SORT_RANK_GAP,
    upperRank: baseRank + upperValue * SIZE_SORT_RANK_GAP,
  };
}

function buildSortKey(
  scale: string,
  range: RankRange | null
): OrdinalSizeSortKey | null {
  if (!range) return null;
  const scaleRank = SIZE_SCALE_RANKS.get(scale);
  if (scaleRank === undefined) return null;

  return {
    scale,
    scaleRank,
    sortRank: (range.lowerRank + range.upperRank) / 2,
    lowerRank: range.lowerRank,
    upperRank: range.upperRank,
  };
}

function canonicalizeSizeToken(value: string): string {
  const token = normalizeSizeToken(value);
  return SIZE_TOKEN_ALIASES.get(token) ?? token;
}

function normalizeSizeToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[‐‑‒–—―/]+/g, "-")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
