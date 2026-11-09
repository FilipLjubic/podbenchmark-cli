#!/usr/bin/env bun
/// <reference types="bun" />
/**
 * Writes src/tools.json from the POD Benchmark public tool contract
 * (shared/public-api/tools.ts): each tool's name, description and the input
 * schema an agent fills in. Runs before every build, so a release always
 * carries the current contract without bundling zod into the sandbox.
 *
 * The input side of each schema keeps fields with defaults optional, as the
 * POD Benchmark MCP server shows them; the service applies the defaults.
 */
import { PUBLIC_TOOL_NAMES, PUBLIC_TOOLS } from "../../../shared/public-api/tools";

const tools = PUBLIC_TOOL_NAMES.map((name) => ({
	name,
	description: PUBLIC_TOOLS[name].description,
	// The schema's own method, so the zod copy that built it converts it.
	inputSchema: PUBLIC_TOOLS[name].inputSchema.toJSONSchema({ io: "input", target: "draft-7" }),
}));

await Bun.write(new URL("../src/tools.json", import.meta.url), `${JSON.stringify(tools, null, "\t")}\n`);
console.log(`Wrote ${tools.length} tools to src/tools.json`);
