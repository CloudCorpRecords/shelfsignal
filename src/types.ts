export type StockStatus = "in_stock" | "low" | "out" | "unknown";

export type Fulfillment = "pickup" | "walk_in" | "own_delivery" | "curbside";

export interface StoreItem {
  name: string;
  category: string;
  price: number | null;
  unit?: string;
  stock: StockStatus;
  /** ISO date the merchant last confirmed this item, e.g. 2026-10-25 */
  lastConfirmed: string;
  staple?: boolean;
  notes?: string;
}

export type DayKey = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";

/** Structured hours: per day, a list of [open, close] "HH:MM" 24h ranges. A range may cross midnight (close < open). */
export type StructuredHours = Partial<Record<DayKey, [string, string][]>>;

export interface Store {
  id: string;
  name: string;
  /** restaurant, grocery, bakery, bodega, cafe, pharmacy, butcher, market, retail, other */
  type: string;
  city: string;
  neighborhood?: string;
  address: string;
  lat?: number;
  lng?: number;
  phone?: string;
  website?: string;
  /** free text, e.g. "Mon-Sun 8am-9pm" */
  hours: string;
  /** optional machine-readable hours; powers the open-now signal */
  hoursStructured?: StructuredHours;
  categories: string[];
  fulfillment: Fulfillment[];
  items: StoreItem[];
  /** ISO date the listing itself was last updated by the merchant */
  updatedAt: string;
  /** starter = $100 listing tier; growth / pro reserved for later tiers */
  tier: "starter" | "growth" | "pro";
  /** true only for bundled sample data, never for a real merchant */
  demo?: boolean;
}

export interface Registry {
  version: number;
  stores: Store[];
}

export type LikelihoodBand = "likely" | "probable" | "uncertain" | "unlikely";

export interface StockVerdict {
  storeId: string;
  storeName: string;
  item: string;
  score: number;
  band: LikelihoodBand;
  reasons: string[];
  lastConfirmed: string | null;
  demo: boolean;
}

export type ValidationTier = "VERIFIED" | "LISTED" | "STALE" | "INCOMPLETE";

export interface ValidationCheck {
  name: string;
  pass: boolean;
  detail: string;
}

export interface ValidationReceipt {
  storeId: string;
  storeName: string;
  tier: ValidationTier;
  score: number;
  checks: ValidationCheck[];
  validatedAt: string;
}
