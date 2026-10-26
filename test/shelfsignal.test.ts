import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { loadRegistry, searchStores, searchItems, listCities } from "../src/registry.js";
import { stockLikelihood } from "../src/likelihood.js";
import { validateStore } from "../src/validate.js";
import { processSubmission } from "../src/submit.js";

const NOW = new Date("2026-10-25T12:00:00Z");
const reg = loadRegistry();

test("registry loads with demo stores, all flagged demo", () => {
  assert.ok(reg.stores.length >= 4);
  assert.ok(reg.stores.every((s) => s.demo === true), "bundled sample data must never pose as real merchants");
  assert.deepEqual(listCities(reg), ["San Francisco"]);
});

test("search finds birria tacos and oat milk", () => {
  assert.equal(searchItems(reg, "birria").length, 1);
  assert.equal(searchItems(reg, "oat milk")[0].store.id, "sf-richmond-bodega-demo");
  assert.equal(searchStores(reg, { category: "bakery" })[0].type, "bakery");
  assert.equal(searchStores(reg, { city: "Oakland" }).length, 0);
});

test("fresh in-stock staple scores likely with reasons", () => {
  const store = reg.stores.find((s) => s.id === "sf-sunset-bakery-demo")!;
  const verdict = stockLikelihood(store, store.items[0], NOW);
  assert.equal(verdict.band, "likely");
  assert.ok(verdict.score >= 75);
  assert.ok(verdict.reasons.length >= 2);
  assert.equal(verdict.demo, true);
});

test("out-of-stock scores unlikely, stale unknown decays to uncertain or worse", () => {
  const bakery = reg.stores.find((s) => s.id === "sf-sunset-bakery-demo")!;
  assert.equal(stockLikelihood(bakery, bakery.items[1], NOW).band, "unlikely");
  const bodega = reg.stores.find((s) => s.id === "sf-richmond-bodega-demo")!;
  const tinned = stockLikelihood(bodega, bodega.items[2], NOW);
  assert.ok(tinned.score < 35, `stale unknown should decay, got ${tinned.score}`);
});

test("demo stores validate VERIFIED or LISTED, incomplete store is flagged", () => {
  for (const store of reg.stores) {
    const receipt = validateStore(store, NOW);
    assert.ok(["VERIFIED", "LISTED"].includes(receipt.tier), `${store.id} got ${receipt.tier}`);
    assert.equal(receipt.checks.length, 10);
  }
  const broken = { ...reg.stores[0], address: "", items: [] };
  assert.equal(validateStore(broken, NOW).tier, "INCOMPLETE");
});

test("submission: valid intake becomes a starter listing with a receipt", () => {
  const result = processSubmission({
    name: "Test Taqueria",
    type: "restaurant",
    city: "San Francisco",
    address: "1 Test Street, San Francisco, CA",
    hours: "Mon-Sun 10am-9pm",
    phone: "(415) 555-0111",
    categories: ["tacos"],
    fulfillment: ["pickup"],
    items: [{ name: "Test taco", category: "tacos", price: 5, stock: "in_stock", lastConfirmed: "2026-10-25" }],
  }, NOW);
  assert.equal(result.ok, true);
  assert.equal(result.store?.tier, "starter");
  assert.equal(result.store?.id, "san-francisco-test-taqueria");
  assert.equal(result.store?.demo, false);
  assert.equal(result.receipt?.tier, "VERIFIED");
});

test("submission: missing price and items are rejected with named problems", () => {
  const result = processSubmission({ name: "No Items Cafe", type: "cafe", city: "SF", address: "1 Nowhere St", hours: "9-5", items: [] }, NOW);
  assert.equal(result.ok, false);
  assert.ok(result.problems.some((p) => p.includes("at least one item")));
  const noPrice = processSubmission({
    name: "Priceless Deli", type: "restaurant", city: "SF", address: "2 Nowhere St", hours: "9-5",
    items: [{ name: "Sandwich", lastConfirmed: "2026-10-25" }],
  }, NOW);
  assert.equal(noPrice.ok, false);
  assert.ok(noPrice.problems.some((p) => p.includes("price")));
});

test("CLI stock command parses store id and multi-word item (regression: positional filter once dropped the first arg)", () => {
  const out = execFileSync("npx", ["tsx", "src/cli.ts", "stock", "sf-mission-taqueria-demo", "Birria tacos"], { encoding: "utf8" });
  const verdict = JSON.parse(out);
  assert.equal(verdict.storeId, "sf-mission-taqueria-demo");
  assert.equal(verdict.item, "Birria tacos");
});
