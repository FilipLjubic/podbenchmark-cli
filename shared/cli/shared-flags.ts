/** Names and help text shared by the CLI and its public reference. */
export const CLI_SHARED_FLAGS = {
	to: { name: "to", meaning: "US, GB, DE, CA or AU", description: "Where the buyer lives: US, GB, DE, CA or AU (default US)." },
	currency: { name: "currency", meaning: "USD, EUR, GBP, CAD or AUD", description: "Currency for every price: USD, EUR, GBP, CAD or AUD (default: the destination's own)." },
	json: { name: "json", meaning: "The result as JSON", description: "Print the result as JSON, exactly as the service returns it." },
	table: { name: "table", meaning: "Tables even when output is piped", description: "Print tables even when output is piped or an agent is detected." },
	schema: { name: "schema", meaning: "The JSON's shape", description: "Print the JSON Schema of this command's input and output, then exit." },
	dryRun: { name: "dry-run", meaning: "Show the request without sending it", description: "Print the request that would be sent, without sending it." },
	limit: { name: "limit", meaning: "How many rows", description: "How many results to show." },
	offset: { name: "offset", meaning: "How many rows to skip", description: "How many results to skip." },
} as const;
