import { createClosedStringLookup } from "../kernel/closed-string-lookup";
import { captureGroup } from "../kernel/required";

/**
 * A device-fit token's brand and model ("iphone-16-pro" is Apple iPhone 16
 * Pro). The profile builder stores this identity as fit evidence, and size
 * labels name a device model with it, so both read the token the same way.
 */
type DeviceIdentity = {
	brand: string;
	model: string;
	system: "earphones" | "laptop" | "phone" | "tablet" | "watch";
	compatibilitySet?: string[];
};

const REVIEWED_IPHONE_COMPATIBILITY_SET_MODELS = {
	"5-5s-5se": ["iPhone 5", "iPhone 5S", "iPhone SE"],
	"6-6s": ["iPhone 6", "iPhone 6S"],
	"6-6s-plus": ["iPhone 6 Plus", "iPhone 6S Plus"],
	"7-plus-8-plus": ["iPhone 7 Plus", "iPhone 8 Plus"],
	"7-8-se": ["iPhone 7", "iPhone 8", "iPhone SE"],
	"12-12-pro": ["iPhone 12", "iPhone 12 Pro"],
	"x-xs": ["iPhone X", "iPhone XS"],
} as const satisfies Readonly<Record<string, readonly string[]>>;

const lookupReviewedIphoneCompatibilitySet = createClosedStringLookup(
	REVIEWED_IPHONE_COMPATIBILITY_SET_MODELS,
);

export function deviceIdentityFromToken(token: string): DeviceIdentity | null {
	if (token.startsWith("iphone-")) {
		const compatibilitySet = iphoneCompatibilitySetFromToken(
			token.slice("iphone-".length),
		);
		if (compatibilitySet) {
			return {
				brand: "Apple",
				model: compatibilitySet.join(" / "),
				system: "phone",
				compatibilitySet,
			};
		}
		return {
			brand: "Apple",
			model: `iPhone ${titleizeDeviceToken(token.slice("iphone-".length))}`,
			system: "phone",
		};
	}
	if (token.startsWith("samsung-galaxy-")) {
		return {
			brand: "Samsung",
			model: `Galaxy ${titleizeDeviceToken(token.slice("samsung-galaxy-".length))}`,
			system: "phone",
		};
	}
	if (token.startsWith("google-pixel")) {
		const suffix = token.slice("google-pixel".length).replace(/^-/, "");
		return {
			brand: "Google",
			model: suffix ? `Pixel ${titleizeDeviceToken(suffix)}` : "Pixel",
			system: "phone",
		};
	}
	if (token.startsWith("apple-watch-")) {
		return { brand: "Apple", model: `Apple Watch ${token.slice("apple-watch-".length)}`, system: "watch" };
	}
	if (token.startsWith("apple-airpods")) {
		const suffix = token.slice("apple-airpods".length).replace(/^-/, "");
		return {
			brand: "Apple",
			model: suffix ? `AirPods ${titleizeDeviceToken(suffix)}` : "AirPods",
			system: "earphones",
		};
	}
	if (token.startsWith("apple-macbook-")) {
		return {
			brand: "Apple",
			model: `MacBook ${titleizeDeviceToken(token.slice("apple-macbook-".length))}`,
			system: "laptop",
		};
	}
	if (token.startsWith("apple-ipad-")) {
		return {
			brand: "Apple",
			model: `iPad ${titleizeDeviceToken(token.slice("apple-ipad-".length))}`,
			system: "tablet",
		};
	}
	return null;
}

function iphoneCompatibilitySetFromToken(token: string): string[] | null {
	const reviewedModels = lookupReviewedIphoneCompatibilitySet(token);
	if (reviewedModels) return [...reviewedModels];

	const parts = token.split("-").filter(Boolean);
	const models: string[] = [];
	let index = 0;
	while (index < parts.length) {
		const parsed = parseIphoneModelToken(parts, index);
		if (!parsed) return null;
		models.push(parsed.model);
		index = parsed.nextIndex;
	}
	return models.length >= 2 ? models : null;
}

function parseIphoneModelToken(
	parts: readonly string[],
	index: number,
): { model: string; nextIndex: number } | null {
	const part = parts[index];
	if (!part) return null;
	if (part === "se") return { model: "iPhone SE", nextIndex: index + 1 };
	if (part === "x" || part === "xr" || part === "xs") {
		const hasMax = parts[index + 1] === "max";
		return {
			model: `iPhone ${titleizeDeviceToken(hasMax ? `${part}-max` : part)}`,
			nextIndex: index + (hasMax ? 2 : 1),
		};
	}
	const compactMatch = part.match(/^(\d+)(s|se)$/i);
	if (compactMatch) {
		return {
			model: `iPhone ${compactMatch[1]}${captureGroup(compactMatch, 2).toUpperCase()}`,
			nextIndex: index + 1,
		};
	}
	if (!/^\d+$/.test(part)) return null;
	let nextIndex = index + 1;
	let suffix = "";
	const next = parts[nextIndex];
	if (next && ["s", "se", "air", "mini", "plus"].includes(next)) {
		suffix = next;
		nextIndex += 1;
	} else if (next === "pro") {
		suffix = parts[nextIndex + 1] === "max" ? "pro-max" : "pro";
		nextIndex += suffix === "pro-max" ? 2 : 1;
	}
	return {
		model: `iPhone ${titleizeDeviceToken([part, suffix].filter(Boolean).join("-"))}`,
		nextIndex,
	};
}

function titleizeDeviceToken(value: string): string {
	return value
		.split("-")
		.filter(Boolean)
		.map(part => {
			if (/^\d/.test(part)) return part;
			if (part.length <= 2) return part.toUpperCase();
			return part[0]!.toUpperCase() + part.slice(1);
		})
		.join(" ");
}

