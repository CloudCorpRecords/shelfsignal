import type { DayKey, Store } from "./types.js";

const DAYS: DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Pure open-now check against structured hours.
 * day/minutes are in the store's local time. Ranges crossing midnight
 * (close <= open) spill into the next day's early hours.
 * Returns null when the store has no structured hours: unknown, never a guess.
 */
export function isOpenAt(store: Store, day: DayKey, minutes: number): boolean | null {
  const structured = store.hoursStructured;
  if (!structured) return null;

  const today = structured[day] ?? [];
  for (const [open, close] of today) {
    const o = toMinutes(open);
    const c = toMinutes(close);
    if (c > o ? minutes >= o && minutes < c : minutes >= o) return true;
  }
  const prevDay = DAYS[(DAYS.indexOf(day) + 6) % 7];
  for (const [open, close] of structured[prevDay] ?? []) {
    const o = toMinutes(open);
    const c = toMinutes(close);
    if (c <= o && minutes < c) return true;
  }
  return false;
}

/** Open-now using the real clock, evaluated in America/Los_Angeles (the pilot city timezone for v0.2). */
export function openNow(store: Store, now = new Date(), timeZone = "America/Los_Angeles"): boolean | null {
  if (!store.hoursStructured) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const dayMap: Record<string, DayKey> = { Sun: "sun", Mon: "mon", Tue: "tue", Wed: "wed", Thu: "thu", Fri: "fri", Sat: "sat" };
  const day = dayMap[get("weekday")];
  if (!day) return null;
  const minutes = (Number(get("hour")) % 24) * 60 + Number(get("minute"));
  return isOpenAt(store, day, minutes);
}
