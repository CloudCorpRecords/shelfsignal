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

import { haversineKm, nearby } from "../src/geo.js";
import { isOpenAt, openNow } from "../src/hours.js";
import { updateStock } from "../src/update.js";
import { searchItemsScored } from "../src/registry.js";
import { loadRegistry as loadReg2 } from "../src/registry.js";

test("geo: haversine between Mission and Ferry Building is about 3 km, nearby sorts nearest first", () => {
  const d = haversineKm(37.7599, -122.4148, 37.7955, -122.3937);
  assert.ok(d > 3.5 && d < 5.0, `expected roughly 4.3km, got ${d}`);
  const hits = nearby(loadReg2().stores, 37.7599, -122.4148, 10);
  assert.equal(hits[0].store.id, "sf-mission-taqueria-demo");
  assert.equal(hits[0].distanceKm, 0);
  assert.ok(hits.every((h, i) => i === 0 || h.distanceKm >= hits[i - 1].distanceKm));
  assert.equal(nearby(loadReg2().stores, 37.7599, -122.4148, 0.5).length, 1);
});

test("hours: open-now honors structured hours, closed days, and midnight spill; unknown without structured hours", () => {
  const regH = loadReg2();
  const bakery = regH.stores.find((s) => s.id === "sf-sunset-bakery-demo")!;
  assert.equal(isOpenAt(bakery, "tue", 8 * 60), true);
  assert.equal(isOpenAt(bakery, "tue", 16 * 60), false);
  assert.equal(isOpenAt(bakery, "mon", 10 * 60), false, "closed Mondays");
  const noStructured = { ...bakery, hoursStructured: undefined };
  assert.equal(isOpenAt(noStructured, "tue", 600), null);
  const lateNight = { ...bakery, hoursStructured: { fri: [["18:00", "02:00"]] as [string, string][] } };
  assert.equal(isOpenAt(lateNight, "fri", 23 * 60), true);
  assert.equal(isOpenAt(lateNight, "sat", 1 * 60), true, "Friday range spills past midnight");
  assert.equal(isOpenAt(lateNight, "sat", 3 * 60), false);
  // 2026-10-25 is a Sunday; 19:00 UTC is 12:00 PDT, taqueria is open
  const taqueria = regH.stores.find((s) => s.id === "sf-mission-taqueria-demo")!;
  assert.equal(openNow(taqueria, new Date("2026-10-25T19:00:00Z")), true);
  assert.equal(openNow(taqueria, new Date("2026-10-25T09:00:00Z")), false, "02:00 PDT is closed");
});

test("ping: updateStock flips status, restamps freshness, and the verdict recovers", () => {
  const regU = loadReg2();
  const before = searchItemsScored(regU, "cardamom", undefined, NOW)[0];
  assert.equal(before.verdict.band, "unlikely");
  const result = updateStock(regU, "sf-sunset-bakery-demo", "Cardamom knot", "in_stock", { now: NOW });
  assert.equal(result.itemName, "Cardamom knot");
  assert.equal(result.verdict.band, "likely");
  assert.equal(result.store.items[1].lastConfirmed, "2026-10-25");
  assert.throws(() => updateStock(regU, "nope", "x", "in_stock"), /No store/);
  assert.throws(() => updateStock(regU, "sf-sunset-bakery-demo", "Unicorn meat", "in_stock"), /does not list/);
});

test("scored search: every hit carries a verdict and hits are sorted by score", () => {
  const hits = searchItemsScored(loadReg2(), "oat milk", undefined, NOW);
  assert.equal(hits.length, 1);
  assert.ok(hits[0].verdict.score >= 75);
  const all = searchItemsScored(loadReg2(), "a", undefined, NOW);
  assert.ok(all.length > 3);
  assert.ok(all.every((h, i) => i === 0 || h.verdict.score <= all[i - 1].verdict.score));
});

import { parseIntakeEmail } from "../src/intake.js";
import { processSubmission } from "../src/submit.js";
import { findItem } from "../src/registry.js";

const FILLED = `Subject: [ShelfSignal] Pancho's Taqueria

> STORE NAME: Pancho's Taqueria
TYPE: restaurant
CITY: San Francisco
NEIGHBORHOOD: Excelsior
ADDRESS: 4801 Mission St, San Francisco, CA
PHONE: (415) 555-0142
HOURS: Mon-Sun 10am-10pm
CATEGORIES: tacos, burritos
FULFILLMENT: walk_in, pickup

ITEMS:
Birria tacos | tacos | $14.50 | in | yes
Horchata | drinks | 4.25 | low |
Old special | tacos | not-a-price | in |
Mystery item | tacos | 9.00 | maybe |
`;

test("intake: a filled email template parses into a valid starter submission", () => {
  const parsed = parseIntakeEmail(FILLED);
  assert.equal(parsed.raw.name, "Pancho's Taqueria");
  assert.deepEqual(parsed.raw.categories, ["tacos", "burritos"]);
  // the two bad item lines are reported by name, not silently dropped or crashed on
  assert.equal(parsed.problems.length, 2);
  assert.ok(parsed.problems.some((p) => p.includes("Old special")));
  assert.ok(parsed.problems.some((p) => p.includes("Mystery item")));
  const result = processSubmission({ ...parsed.raw, items: (parsed.raw.items ?? []).filter((i) => i.name !== "Old special" && i.name !== "Mystery item") });
  assert.equal(result.ok, true);
  assert.equal(result.store?.tier, "starter");
  assert.equal(result.store?.items[0].price, 14.5, "the $ sign is tolerated");
  assert.equal(result.store?.items[0].stock, "in_stock");
  assert.equal(result.store?.items[1].stock, "low");
});

test("intake: a blank template fails validation with named problems, never a phantom store", () => {
  const parsed = parseIntakeEmail("STORE NAME:\nCITY:\nITEMS:\n");
  const result = processSubmission(parsed.raw);
  assert.equal(result.ok, false);
  assert.ok(result.problems.length >= 5);
});

test("findItem regression: a blank item query matches nothing, in any store", () => {
  const store = loadReg2().stores[0];
  assert.equal(findItem(store, ""), undefined);
  assert.equal(findItem(store, "   "), undefined);
  assert.equal(findItem(store, "birria")?.name, "Birria tacos");
});
