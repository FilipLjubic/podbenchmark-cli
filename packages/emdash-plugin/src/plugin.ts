import type { PluginContext, SandboxedMcpTool, SandboxedPlugin } from "emdash/plugin";

import pkg from "../package.json";
import tools from "./tools.json";

/**
 * POD Benchmark tools for an EmDash site's AI agent. Each public POD Benchmark
 * tool becomes a private route that forwards its input to
 * podbenchmark.com/api/v1/tools/<name>, and an MCP tool that points at it.
 * `tools.json` is generated from the contract the POD Benchmark MCP server and
 * CLI use (scripts/generate-tools.ts), so all three answer the same way.
 */

const ORIGIN = "https://podbenchmark.com";
const CLIENT_HEADER = "X-Podbenchmark-Client";
const CLIENT = `emdash-plugin/${pkg.version}`;

/** The service's own JSON: `{ ok: true, ... }` or `{ ok: false, error }`. */
async function callTool(name: string, input: unknown, ctx: PluginContext) {
	if (!ctx.http) throw new Error("POD Benchmark needs the network:request capability.");
	let response: Response;
	try {
		response = await ctx.http.fetch(`${ORIGIN}/api/v1/tools/${name}`, {
			method: "POST",
			headers: { "Content-Type": "application/json", [CLIENT_HEADER]: CLIENT },
			body: JSON.stringify(input ?? {}),
		});
	} catch (error) {
		ctx.log.warn("POD Benchmark request failed", { tool: name, error: String(error) });
		return {
			ok: false,
			error: { code: "network", message: "Could not reach podbenchmark.com. Try again in a moment." },
		};
	}
	try {
		return (await response.json()) as unknown;
	} catch {
		return {
			ok: false,
			error: {
				code: "network",
				message: `podbenchmark.com answered with something unexpected (HTTP ${response.status}).`,
			},
		};
	}
}

const routes: NonNullable<SandboxedPlugin["routes"]> = {};
const mcpTools: Record<string, SandboxedMcpTool> = {};

for (const tool of tools) {
	const route = `tools/${tool.name}`;
	routes[route] = {
		methods: ["POST"],
		// Any signed-in user may look up prices; the tools read no site data.
		permission: "content:read",
		handler: async (routeCtx, ctx) => callTool(tool.name, routeCtx.input, ctx),
	};
	mcpTools[tool.name] = {
		description: tool.description,
		route,
		// The plugin CLI writes a JSON Schema object into the manifest as-is
		// (it accepts "Zod schemas or JSON Schema objects"); the type only names Zod.
		input: tool.inputSchema as unknown as SandboxedMcpTool["input"],
		destructive: false,
	};
}

const plugin: SandboxedPlugin = { routes, mcp: { tools: mcpTools } };

export default plugin;
