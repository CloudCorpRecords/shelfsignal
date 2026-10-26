/**
 * Email intake: the store submission channel for merchants who will never
 * touch a CLI. A merchant fills a plain-text template in an email; the
 * operator saves the body; this parser turns it into the exact submission
 * shape the validator already trusts. Nothing parses "approximately": a
 * filled line either lands in the submission or is reported back by name.
 */

export const INTAKE_TEMPLATE = `Subject: [ShelfSignal] Your Store Name

STORE NAME:
TYPE: restaurant, bakery, grocery, cafe, market, butcher, retail, or other
CITY:
NEIGHBORHOOD:
ADDRESS:
PHONE:
WEBSITE:
HOURS: e.g. Mon-Sun 8am-9pm
CATEGORIES: comma separated, e.g. tacos, burritos, aguas frescas
FULFILLMENT: walk_in, pickup, delivery, shipping (comma separated)

ITEMS:
One per line: Name | category | price | stock (in, low, out, or leave blank) | staple (yes or blank)
Example: Birria tacos | tacos | 14.50 | in |
`;

import type { StockStatus } from "./types.js";

const FIELD_KEYS: Record<string, string> = {
  "STORE NAME": "name",
  "NAME": "name",
  "TYPE": "type",
  "CITY": "city",
  "NEIGHBORHOOD": "neighborhood",
  "ADDRESS": "address",
  "PHONE": "phone",
  "WEBSITE": "website",
  "HOURS": "hours",
  "CATEGORIES": "categories",
  "FULFILLMENT": "fulfillment",
};

const STOCK_WORDS: Record<string, StockStatus> = {
  "in": "in_stock",
  "in stock": "in_stock",
  "in_stock": "in_stock",
  "yes": "in_stock",
  "low": "low",
  "running low": "low",
  "out": "out",
  "sold out": "out",
  "out of stock": "out",
  "no": "out",
  "": "unknown",
};

function cleanLine(raw: string): string {
  // Tolerate quoted replies ("> STORE NAME: ...") and trailing whitespace.
  return raw.replace(/^\s*>+\s?/, "").replace(/\s+$/, "");
}

export interface IntakeParse {
  raw: Record<string, unknown>;
  problems: string[];
  unparsed: string[];
}

export function parseIntakeEmail(body: string, now = new Date()): IntakeParse {
  const raw: Record<string, unknown> = {};
  const problems: string[] = [];
  const unparsed: string[] = [];
  const items: Record<string, unknown>[] = [];

  let inItems = false;
  for (const originalLine of body.split(/\r?\n/)) {
    const line = cleanLine(originalLine);
    if (!line.trim()) continue;
    if (/^subject:/i.test(line)) continue;

    if (/^items?:\s*$/i.test(line.trim())) { inItems = true; continue; }
    if (/^one per line/i.test(line.trim()) || /^example:/i.test(line.trim())) continue;

    if (inItems) {
      if (!line.includes("|")) { unparsed.push(originalLine); continue; }
      const [name, category, priceText, stockText, stapleText] = line.split("|").map((s) => s.trim());
      if (!name) { problems.push(`Item line with no name: '${line}'`); continue; }
      const price = priceText ? Number(priceText.replace(/^\$/, "")) : NaN;
      const stockKey = (stockText ?? "").toLowerCase();
      const item: Record<string, unknown> = { name, category: category || "general" };
      if (priceText) {
        if (Number.isFinite(price)) item.price = price;
        else problems.push(`Item '${name}': price '${priceText}' is not a number`);
      }
      if (stockKey in STOCK_WORDS) item.stock = STOCK_WORDS[stockKey];
      else problems.push(`Item '${name}': stock '${stockText}' not understood (use in, low, or out)`);
      if ((stapleText ?? "").toLowerCase() === "yes") item.staple = true;
      // The email itself is today's attestation: the merchant sent these statuses now.
      item.lastConfirmed = now.toISOString().slice(0, 10);
      items.push(item);
      continue;
    }

    const match = line.match(/^([A-Z ]+):\s*(.*)$/);
    const key = match ? FIELD_KEYS[match[1].trim().toUpperCase()] : undefined;
    if (match && key) {
      const value = match[2].trim();
      if (!value) continue; // blank template field: left for the validator to report
      if (key === "categories" || key === "fulfillment") {
        raw[key] = value.split(",").map((s) => s.trim()).filter(Boolean);
      } else {
        raw[key] = value;
      }
    } else if (line.includes(":")) {
      unparsed.push(originalLine);
    }
  }

  if (items.length > 0) raw.items = items;
  return { raw, problems, unparsed };
}
