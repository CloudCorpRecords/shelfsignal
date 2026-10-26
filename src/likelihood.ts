import type { Store, StoreItem, StockVerdict, LikelihoodBand } from "./types.js";

export function daysBetween(fromIso: string, now: Date): number {
  const from = new Date(fromIso + (fromIso.length === 10 ? "T12:00:00Z" : ""));
  if (Number.isNaN(from.getTime())) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.floor((now.getTime() - from.getTime()) / 86_400_000));
}

/**
 * Deterministic stock-likelihood engine.
 *
 * An agent should never tell a human "they have it" on a guess. ShelfSignal
 * scores the *evidence* instead: what the merchant last confirmed, how fresh
 * that confirmation is, and whether the item is an everyday staple or a
 * specialty item that sells out. Every verdict ships its reasons so the
 * calling agent can quote them instead of bluffing.
 */
export function stockLikelihood(store: Store, item: StoreItem, now = new Date()): StockVerdict {
  const reasons: string[] = [];
  let score: number;

  switch (item.stock) {
    case "in_stock":
      score = 90;
      reasons.push("Merchant last reported this item in stock");
      break;
    case "low":
      score = 45;
      reasons.push("Merchant last reported this item running low");
      break;
    case "out":
      score = 5;
      reasons.push("Merchant last reported this item out of stock");
      break;
    default:
      score = 35;
      reasons.push("Merchant has not reported a stock status for this item");
  }

  const age = daysBetween(item.lastConfirmed, now);
  if (!Number.isFinite(age)) {
    score -= 25;
    reasons.push("No confirmation date on record, freshness unknown");
  } else if (age === 0) {
    reasons.push("Confirmed today");
  } else if (age <= 2) {
    score -= 5;
    reasons.push(`Confirmed ${age} day${age === 1 ? "" : "s"} ago`);
  } else if (age <= 7) {
    score -= 15;
    reasons.push(`Confirmed ${age} days ago, getting stale`);
  } else if (age <= 30) {
    score -= 30;
    reasons.push(`Confirmed ${age} days ago, stale signal`);
  } else {
    score -= 45;
    reasons.push(`Last confirmed ${age} days ago, treat as unknown`);
  }

  if (item.staple) {
    score += 5;
    reasons.push("Everyday staple item, restocked routinely");
  }

  if (store.tier === "starter" || store.tier === "growth" || store.tier === "pro") {
    reasons.push(`Listing tier: ${store.tier}`);
  }
  if (store.demo) reasons.push("DEMO listing, sample data only, not a real merchant claim");

  score = Math.max(0, Math.min(100, Math.round(score)));
  const band: LikelihoodBand = score >= 75 ? "likely" : score >= 50 ? "probable" : score >= 25 ? "uncertain" : "unlikely";

  return {
    storeId: store.id,
    storeName: store.name,
    item: item.name,
    score,
    band,
    reasons,
    lastConfirmed: item.lastConfirmed ?? null,
    demo: Boolean(store.demo),
  };
}
