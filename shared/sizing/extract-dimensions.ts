import { createClosedStringLookup } from "../kernel/closed-string-lookup";

export interface Dimensions {
	width: number;
	height: number;
	unit: "in" | "cm" | "mm";
}

type SizeBucket = "small" | "medium" | "large" | "extra-large";

const ISO_SIZES = {
	a0: { width: 841, height: 1189 },
	a1: { width: 594, height: 841 },
	a2: { width: 420, height: 594 },
	a3: { width: 297, height: 420 },
	a4: { width: 210, height: 297 },
	a5: { width: 148, height: 210 },
} satisfies Record<string, { width: number; height: number }>;

const US_PAPER_SIZES = {
	letter: { width: 8.5, height: 11 },
	legal: { width: 8.5, height: 14 },
	tabloid: { width: 11, height: 17 },
	ledger: { width: 17, height: 11 },
} satisfies Record<string, { width: number; height: number }>;
const lookupIsoSize = createClosedStringLookup(ISO_SIZES);
const lookupUsPaperSize = createClosedStringLookup(US_PAPER_SIZES);

const MM_PER_INCH = 25.4;
const CM_PER_INCH = 2.54;

export const parseDimensions = (sizeString: string): Dimensions | null => {
	if (!sizeString || typeof sizeString !== "string") {
		return null;
	}

	const normalized = sizeString.trim().toLowerCase();

	const isoMatch = normalized.match(/^a([0-5])$/);
	if (isoMatch) {
		const size = lookupIsoSize(`a${isoMatch[1]}`);
		if (size) {
			return { width: size.width, height: size.height, unit: "mm" };
		}
	}

	const usPaperSize = lookupUsPaperSize(normalized);
	if (usPaperSize) {
		return { width: usPaperSize.width, height: usPaperSize.height, unit: "in" };
	}

	const dimensionText = normalized
		.replace(/[“”″]/g, '"')
		.replace(/′/g, "'")
		.replace(/''/g, '"');

	const dimensionMatch = dimensionText.match(
		/(\d+(?:\.\d+)?)\s*(mm|cm|in|inch|inches|")?\s*[×x]\s*(\d+(?:\.\d+)?)\s*(mm|cm|in|inch|inches|")?/i,
	);

	if (dimensionMatch) {
		// Both number groups are required by the pattern.
		const width = parseMatchedNumber(dimensionMatch, 1);
		const height = parseMatchedNumber(dimensionMatch, 3);
		if (width <= 0 || height <= 0) {
			return null;
		}
		const unitRaw = (dimensionMatch[4] ?? dimensionMatch[2])?.toLowerCase();

		let unit: "in" | "cm" | "mm" = "in";
		if (unitRaw === "mm") {
			unit = "mm";
		} else if (unitRaw === "cm") {
			unit = "cm";
		} else if (unitRaw === "in" || unitRaw === "inch" || unitRaw === "inches" || unitRaw === '"') {
			unit = "in";
		}

		return { width, height, unit };
	}

	return null;
};

export const convertToInches = (dimensions: Dimensions): Dimensions => {
	if (dimensions.unit === "in") {
		return { ...dimensions };
	}

	if (dimensions.unit === "mm") {
		return {
			width: dimensions.width / MM_PER_INCH,
			height: dimensions.height / MM_PER_INCH,
			unit: "in",
		};
	}

	return {
		width: dimensions.width / CM_PER_INCH,
		height: dimensions.height / CM_PER_INCH,
		unit: "in",
	};
};

export const convertToCm = (dimensions: Dimensions): Dimensions => {
	if (dimensions.unit === "cm") {
		return { ...dimensions };
	}

	if (dimensions.unit === "mm") {
		return {
			width: dimensions.width / 10,
			height: dimensions.height / 10,
			unit: "cm",
		};
	}

	return {
		width: dimensions.width * CM_PER_INCH,
		height: dimensions.height * CM_PER_INCH,
		unit: "cm",
	};
};

export const convertToMm = (dimensions: Dimensions): Dimensions => {
	if (dimensions.unit === "mm") {
		return { ...dimensions };
	}

	if (dimensions.unit === "cm") {
		return {
			width: dimensions.width * 10,
			height: dimensions.height * 10,
			unit: "mm",
		};
	}

	return {
		width: dimensions.width * MM_PER_INCH,
		height: dimensions.height * MM_PER_INCH,
		unit: "mm",
	};
};

const getAreaInSquareInches = (dimensions: Dimensions): number => {
	const inInches = convertToInches(dimensions);
	return inInches.width * inInches.height;
};

export const getSizeBucket = (dimensions: Dimensions): SizeBucket => {
	const area = getAreaInSquareInches(dimensions);

	if (area < 100) {
		return "small";
	}
	if (area < 400) {
		return "medium";
	}
	if (area < 900) {
		return "large";
	}
	return "extra-large";
};

export const formatDimensions = (
	dimensions: Dimensions,
	targetUnit?: "in" | "cm" | "mm",
): string => {
	let d = dimensions;
	if (targetUnit && targetUnit !== dimensions.unit) {
		if (targetUnit === "in") {
			d = convertToInches(dimensions);
		} else if (targetUnit === "cm") {
			d = convertToCm(dimensions);
		} else {
			d = convertToMm(dimensions);
		}
	}

	const w = Number.isInteger(d.width) ? d.width : d.width.toFixed(2);
	const h = Number.isInteger(d.height) ? d.height : d.height.toFixed(2);

	return `${w}×${h}${d.unit}`;
};

function parseMatchedNumber(match: RegExpMatchArray, group: number): number {
	return parseFloat(match[group] ?? "");
}
