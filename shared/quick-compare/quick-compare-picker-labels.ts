import { isSupplierUnspecifiedColorIdentity, UNSPECIFIED_COLOR_LABEL } from "../suppliers/supplier-color-identity";
import { NO_BLANK_COLOR_OPTION_NORMALIZED_VALUE } from "../options/variant-picker-profile-evidence";
import { createClosedStringLookup } from "../kernel/closed-string-lookup";
import { readUnknownRecord, type UnknownRecord } from "../schemas/record";
import { formatSizeTokenLabel } from "../sizing/size-token";
import { readNonBlankString } from "../kernel/text";
import { formatCompactNumber, formatTokenLabel } from "../sizing/token-label";

export function formatQuickComparePickerValueLabel(value: {
  field: string;
  normalizedValue: string | null;
  colorDisplayLabel?: string | null;
  sizeDisplayLabel?: string | null;
}): string | null {
  const normalizedValue = value.normalizedValue?.trim();
  if (!normalizedValue) return null;

  if (value.field === "embroideryFoam") {
    return lookupFoamLabel(normalizedValue) ?? null;
  }

  if (value.field === "color")
    return formatColorLabel(normalizedValue, value.colorDisplayLabel);

  if (value.field === "size")
    return formatSizeTokenLabel(normalizedValue, {
      displayLabel: value.sizeDisplayLabel,
    });


  if (value.field === "frameIncluded") {
    if (normalizedValue === "true") return formatFrameIncludedLabel(true);
    if (normalizedValue === "false") return formatFrameIncludedLabel(false);
  }

  if (value.field === "capacity") {
    return formatCapacityLabel(normalizedValue);
  }

  if (value.field === "quantity") {
    return formatQuantityLabel(normalizedValue);
  }

  if (value.field === "paperType") {
    return formatPaperTypeLabel(normalizedValue);
  }


  if (value.field === "frameProfile") {
    return (
      lookupFrameProfileLabel(normalizedValue.toLowerCase()) ?? formatTokenLabel(normalizedValue)
    );
  }

  if (value.field === "printType" && normalizedValue === "digital-print") {
    return "Standard digital";
  }

  if (value.field === "substrateWeightGsm") {
    return formatSubstrateWeightLabel(normalizedValue);
  }

  if (value.field === "thicknessMm" || value.field === "wrapDepthMm") {
    return formatMillimeterMeasurementLabel(normalizedValue);
  }

  return formatOptionTokenLabel(value.field, normalizedValue);
}

/**
 * A readable stand-in for a value no formatter names yet ("device-fit:laptop-13in"
 * reads "Laptop 13in"). The picker uses it so a missing formatter costs polish,
 * never the option; `mapping:health -- --sections unpickable-options` lists
 * every value that falls back here.
 */
export function formatQuickComparePickerFallbackLabel(value: {
  normalizedValue: string | null;
}): string | null {
  const normalizedValue = value.normalizedValue?.trim();
  if (!normalizedValue) return null;
  const parts = normalizedValue.split(":").filter(Boolean);
  const tokens = parts.length > 1 ? parts.slice(1) : parts;
  return tokens.map(formatTokenLabel).filter(Boolean).join(" ") || null;
}

/**
 * The size, capacity or fit one priced variant carries, named from that
 * variant's own fact. These tokens are not picker choices, so each reads its
 * own token or source evidence and never borrows a range from other variants;
 * a token with nothing to name it stays unlabeled.
 */
export function formatQuickComparePricedSizeLabel(value: {
  normalizedValue: string | null;
  /** The fact's stored source evidence: raw supplier label, device brand and model. */
  valueJson?: unknown;
}): string | null {
  const normalizedValue = value.normalizedValue?.trim();
  if (!normalizedValue) return null;
  const evidence = readUnknownRecord(value.valueJson);
  return formatSizeTokenLabel(normalizedValue, {
    displayLabel: readSupplierSizeLabel(normalizedValue, evidence),
    evidence,
  });
}

function readEvidenceText(
  evidence: UnknownRecord | null,
  key: string
): string | null {
  return readNonBlankString(evidence?.[key]);
}

/** The supplier's own label, accepted only when it belongs to this exact token. */
function readSupplierSizeLabel(
  normalizedValue: string,
  evidence: UnknownRecord | null
): string | null {
  const token = readEvidenceText(evidence, "token");
  return normalizedValue.startsWith("supplier-size:") &&
    evidence?.kind === "normalized-size-token" &&
    evidence.namespace === "supplier-size" &&
    token !== null &&
    normalizedValue === `supplier-size:${token}`
    ? readEvidenceText(evidence, "raw")
    : null;
}

const lookupPaperFamilyLabel = createClosedStringLookup<string>({
  "poster-paper": "Poster paper",
  "fine-art-paper": "Fine art paper",
});

function formatPaperTypeLabel(value: string): string {
  const family = lookupPaperFamilyLabel(value);
  if (family) return family;
  if (value === "metallic-canvas-mc") return "Metallic Canvas";
  if (value === "standard-canvas-sc") return "Standard Canvas";
  return (
    lookupArteloPosterLabel(value) ??
    formatTokenLabel(value).replace(/^Hahnemuhle\b/, "Hahnemühle")
  );
}

function formatColorLabel(
  normalizedValue: string,
  displayLabel?: string | null
): string | null {
  // A supplier-proven absent colour is matching evidence, not a colour a seller
  // picks, so copy never names it, not even as the token's own words.
  if (normalizedValue === NO_BLANK_COLOR_OPTION_NORMALIZED_VALUE) return null;
  if (isSupplierUnspecifiedColorIdentity(normalizedValue)) {
    const label = displayLabel?.trim();
    return label?.startsWith(`${UNSPECIFIED_COLOR_LABEL} — `)
      ? label
      : UNSPECIFIED_COLOR_LABEL;
  }
  const label = displayLabel?.trim();
  if (!label) return formatTokenLabel(normalizedValue);
  const token = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return token === normalizedValue ? label : formatTokenLabel(normalizedValue);
}

function formatCapacityLabel(normalizedValue: string): string {
  const capacity = /^capacity:(\d+(?:\.\d+)?)([a-z]+)$/i.exec(normalizedValue);
  const amount = capacity?.[1];
  const unit = capacity?.[2];
  return amount && unit
    ? `${formatCompactNumber(Number(amount))} ${unit.toLowerCase()}`
    : formatTokenLabel(normalizedValue);
}

function formatQuantityLabel(normalizedValue: string): string {
  const quantity = /(?:^|:)(\d+(?:\.\d+)?)$/i.exec(normalizedValue)?.[1];
  if (!quantity) return formatTokenLabel(normalizedValue);
  const count = formatCompactNumber(Number(quantity));
  // A pack, set or bundle is one purchase at one price; a bare number would
  // read as that many items ordered.
  const unit = /^quantity:([a-z0-9-]+):/i.exec(normalizedValue)?.[1];
  if (unit === "pack") return `Pack of ${count}`;
  if (unit === "set") return `Set of ${count}`;
  if (unit === "bundle") return `Bundle of ${count}`;
  if (unit === "sheet")
    return `${count} ${Number(quantity) === 1 ? "sheet" : "sheets"}`;
  return `${count} ${Number(quantity) === 1 ? "item" : "items"}`;
}

function formatSubstrateWeightLabel(normalizedValue: string): string {
  const gsm = /^(?:gsm:)?(\d+(?:\.\d+)?)$/i.exec(normalizedValue)?.[1];
  return gsm
    ? `${formatMeasurementNumber(Number(gsm), 1)} gsm`
    : formatTokenLabel(normalizedValue);
}

function formatMillimeterMeasurementLabel(normalizedValue: string): string {
  const millimeters = /^(?:mm:)?(\d+(?:\.\d+)?)$/i.exec(normalizedValue)?.[1];
  if (!millimeters) return formatTokenLabel(normalizedValue);

  const value = Number(millimeters);
  const inches = value / 25.4;
  const inchPrecision = inches < 0.1 ? 3 : 2;
  return `${formatMeasurementNumber(value, 2)} mm (${formatMeasurementNumber(
    inches,
    inchPrecision
  )}")`;
}

function formatMeasurementNumber(
  value: number,
  maximumFractionDigits: number
): string {
  if (!Number.isFinite(value)) return String(value);
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits,
  }).format(value);
}

function formatFrameIncludedLabel(value: boolean): string {
  return value ? "Framed" : "Unframed";
}

const lookupFoamLabel = createClosedStringLookup<string>({
  no: "Flat embroidery",
  full: "3D foam",
  partial: "Partly 3D foam",
});

/**
 * Print methods in the words the print-method pages use
 * (shared/data/print-tech-definitions.ts), short enough for a ticket fact.
 * Toner presses and "digital print" are digital printing; UVgel is a UV-cured
 * inkjet, so UV printing. DIGISOFT stays CustomCat's proprietary name.
 */
const lookupPrintTechnologyLabel = createClosedStringLookup<string>({
  dtg: "DTG",
  dtf: "DTF",
  "uv-dtf": "UV DTF",
  sublimation: "Sublimation",
  embroidery: "Embroidery",
  inkjet: "Inkjet",
  giclee: "Giclée",
  "digital-print": "Digital printing",
  "toner-based-digital-press": "Digital printing",
  "uv-print": "UV printing",
  uvgel: "UV printing",
  "screen-print": "Screen printing",
  "vinyl-print": "Vinyl printing",
  "photo-print": "Photo printing",
  "heat-transfer": "Heat transfer",
  "laser-engrave": "Laser engraving",
  "laser-etched": "Laser etching",
  "cut-sew": "Cut and sew",
  digisoft: "DIGISOFT",
  weaving: "Woven",
  "puff-print": "Puff print",
  "glitter-print": "Glitter print",
  "metallic-print": "Metallic print",
});

/** What an included-or-not choice reads as: the part named, never true/false. */
const lookupIncludedLabels = createClosedStringLookup<readonly [included: string, notIncluded: string]>({
  matIncluded: ["With mat", "No mat"],
  fillIncluded: ["With insert", "Cover only"],
  standIncluded: ["With stand", "No stand"],
  lidIncluded: ["With lid", "No lid"],
  leashIncluded: ["With leash", "No leash"],
  shadeRingIncluded: ["With shade ring", "No shade ring"],
  ribbonIncluded: ["With ribbon", "No ribbon"],
  backboardIncluded: ["With backboard", "No backboard"],
});

const lookupFrameProfileLabel = createClosedStringLookup<string>({
  oak: "Oak",
  premiumoak: "Premium oak",
  metal: "Metal",
  premiummetal: "Premium metal",
});

const lookupArteloPosterLabel = createClosedStringLookup<string>({
  matteposter: "Matte poster",
  glossyposter: "Glossy poster",
  semiglossposter: "Semi-gloss cardstock",
  semimattelinenposter: "Semi-matte linen",
  // Artelo's fine-art and photo stocks (artelo.com fine-art and photo printing pages).
  archivalmattefineart: "Archival matte",
  coldpressfineart: "Cold press",
  hotpressfineart: "Hot press",
  germanetchingfineart: "German etching",
  watercolorfineart: "Watercolor",
  velvetfineart: "Velvet",
  pearlfineart: "Pearl",
  ragsatinphoto: "Rag satin photo",
  glossyphoto: "Glossy photo",
  lusterphoto: "Luster photo",
  mattephoto: "Matte photo",
  pearlphoto: "Pearl photo",
  semimattephoto: "Semi-matte photo",
  // Artelo's canvas stocks (artelo.com canvas printing page).
  satincanvas: "Satin canvas",
  archivalsemimattecanvas: "Archival semi-matte canvas",
});

function formatOptionTokenLabel(field: string, value: string): string {
  if (field === "deviceFit")
    return formatSizeTokenLabel(`device-fit:${value.replace(/^device-fit:/, "")}`) ?? formatTokenLabel(value);
  // Prodigi's canvas without its optional gloss varnish; the surface it leaves is not stated.
  if (field === "finish" && value === "none") return "Unvarnished";
  if (field === "printTechnology") return lookupPrintTechnologyLabel(value) ?? formatTokenLabel(value);
  const included = lookupIncludedLabels(field);
  if (included && value === "true") return included[0];
  if (included && value === "false") return included[1];
  return formatTokenLabel(value);
}
