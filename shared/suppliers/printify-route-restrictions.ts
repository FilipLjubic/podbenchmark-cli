/** Reviewed destination restrictions override a rate returned by a shipping API.
 * Offers remain stored and active: removing a restriction restores eligibility.
 */
export const PRINTIFY_US_RESTRICTION = {
  id: "printify-us-provider-hold",
  sourceUrl:
    "https://help.printify.com/hc/en-us/articles/33398560291729-Import-Tariffs-Updates-for-Printify-Merchants",
  observedAt: "2026-10-20",
  providerIds: [
    "printify:6", // T Shirt and Sons
    "printify:94", // Harrier
    "printify:331", // Shirt Monkey
    "printify:36", // Print Pigeons
    "printify:220", // Posterflow
    "printify:26", // Textildruck Europa
    "printify:402", // Atelier Katanga
    "printify:34", // The Print Bar
  ],
} as const;

const restrictedProviderIds: ReadonlySet<string> = new Set(
  PRINTIFY_US_RESTRICTION.providerIds
);

export function supplierRouteRestriction(input: {
  supplierId: string;
  providerId: string | null;
  destination: string;
}): typeof PRINTIFY_US_RESTRICTION | null {
  return input.supplierId === "printify" &&
    input.destination === "US" &&
    input.providerId !== null &&
    restrictedProviderIds.has(input.providerId)
    ? PRINTIFY_US_RESTRICTION
    : null;
}

/** The same reviewed notice lists these providers as duty paid for US orders. */
const PRINTIFY_US_DDP_PROVIDER_IDS: ReadonlySet<string> = new Set([
  "printify:48", "printify:23", "printify:66", "printify:30", "printify:14",
  "printify:90", "printify:83", "printify:332", "printify:85", "printify:335",
  "printify:41", "printify:27", "printify:29", "printify:39", "printify:72", "printify:69",
]);
export function isPrintifyUsDutyPaidProvider(providerId: string | null | undefined): boolean {
  return providerId !== null && providerId !== undefined && PRINTIFY_US_DDP_PROVIDER_IDS.has(providerId);
}
