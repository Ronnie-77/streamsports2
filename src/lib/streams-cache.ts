import "server-only";
import type { StreamsResponse } from "@/lib/types";

/**
 * Shared in-memory cache for the public /api/streams response.
 *
 * Kept in a separate module so the admin API-source handlers can
 * invalidate it when the active source is switched/added/removed —
 * otherwise the site would keep showing stale data from the old
 * upstream for up to 60s after a switch.
 */

interface CacheEntry {
  at: number;
  data: StreamsResponse;
}

let cache: CacheEntry | null = null;
let lastFetchAt = 0;

export const CACHE_TTL_MS = 60_000;
export const THROTTLE_MS = 15_000;

export function getCache(): CacheEntry | null {
  return cache;
}

export function setCache(data: StreamsResponse): void {
  cache = { at: Date.now(), data };
  lastFetchAt = Date.now();
}

export function getLastFetchAt(): number {
  return lastFetchAt;
}

export function markFetched(): void {
  lastFetchAt = Date.now();
}

/** Drop the cache so the next /api/streams request fetches fresh data. */
export function invalidateCache(): void {
  cache = null;
  lastFetchAt = 0;
}
