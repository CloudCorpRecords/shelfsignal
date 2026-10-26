import type { Store, ValidationReceipt, ValidationCheck, ValidationTier } from "./types.js";
import { daysBetween } from "./likelihood.js";

/**
 * Store validation: the receipt an agent (or a human) can check before
 * trusting a listing. Same philosophy as the fleet's audit tools: a listing
 * is only as good as its evidence, and the evidence is printed, not hidden.
 *
 * Tiers:
 *  VERIFIED   every check passes and inventory was confirmed within 7 days
 *  LISTED     complete profile, freshness between 8 and 30 days
 *  STALE      complete profile but nothing confirmed in over 30 days
 *  INCOMPLETE profile is missing something an agent needs to act on
 */
export function validateStore(store: Store, now = new Date()): ValidationReceipt {
  const checks: ValidationCheck[] = [];
  const add = (name: string, pass: boolean, detail: string) => checks.push({ name, pass, detail });

  add("name", store.name.trim().length >= 2, store.name || "missing");
  add("address", store.address.trim().length >= 5, store.address || "missing");
  add("city", store.city.trim().length >= 2, store.city || "missing");
  add("hours", store.hours.trim().length >= 3, store.hours || "missing");
  add("contact", Boolean(store.phone || store.website), store.phone || store.website || "no phone or website");
  add("categories", store.categories.length >= 1, `${store.categories.length} categories`);
  add("fulfillment", store.fulfillment.length >= 1, store.fulfillment.join(", ") || "none declared");
  add("has_items", store.items.length >= 1, `${store.items.length} items listed`);
  add(
    "items_priced",
    store.items.length > 0 && store.items.every((i) => i.price !== null && i.price > 0),
    store.items.length ? `${store.items.filter((i) => i.price !== null && i.price > 0).length}/${store.items.length} items priced` : "no items",
  );

  const freshest = store.items.reduce((min, i) => Math.min(min, daysBetween(i.lastConfirmed, now)), Number.POSITIVE_INFINITY);
  add("inventory_fresh", Number.isFinite(freshest) && freshest <= 30, Number.isFinite(freshest) ? `freshest item confirmed ${freshest}d ago` : "no confirmation dates");

  const passed = checks.filter((c) => c.pass).length;
  const score = Math.round((passed / checks.length) * 100);
  const complete = checks.slice(0, 9).every((c) => c.pass);

  let tier: ValidationTier;
  if (!complete) tier = "INCOMPLETE";
  else if (freshest <= 7) tier = "VERIFIED";
  else if (freshest <= 30) tier = "LISTED";
  else tier = "STALE";

  return {
    storeId: store.id,
    storeName: store.name,
    tier,
    score,
    checks,
    validatedAt: now.toISOString(),
  };
}
