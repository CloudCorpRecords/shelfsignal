import type { Registry, StockStatus, Store, StockVerdict } from "./types.js";
import { stockLikelihood } from "./likelihood.js";

export interface UpdateResult {
  store: Store;
  itemName: string;
  verdict: StockVerdict;
}

/**
 * The merchant stock ping: the one-command update the management system
 * promises. Sets an item's status, stamps lastConfirmed to today, bumps the
 * store's updatedAt, and returns the fresh verdict so the merchant sees
 * exactly what agents will see. Mutates the passed registry; the CLI layer
 * persists it. Unknown store or item is an error, never a silent no-op.
 */
export function updateStock(
  reg: Registry,
  storeId: string,
  itemName: string,
  status: StockStatus,
  opts: { price?: number; now?: Date } = {},
): UpdateResult {
  const now = opts.now ?? new Date();
  const store = reg.stores.find((s) => s.id === storeId);
  if (!store) throw new Error(`No store with id ${storeId}`);
  const item = store.items.find((i) => i.name.toLowerCase() === itemName.toLowerCase())
    ?? store.items.find((i) => i.name.toLowerCase().includes(itemName.toLowerCase()));
  if (!item) throw new Error(`${store.name} does not list '${itemName}'`);
  item.stock = status;
  item.lastConfirmed = now.toISOString().slice(0, 10);
  if (typeof opts.price === "number") item.price = opts.price;
  store.updatedAt = item.lastConfirmed;
  return { store, itemName: item.name, verdict: stockLikelihood(store, item, now) };
}
