import {
  EU_MEMBER_COUNTRIES,
  PRINTIFY_EU_IMPORT_DUTY,
  normalizeOriginCountry,
  readSupplierDutyEstimateProjection,
  type SupplierDutyEstimateProjection,
} from "./duty-rules";
import { PRINTIFY_US_RESTRICTION, isPrintifyUsDutyPaidProvider, supplierRouteRestriction } from "../suppliers/printify-route-restrictions";
import { createClosedStringLookup } from "../kernel/closed-string-lookup";
import type { Destination, ShippingType } from "../kernel/enums";
import type { IngestionSupplierId } from "../kernel/suppliers";

/**
 * What VAT and import duty mean for one offer's delivered total, by supplier,
 * destination and the route the parcel actually takes. Every statement that
 * is not "unknown" cites a first-party source with the date it was read.
 *
 * Only the route, never cross-border alone, decides buyer exposure: a parcel
 * between two EU countries is not an import, and a supplier's duty-paid (DDP)
 * option is only assumed where its documentation says it is the default.
 */

type TaxEvidenceKind = "supplier-doc" | "supplier-api-doc" | "quote-data";

export type TaxEvidence = {
  readonly id: string;
  readonly label: string;
  readonly url: string;
  /** The day the page or response was read, as YYYY-MM-DD. */
  readonly observedAt: string;
  readonly kind: TaxEvidenceKind;
  /** The page itself is old; its claim is kept but flagged. */
  readonly stale?: true;
};

/**
 * `included`: the delivered total contains it. `excluded`: it applies and is
 * not in the total. `none`: nothing of this kind applies on the route.
 * `unknown`: no evidence either way, never read as included.
 */
export type TaxBasis = "included" | "excluded" | "none" | "unknown";

type TaxFact = {
  readonly basis: TaxBasis;
  /** What the sentence calls this charge, e.g. "VAT". */
  readonly label: string;
  readonly note: string | null;
  readonly evidence: readonly TaxEvidence[];
};

type BuyerImportExposure = {
  readonly exposure: "none" | "possible" | "unknown";
  /** One short sentence for the seller's customer-facing warning. */
  readonly warning: string | null;
  readonly note: string | null;
  readonly evidence: readonly TaxEvidence[];
};

type OfferRoute = {
  /** Normalized country code or "EU"; null when the offer does not say. */
  readonly origin: string | null;
  /** Whether the parcel crosses a customs border; null when not known. */
  readonly crossesCustomsBorder: boolean | null;
};

export type OfferTaxTreatment = {
  readonly route: OfferRoute;
  /** VAT, GST and similar the supplier bills the seller on top of the total. */
  readonly vat: TaxFact;
  /** Account/state-specific US sales tax is not established by catalog quotes. */
  readonly salesTax?: TaxFact;
  /** Import duty the supplier bills the seller. */
  readonly duty: TaxFact;
  /** Import charges the carrier or customs may collect from the customer. */
  readonly buyerImport: BuyerImportExposure;
};

type OfferTaxTreatmentInput = {
  readonly supplierId: string;
  readonly providerId?: string | null;
  readonly destination: Destination;
  /** The variant's stored fulfillment region ("UK" and "EU" are accepted). */
  readonly fulfillmentRegion: string | null;
  readonly shippingType: ShippingType | null;
  /**
   * The countries the parcel may start from when the offer names no single
   * origin (several candidate facilities). They settle the route only when all
   * lie on the same side of the destination's customs border.
   */
  readonly candidateOrigins?: readonly string[] | null;
  /**
   * The supplier-billed duty stored with the offer, in the offer's currency:
   * above zero for a separate established charge, 0 when the rules found none,
   * null when it could not be established. Omitted when the offer carries none.
   */
  readonly dutyPrice?: number | null;
  readonly dutyEstimate?: SupplierDutyEstimateProjection | null;
};

export type TaxDisclosure = {
  /** What the total includes or leaves out, in one short sentence or two; absent when only a warning applies. */
  readonly summary?: string;
  /** One short warning about charges the customer may pay, when it applies. */
  readonly warning: string | null;
  /** The source behind the statement, kept for the link and its date. */
  readonly source: TaxEvidence | null;
};

const CUSTOMS_AREA_BY_DESTINATION: Record<Destination, string> = {
  US: "US",
  GB: "GB",
  DE: "EU",
  CA: "CA",
  AU: "AU",
};

const EVIDENCE = {
  customcatTerms: {
    id: "customcat-terms", label: "CustomCat price and tax terms",
    url: "https://help.customcat.com/what-is-customcats-terms-of-service",
    observedAt: "2026-10-20", kind: "supplier-doc",
  },
  printifyUsTariffs: {
    id: "printify-us-tariffs", label: "Printify duty-paid providers",
    url: PRINTIFY_US_RESTRICTION.sourceUrl, observedAt: PRINTIFY_US_RESTRICTION.observedAt, kind: "supplier-doc",
  },
  printifyEuDuty: {
    id: "printify-eu-duty",
    label: "Printify EU customs duty",
    url: "https://printify.com/blog/eu-customs-duty/",
    observedAt: "2026-10-20",
    kind: "supplier-doc",
  },
  printifyIoss: {
    id: "printify-ioss",
    label: "Printify IOSS and VAT",
    url: "https://help.printify.com/hc/en-us/articles/4483616066321-How-does-IOSS-work-at-Printify",
    observedAt: "2026-10-19",
    kind: "supplier-doc",
  },
  printifyTaxes: {
    id: "printify-taxes",
    label: "Printify taxes and customs",
    url: "https://help.printify.com/hc/en-us/articles/4483644252433-Which-taxes-apply-when-I-use-Printify",
    observedAt: "2026-10-19",
    kind: "supplier-doc",
  },
  prodigiQuoteApi: {
    id: "prodigi-quote-api",
    label: "Prodigi quote API",
    url: "https://www.prodigi.com/print-api/docs/reference/",
    observedAt: "2026-10-20",
    kind: "supplier-api-doc",
  },
  prodigiEuCustoms: {
    id: "prodigi-eu-customs",
    label: "Prodigi EU customs changes",
    url: "https://support.prodigi.com/hc/en-us/articles/24939117383964-EU-Customs-Changes-from-1-July-2026-FAQ",
    observedAt: "2026-10-19",
    kind: "supplier-doc",
  },
  prodigiUsTariff: {
    id: "prodigi-us-tariff",
    label: "Prodigi US tariff changes",
    url: "https://support.prodigi.com/hc/en-us/articles/19385579398556-What-do-the-US-Tariff-changes-mean-for-me",
    observedAt: "2026-10-19",
    kind: "supplier-doc",
  },
  prodigiCustoms: {
    id: "prodigi-customs",
    label: "Prodigi customs on delivery",
    url: "https://support.prodigi.com/hc/en-us/articles/15758071490588-Will-customers-have-to-pay-Customs-on-delivery",
    observedAt: "2026-10-19",
    kind: "supplier-doc",
  },
  printfulDdp: {
    id: "printful-ddp",
    label: "Printful delivered duty paid",
    url: "https://help.printful.com/hc/en-us/articles/50265097613329-What-is-the-Delivered-Duty-Paid-DDP-shipping-option",
    observedAt: "2026-10-19",
    kind: "supplier-doc",
  },
  printfulDuties: {
    id: "printful-duties",
    label: "Printful customs duties and taxes",
    url: "https://help.printful.com/hc/en-us/articles/50264522088209-Who-pays-the-customs-duties-taxes",
    observedAt: "2026-10-19",
    kind: "supplier-doc",
  },
  printfulAuGst: {
    id: "printful-au-gst",
    label: "Printful GST on Australian orders",
    url: "https://help.printful.com/hc/en-us/articles/50264786597265-Why-am-I-being-charged-tax-for-orders-going-to-Australia-and-New-Zealand",
    observedAt: "2026-10-19",
    kind: "supplier-doc",
  },
  gelatoCustoms: {
    id: "gelato-customs",
    label: "Gelato customs fees",
    url: "https://support.gelato.com/en/articles/8996183-do-i-or-my-end-customer-have-to-pay-customs-fees-if-an-order-is-shipped-internationally",
    observedAt: "2026-10-20",
    kind: "supplier-doc",
  },
  inkthreadableUsTariffs: {
    id: "inkthreadable-us-tariffs",
    label: "Inkthreadable US tariffs",
    url: "https://www.inkthreadable.co.uk/usa-tariffs-august-2025",
    observedAt: "2026-10-19",
    kind: "supplier-doc",
  },
  inkthreadableVat: {
    id: "inkthreadable-vat",
    label: "Inkthreadable VAT on orders",
    url: "https://help.inkthreadable.co.uk/en/articles/435625-calculating-vat-for-your-orders",
    observedAt: "2026-10-19",
    kind: "supplier-doc",
  },
  inkthreadableIoss: {
    id: "inkthreadable-ioss",
    label: "Inkthreadable IOSS for EU exports",
    url: "https://help.inkthreadable.co.uk/en/articles/6221605-how-to-submit-your-ioss-number-for-eu-exports",
    observedAt: "2026-10-19",
    kind: "supplier-doc",
  },
  inkthreadableBasketQuotes: {
    id: "inkthreadable-basket-quotes",
    label: "Inkthreadable checkout quotes by destination",
    url: "https://www.inkthreadable.co.uk/basket",
    observedAt: "2026-10-19",
    kind: "quote-data",
  },
  inkthreadableUsDutyQuotes: {
    id: "inkthreadable-us-duty-quotes",
    label: "Inkthreadable US export-duty quotes",
    url: "https://www.inkthreadable.co.uk/basket",
    observedAt: "2026-10-20",
    kind: "quote-data",
  },
  fourthwallTax: {
    id: "fourthwall-tax",
    label: "Fourthwall tax and duties",
    url: "https://help.fourthwall.com/frequently-asked-questions/payments-and-pricing/creator-tax-information",
    observedAt: "2026-10-20",
    kind: "supplier-doc",
  },

} as const satisfies Record<string, TaxEvidence>;


function fact(
  label: string,
  basis: TaxBasis,
  note: string | null,
  evidence: readonly TaxEvidence[] = []
): TaxFact {
  return { basis, label, note, evidence };
}

const vatFact = (
  basis: TaxBasis,
  note: string | null,
  evidence: readonly TaxEvidence[] = []
) => fact("VAT", basis, note, evidence);

const dutyFact = (
  basis: TaxBasis,
  note: string | null,
  evidence: readonly TaxEvidence[] = [],
  label = "import duty"
) => fact(label, basis, note, evidence);

const UNKNOWN_VAT = vatFact("unknown", null);
const UNKNOWN_DUTY = dutyFact("unknown", null);
const NO_VAT_IN_US = vatFact("none", "The US has no VAT.");
const NOT_AN_IMPORT = dutyFact(
  "none",
  "The parcel does not cross a customs border."
);

function exposure(
  kind: BuyerImportExposure["exposure"],
  warning: string | null,
  note: string | null,
  evidence: readonly TaxEvidence[] = []
): BuyerImportExposure {
  return { exposure: kind, warning, note, evidence };
}

const CUSTOMER_MAY_PAY =
  "Your customer may pay import charges on delivery.";

/** A stored region as a country code, "EU", or null when it names no place. */
export function normalizeFulfillmentRegion(
  region: string | null | undefined
): string | null {
  const code = region?.trim().toUpperCase();
  if (!code) return null;
  if (code === "EU") return "EU";
  return normalizeOriginCountry(code);
}

function customsAreaOf(region: string): string {
  return region === "EU" || EU_MEMBER_COUNTRIES.has(region) ? "EU" : region;
}

/**
 * Where the parcel starts and whether it crosses a customs border. A "varies"
 * offer or one without a stored region stays unknown: its stored region is a
 * placeholder for the destination, not a place it ships from. Candidate
 * origins then settle it when they all agree.
 */
export function resolveOfferRoute(
  input: Pick<
    OfferTaxTreatmentInput,
    "supplierId" | "destination" | "fulfillmentRegion" | "shippingType" | "candidateOrigins"
  >
): OfferRoute {
  const fixedOrigin = taxPolicyFor(input.supplierId).singleOrigin ?? null;
  const stored = normalizeFulfillmentRegion(input.fulfillmentRegion);
  const origin =
    fixedOrigin ??
    (input.shippingType === "local"
      ? (stored ?? input.destination)
      : input.shippingType === "international"
        ? stored
        : null);
  if (origin === null) return resolveCandidateRoute(input.candidateOrigins ?? [], input.destination);
  return {
    origin,
    crossesCustomsBorder:
      customsAreaOf(origin) !== CUSTOMS_AREA_BY_DESTINATION[input.destination],
  };
}

/**
 * An offer's stored candidate origins (`ProductVariant.candidateOrigins`) as
 * rows, selections and offers carry them: absent when it has none, so offers
 * with a named origin carry nothing extra.
 */
export function withCandidateOrigins(
  candidates: readonly string[] | null | undefined
): { candidateOrigins?: string[] } {
  return candidates && candidates.length > 0 ? { candidateOrigins: [...candidates] } : {};
}

/**
 * Several facilities may ship and the supplier picks one. The route is known
 * when every candidate gives the same answer: all abroad is an import, all
 * inside the destination's customs area is not. Mixed, or a candidate that
 * names no place, stays unknown.
 */
function resolveCandidateRoute(candidates: readonly string[], destination: Destination): OfferRoute {
  const regions = candidates.map(normalizeFulfillmentRegion);
  const known = regions.filter(region => region !== null);
  if (known.length === 0 || known.length !== regions.length) {
    return { origin: null, crossesCustomsBorder: null };
  }
  const crossings = new Set(known.map(region => customsAreaOf(region) !== CUSTOMS_AREA_BY_DESTINATION[destination]));
  if (crossings.size !== 1) return { origin: null, crossesCustomsBorder: null };
  const countries = new Set(known);
  const origin =
    countries.size === 1
      ? (known[0] ?? null)
      : known.every(region => customsAreaOf(region) === "EU")
        ? "EU"
        : null;
  return { origin, crossesCustomsBorder: crossings.has(true) };
}

/**
 * Inkthreadable stores GBP prices without VAT. What it charges depends on the
 * account's billing country and the destination, and children's items are zero
 * rated, so only the UK delivery is established for every account.
 */
function resolveInkthreadableVat(destination: Destination): TaxFact {
  if (destination === "GB") {
    return vatFact(
      "excluded",
      "Inkthreadable prices exclude VAT. UK deliveries are charged UK VAT whichever country you are billed in, at 20% on adult items; children's items are zero rated.",
      [EVIDENCE.inkthreadableVat]
    );
  }
  return vatFact(
    "unknown",
    "Inkthreadable prices exclude VAT. UK-billed accounts are charged UK VAT on exports; accounts billed elsewhere pay VAT only on UK deliveries. The VAT charged depends on your billing country.",
    [EVIDENCE.inkthreadableVat]
  );
}

/**
 * Inkthreadable's US orders are delivered duty paid and carry a separate
 * "Export duties" line billed to the seller. The numeric duty is the product's
 * net price times Inkthreadable's own per-product rate; the rate is never a
 * flat 10%. A missing duty is unknown, never zero.
 */
function resolveInkthreadableDuty(input: OfferTaxTreatmentInput): TaxFact {
  const { destination, dutyPrice } = input;
  if (destination !== "US") {
    if (dutyPrice === null) return UNKNOWN_DUTY;
    if (dutyPrice !== undefined && dutyPrice > 0) {
      return dutyFact("excluded", "The supplier bills this duty separately from product and shipping.");
    }
    return dutyFact(
      "none",
      "Inkthreadable adds no duty line at checkout for this destination.",
      [EVIDENCE.inkthreadableBasketQuotes]
    );
  }
  const estimate = dutyPrice == null ? readSupplierDutyEstimateProjection(input.dutyEstimate) : null;
  if (estimate) {
    return dutyFact(
      estimate.native.min > 0 ? "excluded" : "unknown",
      "Inkthreadable's retained per-product quotes support an estimated US duty at this net price. The exact amount remains unconfirmed and separate from product + shipping.",
      [EVIDENCE.inkthreadableUsTariffs, EVIDENCE.inkthreadableUsDutyQuotes],
      "estimated US duty"
    );
  }
  if (dutyPrice === null || dutyPrice === undefined) {
    return dutyFact(
      "unknown",
      "Inkthreadable's US duty rate for this product has not been established.",
      [EVIDENCE.inkthreadableUsTariffs]
    );
  }
  if (dutyPrice > 0) {
    return dutyFact(
      "excluded",
      "Inkthreadable bills US duty as a separate line at a rate it sets per product. It is separate from the product + shipping comparison price.",
      [EVIDENCE.inkthreadableUsTariffs, EVIDENCE.inkthreadableUsDutyQuotes],
      "US duty"
    );
  }
  return dutyFact(
    "none",
    "The retained Inkthreadable quote supports no additional US duty at this price.",
    [EVIDENCE.inkthreadableUsDutyQuotes]
  );
}

function resolveInkthreadableBuyerImport(
  input: OfferTaxTreatmentInput,
  route: OfferRoute
): BuyerImportExposure {
  if (route.crossesCustomsBorder === false) {
    return exposure("none", null, "The parcel does not cross a customs border.");
  }
  if (route.crossesCustomsBorder === null) return exposure("unknown", null, null);
  switch (input.destination) {
    case "US":
      // The duty-paid default is documented for its US export route; any other
      // shipping method stays unknown.
      return input.shippingType === "international"
        ? exposure(
            "none",
            null,
            "Inkthreadable delivers US orders duty paid and bills the duty to you.",
            [EVIDENCE.inkthreadableUsTariffs]
          )
        : exposure("unknown", null, null);
    case "DE":
      return exposure(
        "possible",
        CUSTOMER_MAY_PAY,
        "Inkthreadable adds no EU duty at checkout and publishes no EU landed-cost figure. An IOSS number in your profile applies to EU exports; without one, import VAT may fall to your customer.",
        [EVIDENCE.inkthreadableIoss]
      );
    case "CA":
    case "AU":
      return exposure(
        "possible",
        CUSTOMER_MAY_PAY,
        "Inkthreadable adds no duty at checkout for this destination and does not state who pays import charges.",
        [EVIDENCE.inkthreadableBasketQuotes]
      );
    default:
      return exposure("unknown", null, null);
  }
}

function resolvePrintifyEuDuty(
  dutyPrice: number | null | undefined
): TaxFact {
  if (dutyPrice === null) {
    return dutyFact("unknown", "The supplier's duty could not be established for this offer.", [EVIDENCE.printifyEuDuty]);
  }
  if (dutyPrice === 0) {
    return dutyFact("none", "Printify's EU duty does not apply to this parcel.", [
      EVIDENCE.printifyEuDuty,
    ]);
  }
  return dutyFact(
    "excluded",
    "For the comparison scenario of one item, one parcel and one commodity code with declared value below €150, Printify bills €3. Actual declared value and mixed parcels require a separate quote.",
    [EVIDENCE.printifyEuDuty],
    "the €3 EU duty for one parcel under €150"
  );
}

function resolveDuty(
  input: OfferTaxTreatmentInput,
  route: OfferRoute
): TaxFact {
  const { dutyPrice } = input;
  if (route.crossesCustomsBorder === false) return NOT_AN_IMPORT;
  const ruleDuty = taxPolicyFor(input.supplierId).ruleDuty?.(input, route) ?? null;
  if (ruleDuty) return ruleDuty;
  if (dutyPrice === null) return resolveStoredUnknownDuty(input, route);
  if (dutyPrice !== undefined && dutyPrice > 0) {
    return dutyFact(
      "excluded",
      "The supplier bills this duty separately from product and shipping.",
      []
    );
  }
  return resolveDocumentedDuty(input, route);
}

/** A writer that stored unknown from the reviewed facts keeps their reason. */
function resolveStoredUnknownDuty(
  input: OfferTaxTreatmentInput,
  route: OfferRoute
): TaxFact {
  const documented = route.crossesCustomsBorder === true ? resolveReviewedSellerDuty(input) : null;
  return dutyFact(
    "unknown",
    (documented?.basis === "unknown" ? documented.note : null) ??
      "The supplier's duty could not be established for this offer.",
    documented?.basis === "unknown" && documented.evidence ? [documented.evidence] : []
  );
}

/** No separate charge stored: the supplier's reviewed documents explain it. */
function resolveDocumentedDuty(input: OfferTaxTreatmentInput, route: OfferRoute): TaxFact {
  const documented = resolveReviewedSellerDuty(input);
  if (documented.basis === "supplier-rule") return UNKNOWN_DUTY;
  // An unknown origin is settled only by a fact that holds on every route.
  if (route.crossesCustomsBorder === null && !documented.everyRoute) return UNKNOWN_DUTY;
  return dutyFact(documented.basis, documented.note, documented.evidence ? [documented.evidence] : []);
}

/**
 * Why a supplier does or does not bill the seller duty on a route that
 * crosses a customs border: the stored `data.duty.reason` of a reviewed
 * outcome.
 */
type ReviewedSellerDutyReason =
  | "supplier_bills_no_duty"
  | "duty_paid_in_shipping"
  | "supplier_duty_unestablished"
  | "supplier_duty_unreviewed"
  | "provider_us_orders_on_hold";

/**
 * Seller-billed duty on a route that crosses a customs border, from the
 * supplier's reviewed documents. `none`: no duty billed to the seller (the
 * customer may still pay on delivery); `included`: duty paid with the cost
 * inside shipping; `unknown`: no source establishes it. `supplier-rule`: the
 * supplier's own writer computes the charge (Inkthreadable's US export duty,
 * Printify's EU duty) and these documents do not decide it. `everyRoute`: the
 * fact holds whichever route the parcel takes (no duty billed for this
 * destination at all), so it settles a route whose origin is unknown.
 *
 * Receipts and the offer duty writers (`shared/pricing/offer-duty.ts`) both
 * read this one table.
 */
type ReviewedSellerDuty =
  | {
      readonly basis: "none" | "included" | "unknown";
      readonly reason: ReviewedSellerDutyReason;
      readonly note: string | null;
      readonly evidence: TaxEvidence | null;
      readonly everyRoute: boolean;
    }
  | { readonly basis: "supplier-rule"; readonly ruleId: string };

function reviewed(
  basis: "none" | "included" | "unknown",
  reason: ReviewedSellerDutyReason,
  note: string | null,
  evidence: TaxEvidence | null,
  everyRoute = false
): ReviewedSellerDuty {
  return { basis, reason, note, evidence, everyRoute };
}

/** No duty billed for the destination: true of an import and of a domestic route alike. */
const billsNoDutyOnAnyRoute = (note: string, evidence: TaxEvidence): ReviewedSellerDuty =>
  reviewed("none", "supplier_bills_no_duty", note, evidence, true);

const UNREVIEWED_DUTY = reviewed("unknown", "supplier_duty_unreviewed", null, null);

type ReviewedSellerDutyInput = {
  readonly supplierId: string;
  readonly destination: Destination;
  readonly providerId?: string | null;
};

/**
 * One supplier's reviewed tax facts. Every ingested supplier has an entry, so
 * adding a supplier means deciding these or stating that nothing is reviewed.
 */
type SupplierTaxPolicy = {
  /** The one country the supplier fulfills from, so the route needs no per-offer region. */
  readonly singleOrigin?: string;
  /** VAT, GST and similar billed to the seller on top of the quoted prices. */
  readonly vat: (destination: Destination, route: OfferRoute) => TaxFact;
  /** A duty the supplier's own writer computes for this offer; null when its reviewed documents decide. */
  readonly ruleDuty?: (input: OfferTaxTreatmentInput, route: OfferRoute) => TaxFact | null;
  /** Seller-billed duty on a route that crosses a customs border, from the reviewed documents. */
  readonly reviewedSellerDuty: (input: ReviewedSellerDutyInput) => ReviewedSellerDuty;
  /** Import charges the customer may pay on delivery. */
  readonly buyerImport: (input: OfferTaxTreatmentInput, route: OfferRoute) => BuyerImportExposure;
};

/** The US has no VAT; the supplier's own VAT facts apply everywhere else. */
const outsideTheUs =
  (vat: (destination: Destination, route: OfferRoute) => TaxFact) =>
  (destination: Destination, route: OfferRoute): TaxFact =>
    destination === "US" ? NO_VAT_IN_US : vat(destination, route);

/** The customer can owe import charges only on a route known to cross a customs border. */
const onImport =
  (resolve: (input: OfferTaxTreatmentInput, route: OfferRoute) => BuyerImportExposure) =>
  (input: OfferTaxTreatmentInput, route: OfferRoute): BuyerImportExposure => {
    if (route.crossesCustomsBorder === false) {
      return exposure("none", null, "The parcel does not cross a customs border.");
    }
    if (route.crossesCustomsBorder === null) {
      return exposure("unknown", null, null);
    }
    return resolve(input, route);
  };

const UNREVIEWED_TAX_POLICY: SupplierTaxPolicy = {
  vat: outsideTheUs(() => UNKNOWN_VAT),
  reviewedSellerDuty: () => UNREVIEWED_DUTY,
  buyerImport: onImport(() => exposure("unknown", null, null)),
};

const SUPPLIER_TAX_POLICIES: Record<IngestionSupplierId, SupplierTaxPolicy> = {
  apliiq: UNREVIEWED_TAX_POLICY,
  artelo: UNREVIEWED_TAX_POLICY,
  customcat: {
    singleOrigin: "US",
    vat: outsideTheUs(() =>
      vatFact("excluded", "CustomCat prices exclude taxes; the account and destination decide what is billed.", [EVIDENCE.customcatTerms])
    ),
    reviewedSellerDuty: () =>
      reviewed("unknown", "supplier_duty_unestablished", "Current terms exclude customs charges and may require the seller to pay or reimburse them; the quoted route does not identify the payer.", EVIDENCE.customcatTerms),
    buyerImport: onImport(() =>
      exposure("unknown", null, "The current terms do not establish whether these charges are collected from the seller or recipient for this route.", [EVIDENCE.customcatTerms])
    ),
  },
  fourthwall: {
    vat: outsideTheUs(() =>
      vatFact(
        "excluded",
        "Fourthwall collects VAT from the customer at checkout.",
        [EVIDENCE.fourthwallTax]
      )
    ),
    reviewedSellerDuty: () =>
      billsNoDutyOnAnyRoute("Fourthwall never bills duty to the creator.", EVIDENCE.fourthwallTax),
    buyerImport: onImport(() =>
      exposure("possible", CUSTOMER_MAY_PAY, null, [
        EVIDENCE.fourthwallTax,
      ])
    ),
  },
  gelato: {
    vat: outsideTheUs(() => UNKNOWN_VAT),
    reviewedSellerDuty: () =>
      reviewed("unknown", "supplier_duty_unestablished", "The quoted service is not established: Economy is duty paid and other services may not be.", EVIDENCE.gelatoCustoms),
    buyerImport: onImport(() =>
      exposure(
        "unknown",
        null,
        "Gelato's Economy shipping is duty paid; its other methods leave duty to the customer.",
        [EVIDENCE.gelatoCustoms]
      )
    ),
  },
  inkthreadable: {
    singleOrigin: "GB",
    // Inkthreadable bills UK VAT to UK-billed accounts on exports too, so the
    // "the US has no VAT" rule does not apply to it.
    vat: resolveInkthreadableVat,
    ruleDuty: resolveInkthreadableDuty,
    reviewedSellerDuty: () => ({ basis: "supplier-rule", ruleId: "inkthreadable-us-export-duty" }),
    buyerImport: resolveInkthreadableBuyerImport,
  },
  merchone: UNREVIEWED_TAX_POLICY,
  printful: {
    vat: outsideTheUs((destination, route) =>
      destination === "AU" && route.crossesCustomsBorder === true
        ? vatFact(
            "excluded",
            "Printful bills 10% GST on imports to Australia unless you are registered.",
            [EVIDENCE.printfulAuGst]
          )
        : UNKNOWN_VAT
    ),
    reviewedSellerDuty: ({ destination }) => {
      if (destination === "US") {
        return reviewed(
          "included",
          "duty_paid_in_shipping",
          "Printful ships imports to the US duty paid by default, with the cost in shipping.",
          EVIDENCE.printfulDdp
        );
      }
      return destination === "GB" || destination === "CA"
        ? billsNoDutyOnAnyRoute("Printful leaves duty to the customer by default.", EVIDENCE.printfulDuties)
        : UNREVIEWED_DUTY;
    },
    buyerImport: onImport(({ destination }) => {
      if (destination === "US") {
        return exposure(
          "none",
          null,
          "Printful ships imports to the US duty paid by default.",
          [EVIDENCE.printfulDdp]
        );
      }
      return destination === "GB" || destination === "CA"
        ? exposure(
            "possible",
            CUSTOMER_MAY_PAY,
            "Duty is the customer's unless the optional duty-paid shipping is chosen.",
            [EVIDENCE.printfulDuties]
          )
        : exposure("unknown", null, null);
    }),
  },
  printify: {
    vat: outsideTheUs((destination, route) =>
      destination === "DE" &&
      route.crossesCustomsBorder === true &&
      route.origin !== null
        ? vatFact(
            "excluded",
            "Printify bills VAT on top for parcels shipped from outside the EU.",
            [EVIDENCE.printifyIoss]
          )
        : UNKNOWN_VAT
    ),
    ruleDuty: (input, route) =>
      input.destination === "DE" && route.crossesCustomsBorder === true
        ? resolvePrintifyEuDuty(input.dutyPrice)
        : null,
    reviewedSellerDuty: ({ supplierId, destination, providerId }) => {
      if (destination === "DE") return { basis: "supplier-rule", ruleId: PRINTIFY_EU_IMPORT_DUTY.ruleId };
      if (destination === "US" && isPrintifyUsDutyPaidProvider(providerId)) {
        return reviewed("included", "duty_paid_in_shipping", "The provider ships duty paid with no separate duty bill.", EVIDENCE.printifyUsTariffs);
      }
      if (supplierRouteRestriction({ supplierId, destination, providerId: providerId ?? null })) {
        return reviewed("unknown", "provider_us_orders_on_hold", "Printify puts US orders from this provider on hold, so no duty is established.", EVIDENCE.printifyUsTariffs);
      }
      return billsNoDutyOnAnyRoute("Printify bills no import duty for this destination.", EVIDENCE.printifyTaxes);
    },
    buyerImport: onImport(({ destination, providerId }) => {
      if (destination === "US") return isPrintifyUsDutyPaidProvider(providerId)
        ? exposure("none", null, "The provider ships US orders duty paid.", [EVIDENCE.printifyUsTariffs])
        : exposure("unknown", null, null);
      return destination === "DE"
        ? exposure(
            "possible",
            "Your customer may pay carrier handling fees on delivery.",
            "Printify pays the EU duty; customs may still charge handling fees.",
            [EVIDENCE.printifyEuDuty]
          )
        : exposure("possible", CUSTOMER_MAY_PAY, null, [
            EVIDENCE.printifyTaxes,
          ]);
    }),
  },
  printkk: UNREVIEWED_TAX_POLICY,
  prodigi: {
    vat: outsideTheUs(destination =>
      destination === "DE" || destination === "GB"
        ? vatFact(
            "excluded",
            "Prodigi adds VAT on top of its quoted prices.",
            [EVIDENCE.prodigiQuoteApi]
          )
        : UNKNOWN_VAT
    ),
    reviewedSellerDuty: ({ destination }) => {
      if (destination === "US" || destination === "CA") {
        return billsNoDutyOnAnyRoute(
          "Prodigi leaves duty to the customer.",
          destination === "US" ? EVIDENCE.prodigiUsTariff : EVIDENCE.prodigiCustoms
        );
      }
      return UNREVIEWED_DUTY;
    },
    buyerImport: onImport(({ destination }, route) => {
      if (destination === "US" && route.origin === "GB") {
        return exposure(
          "possible",
          "Your customer may pay about 10% import duty on delivery.",
          "Prodigi estimates around 10% duty on US orders from its UK labs.",
          [EVIDENCE.prodigiUsTariff]
        );
      }
      if (destination === "US") return exposure("possible", CUSTOMER_MAY_PAY, null, [EVIDENCE.prodigiCustoms]);
      if (destination === "DE") {
        return exposure(
          "possible",
          "Your customer may pay the EU duty and carrier handling fees on delivery.",
          null,
          [EVIDENCE.prodigiEuCustoms]
        );
      }
      return destination === "CA"
        ? exposure("possible", CUSTOMER_MAY_PAY, null, [EVIDENCE.prodigiCustoms])
        : exposure("unknown", null, null);
    }),
  },
};

const reviewedTaxPolicyFor = createClosedStringLookup(SUPPLIER_TAX_POLICIES);
/** A supplier id outside the list carries no reviewed facts. */
const taxPolicyFor = (supplierId: string): SupplierTaxPolicy =>
  reviewedTaxPolicyFor(supplierId) ?? UNREVIEWED_TAX_POLICY;

export function resolveReviewedSellerDuty(input: ReviewedSellerDutyInput): ReviewedSellerDuty {
  return taxPolicyFor(input.supplierId).reviewedSellerDuty(input);
}

export function resolveOfferTaxTreatment(
  input: OfferTaxTreatmentInput
): OfferTaxTreatment {
  const route = resolveOfferRoute(input);
  return {
    route,
    vat: taxPolicyFor(input.supplierId).vat(input.destination, route),
    salesTax: input.destination === "US"
      ? fact("sales tax", "unknown", "Catalog and shipping quotes do not establish state-specific sales tax or account exemptions.")
      : fact("sales tax", "none", null),
    duty: resolveDuty(input, route),
    buyerImport: taxPolicyFor(input.supplierId).buyerImport(input, route),
  };
}

/**
 * The words for one treatment. It names what the total leaves out, says plainly
 * what it cannot confirm, and never reads an unknown as included. A surface
 * that shows the supplier's duty as its own line passes `dutyShownSeparately`
 * so the sentence leaves duty to that line.
 */
/**
 * Only established facts: what the total includes or leaves out, plus a
 * warning when the customer may pay import charges. Unconfirmed charges say
 * nothing; null when there is nothing to state.
 */
export function describeTaxTreatment(
  treatment: OfferTaxTreatment,
  options: { dutyShownSeparately?: boolean } = {}
): TaxDisclosure | null {
  const { vat, duty, buyerImport } = treatment;
  const included: string[] = [];
  const excluded: string[] = [];
  const classify = (taxFact: TaxFact) => {
    if (taxFact.basis === "included") included.push(taxFact.label);
    else if (taxFact.basis === "excluded") excluded.push(taxFact.label);
  };
  const dutyInSentence = !options.dutyShownSeparately;
  classify(vat);
  if (treatment.salesTax) classify(treatment.salesTax);
  if (dutyInSentence) classify(duty);

  const sentences: string[] = [];
  if (excluded.length > 0) sentences.push(`Excludes ${excluded.join(" and ")}.`);
  if (included.length > 0) sentences.push(`Includes ${included.join(" and ")}.`);

  const warning =
    buyerImport.exposure === "possible" ? buyerImport.warning : null;
  if (sentences.length === 0 && !warning) return null;
  // The link backs what the words say: a charge the total leaves out or
  // includes, else the warning.
  const stated = [...(dutyInSentence ? [duty] : []), vat].filter(
    part => part.basis === "excluded" || part.basis === "included"
  );
  const source =
    [...stated, ...(warning ? [buyerImport] : [])]
      .flatMap(part => part.evidence)
      .find(Boolean) ?? null;
  const disclosure: { -readonly [Key in keyof TaxDisclosure]: TaxDisclosure[Key] } = {
    warning,
    source,
  };
  if (sentences.length > 0) disclosure.summary = sentences.join(" ");
  return disclosure;
}

