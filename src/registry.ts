import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Registry, Store } from "./types.js";

/** Registry source of truth: registry/stores.json in the repo (v0.1, git-backed). */
export function registryPath(): string {
  const env = process.env.SHELFSIGNAL_REGISTRY;
  if (env) return env;
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(here, "..", "registry", "stores.json"),
    join(here, "..", "..", "registry", "stores.json"),
    join(process.cwd(), "registry", "stores.json"),
  ];
  for (const c of candidates) if (existsSync(c)) return c;
  return candidates[0];
}

export function loadRegistry(path = registryPath()): Registry {
  const raw = readFileSync(path, "utf8");
  const parsed = JSON.parse(raw) as Registry;
  if (!Array.isArray(parsed.stores)) throw new Error(`Registry at ${path} has no stores array`);
  return parsed;
}

export function getStore(reg: Registry, id: string): Store | undefined {
  return reg.stores.find((s) => s.id === id);
}

const norm = (s: string) => s.toLowerCase().trim();

export function searchStores(
  reg: Registry,
  opts: { query?: string; city?: string; category?: string; type?: string } = {},
): Store[] {
  return reg.stores.filter((s) => {
    if (opts.city && norm(s.city) !== norm(opts.city)) return false;
    if (opts.type && norm(s.type) !== norm(opts.type)) return false;
    if (opts.category && !s.categories.some((c) => norm(c).includes(norm(opts.category!)))) return false;
    if (opts.query) {
      const q = norm(opts.query);
      const hay = [s.name, s.type, s.city, s.neighborhood ?? "", ...s.categories, ...s.items.map((i) => i.name)].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export interface ItemHit {
  store: Store;
  item: Store["items"][number];
}

export function searchItems(reg: Registry, query: string, city?: string): ItemHit[] {
  const q = norm(query);
  const hits: ItemHit[] = [];
  for (const store of reg.stores) {
    if (city && norm(store.city) !== norm(city)) continue;
    for (const item of store.items) {
      if (norm(item.name).includes(q) || norm(item.category).includes(q)) hits.push({ store, item });
    }
  }
  return hits;
}

export function listCities(reg: Registry): string[] {
  return [...new Set(reg.stores.map((s) => s.city))].sort();
}

export function listCategories(reg: Registry): string[] {
  return [...new Set(reg.stores.flatMap((s) => s.categories))].sort();
}
