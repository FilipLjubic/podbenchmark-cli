/* eslint-disable podbenchmark/no-runtime-typeof -- Browser-safe layout boundary parser validates every field and cross-field invariant without importing Zod. */
import { readUnknownRecord } from "../schemas/record";

type WallArtLayoutComponent = {
  widthMm: number;
  heightMm: number;
  orientation: "portrait" | "landscape" | "square";
};

type WallArtLayout = {
  kind: "wall-art-layout";
  unitKind: "layout";
  raw: string;
  quantity: number;
  components: WallArtLayoutComponent[];
};

const WALL_ART_LAYOUT_PREFIX = "wall-art:layout:v1:";

// This schema-free parser also serves picker labeling in browser import paths.
export function readWallArtLayout(value: unknown): WallArtLayout | null {
  const row = readUnknownRecord(value);
  if (
    !row ||
    row.kind !== "wall-art-layout" ||
    row.unitKind !== "layout" ||
    typeof row.raw !== "string" ||
    !row.raw.trim() ||
    !Array.isArray(row.components) ||
    row.components.length === 0 ||
    row.quantity !== row.components.length ||
    "widthMm" in row ||
    "heightMm" in row ||
    "areaMm2" in row
  )
    return null;
  const components: WallArtLayoutComponent[] = [];
  for (const item of row.components) {
    const component = readWallArtLayoutComponent(item);
    if (!component) return null;
    components.push(component);
  }
  return {
    kind: "wall-art-layout",
    unitKind: "layout",
    raw: row.raw,
    quantity: components.length,
    components,
  };
}

function readWallArtLayoutComponent(
  value: unknown
): WallArtLayoutComponent | null {
  const part = readUnknownRecord(value);
  if (
    !part ||
    typeof part.widthMm !== "number" ||
    typeof part.heightMm !== "number" ||
    !Number.isFinite(part.widthMm) ||
    !Number.isFinite(part.heightMm) ||
    part.widthMm <= 0 ||
    part.heightMm <= 0
  )
    return null;
  const orientation =
    part.widthMm === part.heightMm
      ? "square"
      : part.widthMm < part.heightMm
        ? "portrait"
        : "landscape";
  return part.orientation === orientation
    ? { widthMm: part.widthMm, heightMm: part.heightMm, orientation }
    : null;
}

export function wallArtLayoutToken(layout: WallArtLayout): string {
  return (
    WALL_ART_LAYOUT_PREFIX +
    layout.components
      .map(part => `${part.widthMm}x${part.heightMm}@${part.orientation}`)
      .join(",")
  );
}

export function readWallArtLayoutEvidence(
  value: unknown,
  token?: string | null
): boolean {
  const row = readUnknownRecord(value);
  return Boolean(
    token?.startsWith("wall-art:layout:") ||
      row?.kind === "wall-art-layout" ||
      row?.unitKind === "layout"
  );
}

/** Tokens retain the full tuple so labels need no query-specific JSON projection. */
export function readWallArtLayoutToken(token: string): WallArtLayout | null {
  if (!token.startsWith(WALL_ART_LAYOUT_PREFIX)) return null;
  const components = token
    .slice(WALL_ART_LAYOUT_PREFIX.length)
    .split(",")
    .map(part => {
      const match =
        /^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)@(portrait|landscape|square)$/.exec(
          part
        );
      return match
        ? {
            widthMm: Number(match[1]),
            heightMm: Number(match[2]),
            orientation: match[3],
          }
        : null;
    });
  const layout = readWallArtLayout({
    kind: "wall-art-layout",
    unitKind: "layout",
    raw: "Layout",
    quantity: components.length,
    components,
  });
  return layout && wallArtLayoutToken(layout) === token ? layout : null;
}
