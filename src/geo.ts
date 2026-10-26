import type { Store } from "./types.js";

/** Great-circle distance in kilometers between two lat/lng points. */
export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export interface NearbyHit {
  store: Store;
  distanceKm: number;
}

/** Stores with coordinates within radiusKm of a point, nearest first. Stores without coordinates are excluded, never guessed. */
export function nearby(stores: Store[], lat: number, lng: number, radiusKm = 5): NearbyHit[] {
  return stores
    .filter((s) => typeof s.lat === "number" && typeof s.lng === "number")
    .map((store) => ({ store, distanceKm: Math.round(haversineKm(lat, lng, store.lat!, store.lng!) * 100) / 100 }))
    .filter((h) => h.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}
