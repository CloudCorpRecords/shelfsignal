import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { loadRegistry, getStore, searchStores, searchItems, listCities, listCategories } from "./registry.js";
import { stockLikelihood } from "./likelihood.js";
import { validateStore } from "./validate.js";
import { processSubmission } from "./submit.js";

const text = (data: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] });

export async function runMcp(): Promise<void> {
  const server = new McpServer({ name: "shelfsignal", version: "0.1.0" });

  server.tool(
    "search_stores",
    "Find real local stores (restaurants, groceries, bakeries, bodegas, markets) in a city. Returns merchant-submitted listings, not scraped delivery-app menus.",
    {
      query: z.string().optional().describe("Free text matched against store names, categories, and items."),
      city: z.string().optional().describe("City name, e.g. San Francisco."),
      category: z.string().optional().describe("Category filter, e.g. tacos, bakery, produce."),
      type: z.string().optional().describe("Store type: restaurant, grocery, bakery, bodega, cafe, pharmacy, butcher, market, retail."),
    },
    async (args) => text(searchStores(loadRegistry(), args)),
  );

  server.tool(
    "search_items",
    "Find a specific food or product across listed stores, e.g. 'birria tacos' or 'oat milk'. Pair with check_stock before telling a human a store has it.",
    {
      query: z.string().describe("Item or food to find."),
      city: z.string().optional().describe("Limit to one city."),
    },
    async ({ query, city }) =>
      text(searchItems(loadRegistry(), query, city).map(({ store, item }) => ({ storeId: store.id, storeName: store.name, neighborhood: store.neighborhood, item }))),
  );

  server.tool(
    "get_store",
    "Full listing for one store by registry id: hours, address, fulfillment, and every item with its last-confirmed stock status.",
    { store_id: z.string().describe("Registry id, e.g. sf-mission-taqueria-demo.") },
    async ({ store_id }) => {
      const store = getStore(loadRegistry(), store_id);
      return text(store ?? { error: `No store with id ${store_id}` });
    },
  );

  server.tool(
    "check_stock",
    "Score how likely a store actually has an item right now. Returns a 0-100 score, a band (likely / probable / uncertain / unlikely), and the reasons. Never present an 'uncertain' or 'unlikely' verdict to a human as available.",
    {
      store_id: z.string().describe("Registry id of the store."),
      item: z.string().describe("Item name as listed, e.g. 'Birria tacos'."),
    },
    async ({ store_id, item }) => {
      const reg = loadRegistry();
      const store = getStore(reg, store_id);
      if (!store) return text({ error: `No store with id ${store_id}` });
      const found = store.items.find((i) => i.name.toLowerCase() === item.toLowerCase())
        ?? store.items.find((i) => i.name.toLowerCase().includes(item.toLowerCase()));
      if (!found) return text({ error: `${store.name} does not list '${item}'`, listedItems: store.items.map((i) => i.name) });
      return text(stockLikelihood(store, found));
    },
  );

  server.tool(
    "validate_store",
    "Run the ShelfSignal validation checks on a listing and return its receipt: tier (VERIFIED / LISTED / STALE / INCOMPLETE), score, and every check with its evidence. Use this before recommending a store you have not used before.",
    { store_id: z.string().describe("Registry id of the store.") },
    async ({ store_id }) => {
      const store = getStore(loadRegistry(), store_id);
      return text(store ? validateStore(store) : { error: `No store with id ${store_id}` });
    },
  );

  server.tool(
    "submit_store",
    "Validate a merchant submission (the $100 Starter Store intake) and preview exactly how it would appear in the registry, with its validation receipt. Does not charge anything and does not publish until the listing is merged into the registry.",
    { submission: z.record(z.unknown()).describe("The merchant submission object; see examples/submission.example.json for the shape.") },
    async ({ submission }) => text(processSubmission(submission)),
  );

  server.tool(
    "list_coverage",
    "Which cities and categories the index currently covers, with store counts. Check coverage before promising a human you can search somewhere.",
    {},
    async () => {
      const reg = loadRegistry();
      return text({ cities: listCities(reg), categories: listCategories(reg), stores: reg.stores.length });
    },
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
