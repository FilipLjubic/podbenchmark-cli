import { z } from "zod";
import {
  SUPPLIER_OPTION_LINK_MARKET_CONTEXTS,
  SUPPLIER_OPTION_LINK_MAX_URL_LENGTH,
  SUPPLIER_OPTION_LINK_SELECTIONS,
  SUPPLIER_OPTION_LINK_SUPPLIER_IDS,
  supplierOptionLinkUrlIssue,
} from "./supplier-option-link-target";

// Browser code imports the schema-free contract directly; these re-exports
// keep server callers on one path.
export {
  readSupplierOptionLinkTarget,
  SUPPLIER_OPTION_LINK_SELECTIONS,
  type SupplierOptionLinkSelection,
} from "./supplier-option-link-target";

/** Native URL tokens prepared once per supplier option, never from picker aliases. */
export const supplierOptionLinkTargetSchema = z
  .object({
    version: z.literal(1),
    supplierId: z.enum(SUPPLIER_OPTION_LINK_SUPPLIER_IDS),
    url: z.url().max(SUPPLIER_OPTION_LINK_MAX_URL_LENGTH),
    selected: z.array(z.enum(SUPPLIER_OPTION_LINK_SELECTIONS)).min(1),
    requiresLogin: z.boolean(),
    marketContext: z.enum(SUPPLIER_OPTION_LINK_MARKET_CONTEXTS),
  })
  .superRefine((target, context) => {
    const issue = supplierOptionLinkUrlIssue(
      target.supplierId,
      target.marketContext,
      target.url
    );
    if (issue === "url")
      context.addIssue({
        code: "custom",
        path: ["url"],
        message: "Expected an official supplier HTTPS URL",
      });
    if (issue === "marketContext")
      context.addIssue({
        code: "custom",
        path: ["marketContext"],
        message: "Market context is supported only by the Gelato editor route",
      });
  });
/** The stored and served target; the schema above is its only field list. */
export type SupplierOptionLinkTarget = z.output<
  typeof supplierOptionLinkTargetSchema
>;
