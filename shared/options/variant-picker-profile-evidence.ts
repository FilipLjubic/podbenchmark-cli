import { isSupplierUnspecifiedColorIdentity, supplierUnspecifiedColorIdentity, UNSPECIFIED_COLOR_SOURCE, UNSPECIFIED_COLOR_EVIDENCE_PATH, UNSPECIFIED_COLOR_LABEL } from "../suppliers/supplier-color-identity";
import { readUnknownRecord, type UnknownRecord } from "../schemas/record";
import { createNormalizedVariantSizeValue } from "../sizing/variant-size-normalization";
import { resolveProductScopedSizeNormalizationRule } from "../sizing/size-normalization-registry";
import { HEADWEAR_MATCHING_CATEGORIES } from "./variant-picker-policy";
import { isNonBlankString, isTextValue } from "../kernel/text";

export type VariantPickerProfileEvidence = {
  field: string;
  normalizedValue: string | null;
  originScope: string | null;
  normalizationStatus: string | null;
  valueJson: unknown;
  source?: string | null;
  evidencePath?: string | null;
};

export const NO_BLANK_COLOR_OPTION_KIND = "no-blank-color-option";
export const NO_BLANK_COLOR_OPTION_NORMALIZED_VALUE =
  `color:${NO_BLANK_COLOR_OPTION_KIND}`;

/**
 * A supplier-proven absent color choice is matching evidence, not a color a seller
 * picks: where the color control is optional it takes no part in an option's identity.
 */
export function isAbsentColorChoice(value: {
  field: string;
  normalizedValue: string | null;
}): boolean {
  return (
    value.field === "color" &&
    value.normalizedValue === NO_BLANK_COLOR_OPTION_NORMALIZED_VALUE
  );
}

export function isTShirtPickerProfileEvidenceReady(
  evidence: VariantPickerProfileEvidence,
  owner?: VariantPickerProfileOwner
): boolean {
  const valueJson = readUnknownRecord(evidence.valueJson);
  if (
    evidence.originScope !== "variant" ||
    evidence.normalizationStatus !== "exact" ||
    !evidence.normalizedValue?.trim() ||
    readRecordConflictPresence(valueJson)
  ) {
    return false;
  }

  if (evidence.field === "size") {
    return (
      (evidence.normalizedValue.startsWith("apparel:") &&
        hasTextProperty(valueJson, "system") &&
        hasTextProperty(valueJson, "token")) ||
      Boolean(owner && readValidatedSupplierProductSize(evidence, owner))
    );
  }

  if (evidence.field === "color") {
    if (isSupplierUnspecifiedColorIdentity(evidence.normalizedValue)) return Boolean(owner && readValidatedSupplierUnspecifiedColor(evidence, owner));
    const colorMeta = readUnknownRecord(valueJson?.colorMeta);
    const kind = colorMeta?.kind;
    return (
      !readRecordConflictPresence(colorMeta) &&
      (kind === "color" || kind === NO_BLANK_COLOR_OPTION_KIND) &&
      colorMeta?.owner === "base-product"
    );
  }

  return false;
}

export type VariantPickerProfileOwner = {
  productId: string;
  supplierId?: string;
};

/** Validate a reviewed selector against its actual enclosing product, never its claimed token owner. */
export function readValidatedSupplierProductSize(
  evidence: VariantPickerProfileEvidence,
  owner: VariantPickerProfileOwner
): { rawLabel: string; displayLabel: string; identity: string } | null {
  const value = readUnknownRecord(evidence.valueJson);
  const context = {
    productId: owner.productId,
    supplierId: owner.supplierId ?? owner.productId.split(":")[0],
  };
  const rule = resolveProductScopedSizeNormalizationRule(context);
  if (
    evidence.field !== "size" ||
    evidence.normalizationStatus !== "exact" ||
    readRecordConflictPresence(value) ||
    value?.kind !== "normalized-size-token" ||
    value.namespace !== "supplier-size" ||
    value.matchScope !== "supplier-product" ||
    !isTextValue(value.raw) ||
    !rule?.supportedLabels.includes(value.raw) ||
    !isTextValue(value.token) ||
    evidence.normalizedValue !== `supplier-size:${value.token}` ||
    createNormalizedVariantSizeValue(context, value.raw) !==
      evidence.normalizedValue
  ) {
    return null;
  }
  const productName = isNonBlankString(value.sourceProductName) && value.sourceProductName.length <= 240 ? value.sourceProductName : null;
  return { rawLabel: value.raw, displayLabel: productName ? `${value.raw} — ${productName}` : value.raw, identity: evidence.normalizedValue };
}

/** Product-origin sizes are admitted only for reviewed fixed-size headwear. */
export function isFixedSizeHeadwearPickerEvidenceReady(
  evidence: VariantPickerProfileEvidence,
  owner: VariantPickerProfileOwner,
  categorySlug: string | null | undefined
): boolean {
  if (
    evidence.field !== "size" ||
    evidence.originScope !== "product" ||
    evidence.normalizationStatus !== "exact" ||
    !HEADWEAR_MATCHING_CATEGORIES.some(category => category === categorySlug)
  ) {
    return false;
  }
  const size = readUnknownRecord(evidence.valueJson);
  if (readRecordConflictPresence(size)) return false;
  return (
    (evidence.normalizedValue === "apparel:one-size" &&
      size?.system === "one-size" &&
      size.token === "one-size") ||
    (owner.productId === "inkthreadable:25419090" &&
      readValidatedSupplierProductSize(evidence, owner) !== null)
  );
}

export function readRecordConflictPresence(value: UnknownRecord | null): boolean {
  const conflict = value?.conflict;
  return isTextValue(conflict) ? conflict.trim().length > 0 : Boolean(conflict);
}

function hasTextProperty(value: UnknownRecord | null, key: string): boolean {
  return isNonBlankString(value?.[key]);
}


/** Identity for an observed fixed source configuration, with no assertion about physical hue. */
export function readValidatedSupplierUnspecifiedColor(evidence: VariantPickerProfileEvidence, owner: VariantPickerProfileOwner): string | null {
  const value = readUnknownRecord(evidence.valueJson);
  const meta = readUnknownRecord(value?.colorMeta);
  const supplier = owner.supplierId ?? owner.productId.split(":")[0];
  const identity = supplierUnspecifiedColorIdentity(owner.productId);
  if (supplier !== "printkk" || !/^printkk:[A-Za-z0-9]+$/.test(owner.productId) || evidence.field !== "color" || evidence.originScope !== "variant" || evidence.normalizationStatus !== "exact") return null;
  if (evidence.normalizedValue !== identity || evidence.source !== UNSPECIFIED_COLOR_SOURCE || evidence.evidencePath !== UNSPECIFIED_COLOR_EVIDENCE_PATH) return null;
  if (readRecordConflictPresence(value) || !hasUnspecifiedColorPresentation(meta)) return null;
  return identity;
}


/** Display-only source name; the validated identity still says nothing about hue. */
export function readValidatedSupplierUnspecifiedColorDisplayLabel(
  evidence: VariantPickerProfileEvidence,
  owner: VariantPickerProfileOwner
): string | null {
  if (!readValidatedSupplierUnspecifiedColor(evidence, owner)) return null;
  const name = readUnknownRecord(evidence.valueJson)?.sourceProductName;
  return isNonBlankString(name) && name.length <= 240
    ? `${UNSPECIFIED_COLOR_LABEL} — ${name.trim()}`
    : UNSPECIFIED_COLOR_LABEL;
}

function hasUnspecifiedColorPresentation(meta: UnknownRecord | null): boolean {
  return !readRecordConflictPresence(meta) && meta?.kind === "unknown" && meta.owner === "base-product" && meta.raw === UNSPECIFIED_COLOR_LABEL && meta.displayColor === UNSPECIFIED_COLOR_LABEL && meta.hex == null && meta.swatchHexes == null && meta.swatchImage == null;
}
