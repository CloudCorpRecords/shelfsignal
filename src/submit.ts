import type { Store } from "./types.js";
import { validateStore } from "./validate.js";

export interface SubmissionResult {
  ok: boolean;
  store: Store | null;
  problems: string[];
  receipt: ReturnType<typeof validateStore> | null;
}

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);

/**
 * Merchant intake. A store owner fills one JSON form (see
 * examples/submission.example.json and docs/INTAKE.md); submit checks it the
 * same way agents will see it, assigns the registry id, stamps the tier, and
 * returns the validation receipt the merchant gets for their $100 starter.
 * Payment itself happens outside the repo (Stripe link in docs/PRICING.md);
 * nothing here charges a card.
 */
export function processSubmission(input: unknown, now = new Date()): SubmissionResult {
  const problems: string[] = [];
  const raw = (input ?? {}) as Partial<Store>;

  if (!raw.name || String(raw.name).trim().length < 2) problems.push("name is required");
  if (!raw.address || String(raw.address).trim().length < 5) problems.push("address is required");
  if (!raw.city || String(raw.city).trim().length < 2) problems.push("city is required");
  if (!raw.hours) problems.push("hours are required");
  if (!raw.type) problems.push("type is required (restaurant, grocery, bakery, bodega, cafe, pharmacy, butcher, market, retail, other)");
  if (!Array.isArray(raw.items) || raw.items.length === 0) problems.push("at least one item is required");
  if (Array.isArray(raw.items)) {
    raw.items.forEach((item, idx) => {
      if (!item?.name) problems.push(`items[${idx}].name is required`);
      if (item && (item.price === undefined || item.price === null)) problems.push(`items[${idx}].price is required (use the real shelf price)`);
      if (item && !item.lastConfirmed) problems.push(`items[${idx}].lastConfirmed is required (date you last confirmed it, YYYY-MM-DD)`);
    });
  }
  if (problems.length) return { ok: false, store: null, problems, receipt: null };

  const today = now.toISOString().slice(0, 10);
  const store: Store = {
    id: raw.id ?? `${slug(raw.city!)}-${slug(raw.name!)}`,
    name: String(raw.name).trim(),
    type: String(raw.type).trim(),
    city: String(raw.city).trim(),
    neighborhood: raw.neighborhood,
    address: String(raw.address).trim(),
    lat: typeof raw.lat === "number" ? raw.lat : undefined,
    lng: typeof raw.lng === "number" ? raw.lng : undefined,
    phone: raw.phone,
    website: raw.website,
    hours: String(raw.hours).trim(),
    hoursStructured: raw.hoursStructured,
    categories: Array.isArray(raw.categories) && raw.categories.length ? raw.categories.map(String) : [String(raw.type)],
    fulfillment: Array.isArray(raw.fulfillment) && raw.fulfillment.length ? raw.fulfillment : ["walk_in"],
    items: (raw.items ?? []).map((i) => ({
      name: String(i.name),
      category: String(i.category ?? raw.type),
      price: i.price ?? null,
      unit: i.unit,
      stock: i.stock ?? "unknown",
      lastConfirmed: String(i.lastConfirmed ?? today),
      staple: Boolean(i.staple),
      notes: i.notes,
    })),
    updatedAt: today,
    tier: "starter",
    // A fresh submission is validated and ready for review, never live:
    // approval and payment come first, and only the write path marks it live.
    status: "ready",
    demo: false,
  };

  return { ok: true, store, problems: [], receipt: validateStore(store, now) };
}
