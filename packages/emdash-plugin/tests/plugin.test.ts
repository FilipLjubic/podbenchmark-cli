import { afterEach, describe, expect, it } from "vitest";

import { createPluginTestHost, type PluginTestHost } from "@emdash-cms/plugin-test";

/**
 * How this plugin could fail a site's agent:
 * - a route forwards to the wrong URL, or drops the agent's input;
 * - an API error turns into a thrown route error instead of the service's
 *   own message the agent can act on;
 * - the manifest marks defaulted fields required, so agents must fill every one;
 * - a tool points at a route that doesn't exist.
 * The live test goes through EmDash's production sandbox to podbenchmark.com.
 */

let host: PluginTestHost | undefined;

afterEach(async () => {
	await host?.dispose();
	host = undefined;
});

describe("manifest", () => {
	it("exposes every tool on its own route, with defaulted fields optional", async () => {
		host = await createPluginTestHost();
		const { mcp, routes } = host.manifest as unknown as {
			mcp: { tools: Array<{ name: string; route: string; inputSchema: { required?: string[] } }> };
			routes: Array<string | { name: string }>;
		};
		const routeNames = routes.map((route) => (typeof route === "string" ? route : route.name));
		expect(mcp.tools.map((tool) => tool.name)).toContain("compare_product");
		for (const tool of mcp.tools) expect(routeNames).toContain(tool.route);
		const search = mcp.tools.find((tool) => tool.name === "search_products");
		expect(search?.inputSchema.required ?? []).toEqual([]);
	});
});

describe("live POD Benchmark API", { timeout: 30_000 }, () => {
	it("searches products through the sandbox", async () => {
		host = await createPluginTestHost();
		const result = (await host.invokeRoute("tools/search_products", {
			query: "bella canvas 3001",
			limit: 1,
		})) as { ok: boolean; products?: Array<{ canonicalProductId: string }> };
		expect(result.ok).toBe(true);
		expect(result.products?.length).toBe(1);
	});

	it("returns the service's own error for an unknown product", async () => {
		host = await createPluginTestHost();
		const result = (await host.invokeRoute("tools/get_product", {
			canonicalProductId: "no-such-product-anywhere",
		})) as { ok: boolean; error?: { code: string; message: string } };
		expect(result.ok).toBe(false);
		expect(result.error?.code).toBe("not_found");
	});
});
