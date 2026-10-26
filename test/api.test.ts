import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createApiServer } from "../src/api.js";
import { loadRegistry } from "../src/registry.js";
import { isLiveStore, liveStores } from "../src/registry.js";
import type { Registry, Store } from "../src/types.js";

const NOW = new Date("2026-10-25T12:00:00Z");

/** The bundled registry plus one listing in every non-live queue state, sharing a searchable term so a leak is visible. */
function fixtureRegistry(): Registry {
  const base = loadRegistry();
  const template = base.stores[0];
  const queued = (status: Store["status"]): Store => ({
    ...template,
    id: `queued-${status}-store`,
    name: `Queued Birria ${status}`,
    status,
  });
  const legacy: Store = { ...template, id: "legacy-live-store", name: "Legacy Birria Store" };
  delete legacy.status;
  return {
    version: base.version,
    stores: [...base.stores, queued("received"), queued("parsed"), queued("needs-info"), queued("ready"), queued("approved"), queued("paid"), legacy],
  };
}

let server: Server;
let origin: string;

before(async () => {
  server = createApiServer({ registry: fixtureRegistry(), now: () => NOW });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
});

async function get(path: string): Promise<{ status: number; body: any }> {
  const res = await fetch(`${origin}${path}`);
  return { status: res.status, body: await res.json() };
}

test("api: live helpers treat absent status as live and every queue state as not live", () => {
  const reg = fixtureRegistry();
  assert.equal(isLiveStore(reg.stores[0]), true, "explicit live");
  assert.equal(isLiveStore(reg.stores.find((s) => s.id === "legacy-live-store")!), true, "absent status predates the field and means live");
  for (const status of ["received", "parsed", "needs-info", "ready", "approved", "paid"] as const) {
    assert.equal(isLiveStore(reg.stores.find((s) => s.id === `queued-${status}-store`)!), false, status);
  }
  assert.equal(liveStores(reg).length, reg.stores.length - 6);
});

test("api: list returns only live listings", async () => {
  const { status, body } = await get("/v1/stores");
  assert.equal(status, 200);
  assert.equal(body.count, 5, "4 bundled live demos plus the legacy listing");
  assert.ok(body.stores.every((s: Store) => s.status === undefined || s.status === "live"));
  assert.ok(!body.stores.some((s: Store) => s.id.startsWith("queued-")));
  assert.ok(body.stores.some((s: Store) => s.id === "sf-mission-taqueria-demo"));
});

test("api: list filters by city, category, and type", async () => {
  const bakery = await get("/v1/stores?category=bakery");
  assert.equal(bakery.body.count, 1);
  assert.equal(bakery.body.stores[0].type, "bakery");
  const nowhere = await get("/v1/stores?city=Oakland");
  assert.equal(nowhere.body.count, 0);
});

test("api: detail returns one live listing with its validation receipt", async () => {
  const { status, body } = await get("/v1/stores/sf-sunset-bakery-demo");
  assert.equal(status, 200);
  assert.equal(body.store.id, "sf-sunset-bakery-demo");
  assert.equal(body.store.status, "live");
  assert.ok(["VERIFIED", "LISTED"].includes(body.receipt.tier));
  assert.equal(body.receipt.storeId, "sf-sunset-bakery-demo");
});

test("api: detail for an unknown id is a JSON 404", async () => {
  const { status, body } = await get("/v1/stores/no-such-store");
  assert.equal(status, 404);
  assert.ok(body.error.includes("no-such-store"));
});

test("api: a non-live listing is excluded from detail, list, and search, exactly like an unknown id", async () => {
  for (const state of ["received", "ready", "approved", "paid"]) {
    const detail = await get(`/v1/stores/queued-${state}-store`);
    assert.equal(detail.status, 404, `${state} detail must 404`);
  }
  const list = await get("/v1/stores?q=queued%20birria");
  assert.equal(list.body.count, 0, "queue-state names match the term, so any leak would show here");
  const search = await get("/v1/search?q=birria");
  assert.ok(!search.body.stores.some((s: Store) => s.id.startsWith("queued-")));
  assert.ok(!search.body.items.some((hit: any) => String(hit.storeId).startsWith("queued-")));
});

test("api: search finds live stores by term and by category, and requires a term or category", async () => {
  const byTerm = await get("/v1/search?q=birria");
  assert.equal(byTerm.status, 200);
  assert.ok(byTerm.body.stores.some((s: Store) => s.id === "sf-mission-taqueria-demo"));
  assert.ok(byTerm.body.items.some((hit: any) => hit.item.name === "Birria tacos" && hit.verdict.band));
  const byCategory = await get("/v1/search?category=pastries");
  assert.equal(byCategory.body.count, 1);
  assert.equal(byCategory.body.stores[0].id, "sf-sunset-bakery-demo");
  const bare = await get("/v1/search");
  assert.equal(bare.status, 400);
});

test("api: health reports the live count, unknown routes 404, and writes are rejected", async () => {
  const health = await get("/health");
  assert.equal(health.status, 200);
  assert.equal(health.body.ok, true);
  assert.equal(health.body.stores, 5);
  const missing = await get("/v1/nope");
  assert.equal(missing.status, 404);
  const post = await fetch(`${origin}/v1/stores`, { method: "POST", body: "{}" });
  assert.equal(post.status, 405, "the registry API is read-only");
  await post.text();
});

test("api: the bundled registry serves over HTTP with every store live", async () => {
  const live = createApiServer({ now: () => NOW });
  await new Promise<void>((resolve) => live.listen(0, "127.0.0.1", resolve));
  try {
    const port = (live.address() as AddressInfo).port;
    const res = await fetch(`http://127.0.0.1:${port}/v1/stores`);
    const body = await res.json();
    assert.equal(body.count, loadRegistry().stores.length);
    assert.ok(body.stores.every((s: Store) => s.status === "live"));
  } finally {
    await new Promise<void>((resolve, reject) => live.close((err) => (err ? reject(err) : resolve())));
  }
});
