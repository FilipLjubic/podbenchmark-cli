import { normalizeColorHex } from "./normalize-color";

export type OklabColor = Readonly<{
  lightness: number;
  a: number;
  b: number;
}>;

/**
 * Converts a six-digit sRGB swatch to OKLab using the CSS Color 4 reference
 * matrices. This primitive deliberately does not define an acceptable matching
 * distance; that boundary belongs to reviewed selected-source policy.
 *
 * @see https://www.w3.org/TR/css-color-4/#color-conversion-code
 */
export function srgbHexToOklab(hex: string): OklabColor | null {
  const normalizedHex = normalizeColorHex(hex);
  if (!normalizedHex) return null;

  const red = decodeSrgbChannel(normalizedHex.slice(1, 3));
  const green = decodeSrgbChannel(normalizedHex.slice(3, 5));
  const blue = decodeSrgbChannel(normalizedHex.slice(5, 7));

  const x =
    (506752 / 1228815) * red +
    (87881 / 245763) * green +
    (12673 / 70218) * blue;
  const y =
    (87098 / 409605) * red +
    (175762 / 245763) * green +
    (12673 / 175545) * blue;
  const z =
    (7918 / 409605) * red +
    (87881 / 737289) * green +
    (1001167 / 1053270) * blue;

  const l = Math.cbrt(
    0.819022437996703 * x +
      0.3619062600528904 * y -
      0.1288737815209879 * z
  );
  const m = Math.cbrt(
    0.0329836539323885 * x +
      0.9292868615863434 * y +
      0.0361446663506424 * z
  );
  const s = Math.cbrt(
    0.0481771893596242 * x +
      0.2642395317527308 * y +
      0.6335478284694309 * z
  );

  return {
    lightness:
      0.210454268309314 * l +
      0.7936177747023054 * m -
      0.0040720430116193 * s,
    a:
      1.9779985324311684 * l -
      2.42859224204858 * m +
      0.450593709617411 * s,
    b:
      0.0259040424655478 * l +
      0.7827717124575296 * m -
      0.8086757549230774 * s,
  };
}

/** CSS Color 4 Delta E OK: Euclidean distance in OKLab coordinates. */
export function oklabDelta(left: OklabColor, right: OklabColor): number {
  return Math.hypot(
    left.lightness - right.lightness,
    left.a - right.a,
    left.b - right.b
  );
}

export function srgbHexOklabDelta(
  leftHex: string,
  rightHex: string
): number | null {
  const left = srgbHexToOklab(leftHex);
  const right = srgbHexToOklab(rightHex);
  return left && right ? oklabDelta(left, right) : null;
}

function decodeSrgbChannel(hexPair: string): number {
  const gammaEncoded = Number.parseInt(hexPair, 16) / 255;
  return gammaEncoded <= 0.04045
    ? gammaEncoded / 12.92
    : ((gammaEncoded + 0.055) / 1.055) ** 2.4;
}
