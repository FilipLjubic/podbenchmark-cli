import { z } from "zod";
import { isMinorUnitAmount } from "./duty-rules";

// Browser code imports `duty-rules` directly so the schema library stays out
// of its bundle; this module adds the schemas the server and scripts parse with.
export * from "./duty-rules";

const DutyCurrencySchema = z.enum(["USD", "EUR", "GBP", "AUD", "CAD"]);
const DutyAmountSchema = z.number().finite().nonnegative().refine(
	isMinorUnitAmount,
	"Duty amounts must be safe minor-unit values",
);
const DutyRangeFields = {
	min: DutyAmountSchema,
	max: DutyAmountSchema,
	currency: DutyCurrencySchema,
};
const DutyRangeSchema = z.strictObject(DutyRangeFields).refine(range => range.min <= range.max);

export const supplierDutyEstimateSchema = z.strictObject({
	...DutyRangeFields,
	basis: z.literal("line_net_x_compatible_product_rate"),
}).refine(range => range.min < range.max);

export const supplierDutyEstimateProjectionSchema = z.strictObject({
	native: supplierDutyEstimateSchema,
	converted: DutyRangeSchema.nullable(),
});
