#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { loadRegistry, registryPath, getStore, findItem, searchStores, searchItemsScored, listCities, listCategories } from "./registry.js";
import { stockLikelihood } from "./likelihood.js";
import { validateStore } from "./validate.js";
import { processSubmission } from "./submit.js";
import { nearby } from "./geo.js";
import { openNow } from "./hours.js";
import { updateStock } from "./update.js";
import { INTAKE_TEMPLATE, parseIntakeEmail } from "./intake.js";
import type { StockStatus } from "./types.js";

const [cmd, ...args] = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const VALUE_FLAGS = new Set(["--city", "--category", "--type", "--query", "--price", "--radius"]);
const positional: string[] = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (VALUE_FLAGS.has(a)) { i++; continue; }
  if (a.startsWith("--")) continue;
  positional.push(a);
}
const out = (data: unknown) => console.log(JSON.stringify(data, null, 2));

function usage(): void {
  console.log(`ShelfSignal: the open store index for AI agents

Usage:
  shelfsignal list [--city <city>] [--category <cat>] [--type <type>] [--query <text>]
  shelfsignal search <item> [--city <city>]          Find a food or product, scored by stock likelihood
  shelfsignal nearby <lat> <lng> [--radius <km>]      Stores near a point, nearest first
  shelfsignal store <store-id>                        Full listing for one store
  shelfsignal stock <store-id> <item>                 Stock-likelihood verdict with reasons
  shelfsignal ping <store-id> <item> <in|low|out> [--price <n>]   Merchant stock update, written to the registry
  shelfsignal validate <store-id>                     Validation receipt for a listing
  shelfsignal doctor                                  Registry health: tiers, freshness, coverage
  shelfsignal validate-all                            Receipts for every listing
  shelfsignal submit <submission.json> [--write]      Check a merchant intake; --write adds it to the registry
  shelfsignal template                                Print the email submission template for merchants
  shelfsignal intake <email.txt> [--write]            Parse a filled email template; --write adds it
  shelfsignal coverage                                Cities, categories, store count
  shelfsignal mcp                                     Run the MCP server (stdio)
`);
}

/** Print a submission result; with --write, append the store if it validates and the id is new. */
function handleSubmission(result: ReturnType<typeof processSubmission>, write: boolean): void {
  out(result);
  if (result.ok && write) appendStore(result);
  if (!result.ok) process.exitCode = 1;
}

function appendStore(result: ReturnType<typeof processSubmission>): void {
  if (!result.store) return;
  const path = registryPath();
  const reg = loadRegistry(path);
  if (reg.stores.some((s) => s.id === result.store!.id)) {
    console.error(`Store id ${result.store.id} already exists in the registry; not overwritten.`);
    process.exitCode = 1;
    return;
  }
  reg.stores.push(result.store);
  writeFileSync(path, JSON.stringify(reg, null, 2) + "\n");
  console.error(`Wrote ${result.store.id} to ${path}`);
}

async function main(): Promise<void> {
  switch (cmd) {
    case "mcp": {
      const { runMcp } = await import("./mcp.js");
      await runMcp();
      return;
    }
    case "list": {
      out(searchStores(loadRegistry(), { query: flag("query"), city: flag("city"), category: flag("category"), type: flag("type") }));
      return;
    }
    case "search": {
      const query = positional.join(" ");
      if (!query) return usage();
      out(searchItemsScored(loadRegistry(), query, flag("city")).map(({ store, item, verdict }) => ({ storeId: store.id, storeName: store.name, openNow: openNow(store), item, verdict })));
      return;
    }
    case "nearby": {
      const lat = Number(positional[0]);
      const lng = Number(positional[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return usage();
      const radius = flag("radius") ? Number(flag("radius")) : 5;
      out(nearby(loadRegistry().stores, lat, lng, radius).map(({ store, distanceKm }) => ({ storeId: store.id, storeName: store.name, neighborhood: store.neighborhood, distanceKm, openNow: openNow(store) })));
      return;
    }
    case "ping": {
      const [storeId, ...rest] = positional;
      const status: string = rest[rest.length - 1] ?? "";
      const itemName = rest.slice(0, -1).join(" ");
      if (!storeId || !itemName || !["in", "low", "out"].includes(status)) return usage();
      const mapped: StockStatus = status === "in" ? "in_stock" : (status as StockStatus);
      const path = registryPath();
      const reg = loadRegistry(path);
      try {
        const result = updateStock(reg, storeId, itemName, mapped, { price: flag("price") ? Number(flag("price")) : undefined });
        writeFileSync(path, JSON.stringify(reg, null, 2) + "\n");
        out({ updated: result.itemName, store: result.store.name, verdict: result.verdict });
      } catch (err) {
        out({ error: err instanceof Error ? err.message : String(err) });
        process.exitCode = 1;
      }
      return;
    }
    case "doctor": {
      const reg = loadRegistry();
      const receipts = reg.stores.map((s) => validateStore(s));
      const tiers: Record<string, number> = {};
      for (const r of receipts) tiers[r.tier] = (tiers[r.tier] ?? 0) + 1;
      out({
        registry: registryPath(),
        stores: reg.stores.length,
        demoStores: reg.stores.filter((s) => s.demo).length,
        tiers,
        cities: listCities(reg),
        categories: listCategories(reg).length,
        withCoordinates: reg.stores.filter((s) => typeof s.lat === "number").length,
        withStructuredHours: reg.stores.filter((s) => s.hoursStructured).length,
        staleStores: receipts.filter((r) => r.tier === "STALE" || r.tier === "INCOMPLETE").map((r) => r.storeId),
      });
      return;
    }
    case "store": {
      const store = getStore(loadRegistry(), positional[0] ?? "");
      out(store ?? { error: `No store with id ${positional[0]}` });
      return;
    }
    case "stock": {
      const reg = loadRegistry();
      const store = getStore(reg, positional[0] ?? "");
      if (!store) return out({ error: `No store with id ${positional[0]}` });
      const name = positional.slice(1).join(" ");
      const item = findItem(store, name);
      out(item ? stockLikelihood(store, item) : { error: `${store.name} does not list '${name}'`, listedItems: store.items.map((i) => i.name) });
      return;
    }
    case "validate": {
      const store = getStore(loadRegistry(), positional[0] ?? "");
      out(store ? validateStore(store) : { error: `No store with id ${positional[0]}` });
      return;
    }
    case "validate-all": {
      out(loadRegistry().stores.map((s) => validateStore(s)));
      return;
    }
    case "submit": {
      const file = positional[0];
      if (!file) return usage();
      handleSubmission(processSubmission(JSON.parse(readFileSync(file, "utf8"))), args.includes("--write"));
      return;
    }
    case "template": {
      console.log(INTAKE_TEMPLATE);
      return;
    }
    case "intake": {
      const file = positional[0];
      if (!file) return usage();
      const parsed = parseIntakeEmail(readFileSync(file, "utf8"));
      const result = processSubmission(parsed.raw);
      out({ parseProblems: parsed.problems, unparsedLines: parsed.unparsed, ...result });
      if (parsed.problems.length > 0) process.exitCode = 1;
      if (result.ok && args.includes("--write")) appendStore(result);
      if (!result.ok) process.exitCode = 1;
      return;
    }
    case "coverage": {
      const reg = loadRegistry();
      out({ cities: listCities(reg), categories: listCategories(reg), stores: reg.stores.length });
      return;
    }
    default:
      usage();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
