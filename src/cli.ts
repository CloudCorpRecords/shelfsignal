#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { loadRegistry, registryPath, getStore, searchStores, searchItems, listCities, listCategories } from "./registry.js";
import { stockLikelihood } from "./likelihood.js";
import { validateStore } from "./validate.js";
import { processSubmission } from "./submit.js";

const [cmd, ...args] = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const VALUE_FLAGS = new Set(["--city", "--category", "--type", "--query"]);
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
  shelfsignal search <item> [--city <city>]          Find a food or product across stores
  shelfsignal store <store-id>                        Full listing for one store
  shelfsignal stock <store-id> <item>                 Stock-likelihood verdict with reasons
  shelfsignal validate <store-id>                     Validation receipt for a listing
  shelfsignal validate-all                            Receipts for every listing
  shelfsignal submit <submission.json> [--write]      Check a merchant intake; --write adds it to the registry
  shelfsignal coverage                                Cities, categories, store count
  shelfsignal mcp                                     Run the MCP server (stdio)
`);
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
      out(searchItems(loadRegistry(), query, flag("city")).map(({ store, item }) => ({ storeId: store.id, storeName: store.name, item })));
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
      const item = store.items.find((i) => i.name.toLowerCase() === name.toLowerCase())
        ?? store.items.find((i) => i.name.toLowerCase().includes(name.toLowerCase()));
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
      const result = processSubmission(JSON.parse(readFileSync(file, "utf8")));
      out(result);
      if (result.ok && args.includes("--write") && result.store) {
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
