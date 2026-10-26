import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { Registry, Store } from "./types.js";
import { getLiveStore, liveRegistry, loadRegistry, searchItemsScored, searchStores } from "./registry.js";
import { validateStore } from "./validate.js";
import { openNow } from "./hours.js";

/**
 * Hosted registry API: the read-only HTTP face of the store index.
 *
 * Dependency-light by design: Node's built-in http module only, the same
 * registry file the CLI and MCP server read, and the same search helpers,
 * so the API can never drift from what agents already see over MCP.
 *
 * Public means live. Every route serves the live view of the registry
 * (see liveRegistry): listings still in the intake queue (received, parsed,
 * needs-info, ready, approved, or paid) are excluded everywhere, including
 * detail lookups, where they return 404 exactly like an unknown id.
 *
 * Routes (the unversioned paths are aliases of the /v1 paths):
 *   GET /health                  service status and live store count
 *   GET /v1/stores               live listings; filters: q, city, category, type
 *   GET /v1/stores/<id>          one live listing plus its validation receipt
 *   GET /v1/search?q=<term>      live listings matching a term, plus scored item hits
 *                                (also accepts category, city, and type filters)
 */

export interface ApiOptions {
  /** Fixed registry to serve. When omitted, the registry file is re-read on every request, so a pushed registry update goes live without a restart. */
  registry?: Registry;
  /** Clock override, used by tests for deterministic receipts and verdicts. */
  now?: () => Date;
}

type ApiStore = Store & { openNow: boolean | null };

const present = (store: Store, now: Date): ApiStore => ({ ...store, openNow: openNow(store, now) });

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  const body = JSON.stringify(data, null, 2);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "cache-control": "no-store",
  });
  res.end(body);
}

export function createApiServer(opts: ApiOptions = {}): Server {
  const now = opts.now ?? (() => new Date());
  const load = (): Registry => opts.registry ?? loadRegistry();

  return createServer((req: IncomingMessage, res: ServerResponse) => {
    try {
      if (req.method === "OPTIONS") {
        res.writeHead(204, {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET, OPTIONS",
          "access-control-allow-headers": "content-type",
        });
        res.end();
        return;
      }
      if (req.method !== "GET") {
        sendJson(res, 405, { error: "method not allowed: the registry API is read-only" });
        return;
      }

      const url = new URL(req.url ?? "/", "http://localhost");
      const path = url.pathname.replace(/\/+$/, "") || "/";
      const param = (name: string) => url.searchParams.get(name) ?? undefined;

      if (path === "/health") {
        const live = liveRegistry(load());
        sendJson(res, 200, { ok: true, service: "shelfsignal", stores: live.stores.length });
        return;
      }

      const route = path.startsWith("/v1/") ? path.slice(3) : path;

      if (route === "/stores") {
        const live = liveRegistry(load());
        const stores = searchStores(live, {
          query: param("q") ?? param("query"),
          city: param("city"),
          category: param("category"),
          type: param("type"),
        });
        sendJson(res, 200, { count: stores.length, stores: stores.map((s) => present(s, now())) });
        return;
      }

      if (route.startsWith("/stores/")) {
        const id = decodeURIComponent(route.slice("/stores/".length));
        if (!id || id.includes("/")) {
          sendJson(res, 404, { error: `No live store with id ${id}` });
          return;
        }
        const store = getLiveStore(load(), id);
        if (!store) {
          sendJson(res, 404, { error: `No live store with id ${id}` });
          return;
        }
        const at = now();
        sendJson(res, 200, { store: present(store, at), receipt: validateStore(store, at) });
        return;
      }

      if (route === "/search") {
        const q = (param("q") ?? param("query") ?? "").trim();
        const category = param("category");
        if (!q && !category) {
          sendJson(res, 400, { error: "search needs a q (or query) term, or a category" });
          return;
        }
        const live = liveRegistry(load());
        const at = now();
        const stores = searchStores(live, { query: q || undefined, city: param("city"), category, type: param("type") });
        const items = q
          ? searchItemsScored(live, q, param("city"), at)
              .filter((hit) => !category || hit.store.categories.some((c) => c.toLowerCase().includes(category.toLowerCase())))
              .map(({ store, item, verdict }) => ({ storeId: store.id, storeName: store.name, openNow: openNow(store, at), item, verdict }))
          : [];
        sendJson(res, 200, { query: q, category: category ?? null, count: stores.length, stores: stores.map((s) => present(s, at)), items });
        return;
      }

      sendJson(res, 404, { error: `not found: ${path}`, routes: ["/health", "/v1/stores", "/v1/stores/<id>", "/v1/search?q=<term>"] });
    } catch (err) {
      sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
    }
  });
}

/** Start the hosted registry API. Resolves once the server is listening. */
export function startApiServer(port = 8787, host = "0.0.0.0", opts: ApiOptions = {}): Promise<Server> {
  const server = createApiServer(opts);
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => resolve(server));
  });
}
