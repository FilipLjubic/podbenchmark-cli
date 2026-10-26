import { isConditionalSupplierPricingContext } from "shared/pricing/required-charges";
import type {
  ComparisonGroup,
  ComparisonOffer,
  CompareProductSuccess,
} from "shared/public-api/comparison";
import type { Session } from "../session";
import {
  DESTINATION_NAMES,
  UNKNOWN,
  dateOnly,
  readableDate,
  readableDateRange,
  days,
  money,
  signedMoney,
} from "./money";
import { renderTable, type Column, type TableRow } from "./table";

const NARROW = 80;

export interface CompareView {
  /** Also list similar products. */
  similar: boolean;
  /** The product came from a pasted supplier link. */
  fromLink: boolean;
}

const supplierCell = (offer: ComparisonOffer, indent = false) =>
  `${indent ? "  " : ""}${offer.supplier}${offer.provider ? ` via ${offer.provider}` : ""}${offer.isYourSupplier ? " (yours)" : ""}`;

/** A group's own offer, plus its other providers when one supplier was asked for. */
const flatten = (groups: readonly ComparisonGroup[], expand: boolean) =>
  groups.flatMap(group => [
    { offer: group.offer, indent: false },
    ...(expand
      ? group.otherOffers.map(offer => ({ offer, indent: true }))
      : []),
  ]);

const hasPrice = (offer: ComparisonOffer) =>
  offer.available && offer.delivered !== null;

function deliveredTable(
  session: Session,
  data: CompareProductSuccess,
  rows: ReturnType<typeof flatten>
) {
  const { style, terminal } = session;
  const wide = terminal.columns >= NARROW;
  const eligible = (offer: ComparisonOffer) =>
    hasPrice(offer) &&
    offer.comparable &&
    offer.currency === data.currency &&
    !isConditionalSupplierPricingContext(offer.pricingContext);
  const unconditional = rows.every(
    row => !isConditionalSupplierPricingContext(row.offer.pricingContext)
  );
  const flagged =
    unconditional &&
    rows.some(row => row.offer.cheapest && eligible(row.offer));
  // An explicit supplier focus may compare its own comparable providers.
  const providerMinimum = data.supplier !== null && unconditional;
  const canCompare = flagged || providerMinimum;
  const known = rows.flatMap(row =>
    eligible(row.offer) ? [row.offer.delivered ?? Infinity] : []
  );
  const lowest = Math.min(...known);
  const floor = flagged
    ? Math.min(
        ...rows.flatMap(row =>
          row.offer.cheapest && row.offer.delivered !== null
            ? [row.offer.delivered]
            : []
        )
      )
    : lowest;
  const isBest = (offer: ComparisonOffer) =>
    canCompare &&
    eligible(offer) &&
    (flagged ? offer.cheapest : offer.delivered === lowest);
  // With the seller's own supplier, every row is measured against it.
  const current = data.yourSupplier?.sellsProduct ? data.yourSupplier : null;
  const columns: Column[] = [
    { header: "SUPPLIER", maxWidth: 44 },
    ...(wide
      ? [
          { header: "PRODUCT", align: "right" as const },
          { header: "SHIPPING", align: "right" as const },
        ]
      : []),
    { header: "PRODUCT + SHIPPING", align: "right" },
    { header: "ARRIVES" },
    {
      header: current
        ? `VS ${current.name.toUpperCase()}`
        : flagged
          ? "VS CHEAPEST"
          : "VS LOWEST",
      align: "right",
    },
  ];
  const tableRows: TableRow[] = rows.map(({ offer, indent }) => {
    const priced = hasPrice(offer);
    const gap = current
      ? versusCurrent(offer, data.currency, "delivered")
      : !canCompare || !eligible(offer) || offer.delivered === null
        ? UNKNOWN
        : isBest(offer)
          ? flagged
            ? "cheapest"
            : "lowest"
          : signedMoney(offer.delivered - floor, data.currency);
    return {
      cells: [
        supplierCell(offer, indent),
        ...(wide
          ? [
              priced ? money(offer.price, data.currency) : UNKNOWN,
              priced ? money(offer.shipping, data.currency) : UNKNOWN,
            ]
          : []),
        priced ? money(offer.delivered, data.currency) : UNKNOWN,
        priced ? days(offer.deliveryDaysMin, offer.deliveryDaysMax) : UNKNOWN,
        gap,
      ],
      paint: isBest(offer) ? line => style.bold(style.green(line)) : undefined,
    };
  });
  return renderTable(columns, tableRows, style.dim);
}

/**
 * One row against the seller's own supplier, from the service's `versusYours`
 * (positive: better for the seller), worded so the sign can't be misread.
 */
function versusCurrent(
  offer: ComparisonOffer,
  currency: string,
  measure: "delivered" | "keep" | "charge"
) {
  if (offer.isYourSupplier || offer.versusYours === null) return UNKNOWN;
  const gap = offer.versusYours;
  if (Math.round(gap * 100) === 0) return "same";
  if (measure === "keep") return signedMoney(gap, currency);
  const amount = money(Math.abs(gap), currency);
  if (measure === "charge") return `${amount} ${gap > 0 ? "lower" : "higher"}`;
  return `${amount} ${gap > 0 ? "less" : "more"}`;
}

const sameFees = (offers: readonly ComparisonOffer[]) => {
  const fees = offers.flatMap(offer =>
    offer.profit?.status === "calculated" ? [offer.profit.fees] : []
  );
  return fees.every(fee => fee === fees[0]);
};

function profitTable(
  session: Session,
  data: CompareProductSuccess,
  rows: ReturnType<typeof flatten>,
  priceMode: boolean
) {
  const { style } = session;
  const currentName = data.yourSupplier?.name;
  const showFees = priceMode || !sameFees(rows.map(row => row.offer));
  const columns: Column[] = [
    { header: "SUPPLIER", maxWidth: 44 },
    { header: "PRODUCT + SHIPPING", align: "right" },
    ...(showFees ? [{ header: "FEES", align: "right" as const }] : []),
    ...(priceMode ? [{ header: "CHARGE", align: "right" as const }] : []),
    { header: "YOU KEEP", align: "right" },
    ...(currentName
      ? [{ header: `VS ${currentName.toUpperCase()}`, align: "right" as const }]
      : []),
    { header: "" },
  ];
  const canRank = rows.every(
    ({ offer }) =>
      !isConditionalSupplierPricingContext(offer.pricingContext) &&
      (offer.profit?.status !== "calculated" ||
        offer.profit.dutyStatus === "known")
  );
  const ordered = priceMode
    ? [...rows].sort((a, b) => {
        if (a.offer.isYourSupplier !== b.offer.isYourSupplier) {
          return a.offer.isYourSupplier ? -1 : 1;
        }
        const sale = (row: typeof a) =>
          row.offer.profit?.status === "calculated"
            ? row.offer.profit.sale
            : Infinity;
        return sale(a) - sale(b);
      })
    : rows;
  const lastCurrent = ordered.reduce(
    (found, row, index) => (row.offer.isYourSupplier ? index : found),
    -1
  );
  const tableRows: TableRow[] = ordered.map(({ offer, indent }, index) => {
    const profit = offer.profit?.status === "calculated" ? offer.profit : null;
    const highlighted = canRank && offer.mostKept;
    const versus = !currentName
      ? []
      : [
          versusCurrent(
            offer,
            data.currency,
            priceMode ? "charge" : "keep"
          ),
        ];
    return {
      cells: [
        supplierCell(offer, indent),
        hasPrice(offer) ? money(offer.delivered, data.currency) : UNKNOWN,
        ...(showFees
          ? [profit ? money(profit.fees, data.currency) : UNKNOWN]
          : []),
        ...(priceMode
          ? [profit ? money(profit.sale, data.currency) : UNKNOWN]
          : []),
        profit ? money(profit.keep, data.currency) : UNKNOWN,
        ...versus,
        highlighted ? (priceMode ? "lowest price" : "keeps most") : "",
      ],
      paint: highlighted ? line => style.bold(style.green(line)) : undefined,
      ruleAfter: index === lastCurrent && lastCurrent < ordered.length - 1,
    };
  });
  return renderTable(columns, tableRows, style.dim);
}

const PROFIT_NEEDS = {
  salesChannel: "--on etsy (or shopify, woocommerce, tiktok-shop)",
  shopLocation: "--shop-in US (the country your shop is in)",
} as const;

function profitFooter(
  session: Session,
  data: CompareProductSuccess,
  rows: readonly ComparisonOffer[]
) {
  const { profit } = data;
  const lines: string[] = [];
  if (profit.status === "needs_input") {
    lines.push(
      `To see what you keep, add ${profit.missing.map(key => PROFIT_NEEDS[key]).join(" and ")}. Save them once with \`podbenchmark config set\`.`
    );
  } else if (profit.status === "unavailable") {
    lines.push(profit.message);
  } else if (profit.status === "ready") {
    const label = profit.salesChannelLabel;
    if (profit.mode === "target-margin") {
      lines.push(
        `Charge = the price that leaves you ${profit.targetMargin}% of the sale after product + shipping, deducted duty and ${label} fees. Before tax.`
      );
    } else if (sameFees(rows)) {
      const calculated = rows.find(
        offer => offer.profit?.status === "calculated"
      )?.profit;
      if (calculated?.status === "calculated") {
        const parts = calculated.feeBreakdown
          .map(fee => `${fee.label} ${money(fee.amount, data.currency)}`)
          .join(" + ");
        lines.push(
          `You keep = ${money(profit.sellingPrice, data.currency)} − (product + shipping) − deducted duty − ${money(calculated.fees, data.currency)} ${label} fees${parts ? ` (${parts})` : ""}. Before tax.`
        );
      }
    } else {
      lines.push(
        `You keep = ${money(profit.sellingPrice, data.currency)} − (product + shipping) − deducted duty − ${label} fees. Before tax.`
      );
    }
    if (profit.fallbackFromLabel) {
      lines.push(
        `No ${profit.fallbackFromLabel} fees are on file for a shop in ${DESTINATION_NAMES[profit.shopLocation]}, so ${label} fees are used.`
      );
    }
    if (profit.feesCheckedAt)
      lines.push(
        `${label} fees checked ${readableDate(profit.feesCheckedAt)}.`
      );
  }
  return lines;
}

function priceDates(offers: readonly ComparisonOffer[]) {
  const dates = offers
    .map(offer => dateOnly(offer.checkedAt))
    .filter((date): date is string => date !== null)
    .sort();
  const first = dates[0];
  const last = dates[dates.length - 1];
  if (first === undefined || last === undefined) return null;
  return `Prices checked ${readableDateRange(first, last)}.`;
}

function pricingDisclosures(
  offer: ComparisonOffer,
  currency: CompareProductSuccess["currency"],
  label = supplierCell(offer)
) {
  const estimate = offer.dutyEstimate;
  const range = estimate?.converted ?? estimate?.native;
  const duty =
    offer.duty !== null
      ? `Duty ${money(offer.duty, offer.currency ?? currency)} (separate)`
      : range
        ? `Estimated duty ${money(range.max, range.currency)}${estimate?.converted ? "" : " (not converted)"} (separate)`
        : "Duty unverified (separate)";
  const lines = [`${label}: ${duty}.`];
  if (offer.pricingBasis) lines.push(`${label}: ${offer.pricingBasis}`);
  if (offer.profit?.status === "calculated") {
    lines.push(`${label}: ${offer.profit.qualification}`);
  } else if (offer.profit?.reason === "target_not_reachable") {
    lines.push(`${label}: target margin is out of reach.`);
  }
  return lines;
}

export function renderCompare(
  session: Session,
  data: CompareProductSuccess,
  view: CompareView
) {
  const { style } = session;
  const rows = flatten(data.suppliers, data.supplier !== null);
  const offers = rows.map(row => row.offer);
  const choices = Object.values(data.optionChoices);
  const where = `delivered to ${DESTINATION_NAMES[data.destination]} in ${data.currency}`;
  const lines = [
    ...(view.fromLink
      ? [style.dim(`From your ${data.yourSupplier?.name ?? "supplier"} link.`)]
      : []),
    style.bold([data.product.name, ...choices, where].join(" · ")),
  ];
  const { profit } = data;
  // The response decides the view: a target margin shows prices to charge,
  // whichever command asked for it.
  const priceMode =
    profit.status === "ready" && profit.mode === "target-margin";
  const context: string[] = [];
  if (data.supplier) context.push(`${data.supplier.name} only`);
  if (data.pricingTier !== "base") context.push(`${data.pricingTier} plan`);
  if (profit.status === "ready") {
    context.push(
      profit.mode === "selling-price"
        ? `selling at ${money(profit.sellingPrice, data.currency)} on ${profit.salesChannelLabel}`
        : `target margin ${profit.targetMargin}% on ${profit.salesChannelLabel}`
    );
  }
  if (data.yourSupplier)
    context.push(`your supplier: ${data.yourSupplier.name}`);
  if (context.length > 0) lines.push(style.dim(context.join(" · ")));
  lines.push("");

  if (rows.length === 0) {
    lines.push("No supplier has a price for this choice.");
  } else if (profit.status === "ready") {
    lines.push(profitTable(session, data, rows, priceMode));
  } else {
    lines.push(deliveredTable(session, data, rows));
  }

  const footer: string[] = profitFooter(session, data, offers);
  footer.push(
    "Product + shipping excludes duty and sales tax; duty is shown separately."
  );
  for (const offer of offers) {
    footer.push(...pricingDisclosures(offer, data.currency));
  }
  const warnings = new Set(
    offers.flatMap(offer =>
      offer.buyerImportWarning ? [offer.buyerImportWarning] : []
    )
  );
  footer.push(...warnings);
  const dates = priceDates(offers);
  if (dates) footer.push(dates);
  for (const offer of offers) {
    if (offer.note) footer.push(`${offer.supplier}: ${offer.note}`);
  }
  if (data.yourSupplier && !data.yourSupplier.sellsProduct) {
    footer.push(
      `${data.yourSupplier.name} does not sell this product in this size and color.`
    );
  }
  if (footer.length > 0) lines.push("", ...footer.map(style.dim));

  if (view.similar && data.alternatives.length > 0) {
    lines.push(
      "",
      style.bold("Similar products (a different blank, not an exact match)")
    );
    lines.push(
      renderTable(
        [
          { header: "SUPPLIER", maxWidth: 28 },
          { header: "PRODUCT", maxWidth: 44 },
          { header: "PRODUCT + SHIPPING", align: "right" },
        ],
        data.alternatives.map(group => ({
          cells: [
            supplierCell(group.offer),
            group.offer.product,
            hasPrice(group.offer)
              ? money(group.offer.delivered, data.currency)
              : UNKNOWN,
          ],
        })),
        style.dim
      )
    );
    for (const { offer } of data.alternatives) {
      const label = `${supplierCell(offer)} · ${offer.product}`;
      lines.push(...pricingDisclosures(offer, data.currency, label).map(style.dim));
      if (offer.buyerImportWarning) lines.push(style.dim(`${label}: ${offer.buyerImportWarning}`));
      if (offer.note) lines.push(style.dim(`${label}: ${offer.note}`));
    }
    const alternativeDates = priceDates(data.alternatives.map(group => group.offer));
    if (alternativeDates) lines.push(style.dim(alternativeDates));
  }
  lines.push("", `Full comparison  ${data.product.url}`);
  return lines.join("\n");
}
