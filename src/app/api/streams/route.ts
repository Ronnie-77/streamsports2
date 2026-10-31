import { NextResponse } from "next/server";
import type { StreamsResponse, StreamCategory, Stream } from "@/lib/types";
import {
  resolveEmbedUrl,
  toProxyEmbedUrl,
  isDirectStreamUrl,
} from "@/lib/types";
import {
  getActiveApiSource,
  listEnabledChannels,
  listEnabledCurated,
  curatedToStreams,
  getContentMode,
  seedDefaults,
} from "@/lib/admin";
import { normalizeUpstream } from "@/lib/api-adapters";
import {
  getCache,
  setCache,
  getLastFetchAt,
  markFetched,
  invalidateCache,
  CACHE_TTL_MS,
  THROTTLE_MS,
} from "@/lib/streams-cache";

// Re-export so the admin module can clear the cache on API-source change.
export { invalidateCache };

// Force dynamic rendering but keep the route cacheable for a short window.
export const dynamic = "force-dynamic";
export const revalidate = 0;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const FALLBACK_URL = "https://ondemand.st/papi/api/streams";
const FALLBACK_HEADERS: Record<string, string> = {
  Referer: "https://ondemand.st/api-docs",
  Origin: "https://ondemand.st",
};

function normalize(data: StreamsResponse): StreamsResponse {
  const streams = (data.streams || []).map((cat) => ({
    ...cat,
    streams: (cat.streams || []).map((s: Stream) => ({
      ...s,
      iframe: resolveEmbedUrl(s.iframe),
      embed: resolveEmbedUrl(s.embed),
      playerUrl: toProxyEmbedUrl(resolveEmbedUrl(s.embed || s.iframe)),
      sources: (s.sources || []).map((src) => ({
        ...src,
        embed: resolveEmbedUrl(src.embed),
        playerUrl: toProxyEmbedUrl(resolveEmbedUrl(src.embed)),
      })),
    })),
  }));
  return { ...data, streams };
}

/** Merge manually-added channels into the streams response. */
function mergeManualChannels(
  data: StreamsResponse,
  channels: Record<string, unknown>[]
): StreamsResponse {
  if (channels.length === 0) return data;
  const catMap = new Map<string, StreamCategory>();
  for (const c of data.streams) catMap.set(c.category, c);

  let nextId = Math.max(0, ...data.streams.map((c) => c.id)) + 1000;
  const now = Math.floor(Date.now() / 1000);

  for (const ch of channels) {
    const catKey = (ch.category as string) || "other";
    let cat = catMap.get(catKey);
    if (!cat) {
      cat = { category: catKey, id: nextId++, streams: [] };
      catMap.set(catKey, cat);
      data.streams.push(cat);
    }
    const streamUrl = ch.streamUrl as string;
    const direct = isDirectStreamUrl(streamUrl);
    const stream: Stream = {
      id: ch.id as string,
      name: ch.name as string,
      poster: (ch.logo as string) ?? undefined,
      starts_at: now,
      ends_at: now + 7200,
      category_name: catKey,
      status: "live",
      league: "Manual channel",
      viewers: 0,
      playMode: direct ? "direct" : "redirect",
      directUrl: direct ? streamUrl : undefined,
      sources: [
        {
          source: "manual",
          id: "m1",
          name: ch.name as string,
          embed: streamUrl,
          playMode: direct ? "direct" : "redirect",
          directUrl: direct ? streamUrl : undefined,
        },
      ],
      iframe: streamUrl,
      embed: streamUrl,
    };
    cat.streams.push(stream);
  }
  return data;
}

async function fetchFromActiveSource(): Promise<StreamsResponse | null> {
  await seedDefaults();
  const mode = await getContentMode();
  const channels = await listEnabledChannels();

  // ---- Manual mode: only curated matches + all channels (no full API) ----
  if (mode === "manual") {
    const curatedRows = await listEnabledCurated();
    const merged: StreamsResponse = {
      success: true,
      timestamp: Math.floor(Date.now() / 1000),
      READ_ME: "Manual mode — showing curated matches + channels.",
      performance: 0,
      streams: [
        ...curatedToStreams(curatedRows),
        ...curatedToChannels(channels),
      ],
    };
    return normalize(merged);
  }

  // ---- Auto mode: active API's full content + all channels ---------------
  const src = await getActiveApiSource() as Record<string, unknown> | null;
  const baseUrl = (src?.baseUrl as string) || FALLBACK_URL;
  let headers: Record<string, string> = { ...FALLBACK_HEADERS };
  if (src?.headers) {
    try {
      headers = { ...headers, ...JSON.parse(src.headers as string) };
    } catch {
      /* ignore */
    }
  }

  // The base URL may be a bare api root (e.g. https://ondemand.st/papi/api)
  // or a full endpoint (e.g. https://cinevid.st/api/public/events). Only
  // append /streams if it doesn't already end with a known endpoint path.
  const lower = baseUrl.toLowerCase();
  const url =
    lower.endsWith("/streams") ||
    lower.endsWith("/events") ||
    lower.endsWith("/matches") ||
    lower.endsWith("/channels")
      ? baseUrl
      : baseUrl.replace(/\/$/, "") + "/streams";

  const upstreamOrigin = (() => {
    try {
      return new URL(url).origin;
    } catch {
      return "https://damitv.st";
    }
  })();

  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
      ...headers,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) {
    throw new Error(`Upstream returned ${res.status}`);
  }
  const raw = (await res.json()) as StreamsResponse;
  // Normalise whichever upstream shape (DAMITV / Cinevid / …) into ours.
  const normalized = normalizeUpstream(raw, upstreamOrigin);
  // In auto mode we include all channels (manual + curated-from-API) but
  // NOT curated matches (those are for manual mode only).
  let merged = mergeManualChannels(normalized, channels);
  return normalize(merged);
}

export async function GET() {
  const now = Date.now();
  const cache = getCache();

  if (cache && now - cache.at < CACHE_TTL_MS) {
    return NextResponse.json(
      { ...cache.data, _cached: true, _cacheAge: now - cache.at },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
          "X-Stream-Cache": "HIT",
        },
      }
    );
  }

  if (now - getLastFetchAt() < THROTTLE_MS && cache) {
    return NextResponse.json(
      { ...cache.data, _cached: true, _cacheAge: now - cache.at },
      {
        headers: {
          "Cache-Control": "public, s-maxage=15, stale-while-revalidate=60",
          "X-Stream-Cache": "THROTTLED",
        },
      }
    );
  }

  markFetched();

  try {
    const data = await fetchFromActiveSource();
    if (!data) {
      throw new Error("No data");
    }
    setCache(data);
    return NextResponse.json(
      { ...data, _cached: false },
      {
        headers: {
          "Cache-Control":
            "public, s-maxage=60, stale-while-revalidate=120",
          "X-Stream-Cache": "MISS",
        },
      }
    );
  } catch (err) {
    const stale = getCache();
    if (stale) {
      return NextResponse.json(
        {
          ...stale.data,
          _cached: true,
          _stale: true,
          _cacheAge: now - stale.at,
        },
        { status: 200, headers: { "X-Stream-Cache": "STALE-FALLBACK" } }
      );
    }
    // No cache — fall back to curated + manual channels if any exist,
    // so the site still shows admin-curated content when the upstream is down.
    const [curatedRows, channels] = await Promise.all([
      listEnabledCurated(),
      listEnabledChannels(),
    ]);
    if (curatedRows.length > 0 || channels.length > 0) {
      const fallback: StreamsResponse = {
        success: true,
        timestamp: Math.floor(now / 1000),
        READ_ME: "Upstream unavailable — showing curated + manual content.",
        performance: 0,
        streams: [
          ...curatedToStreams(curatedRows),
          ...curatedToChannels(channels),
        ],
      };
      return NextResponse.json(
        { ...fallback, _fallback: true },
        { status: 200, headers: { "X-Stream-Cache": "CURATED-FALLBACK" } }
      );
    }
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown fetch error",
      },
      { status: 502 }
    );
  }
}

/** Convert manual channels to a streams payload (for the fallback path). */
function curatedToChannels(
  channels: Record<string, unknown>[]
): import("@/lib/types").StreamCategory[] {
  if (channels.length === 0) return [];
  const t = Math.floor(Date.now() / 1000);
  const catMap = new Map<string, import("@/lib/types").StreamCategory>();
  let nextId = 4000;
  for (const ch of channels) {
    const catKey = (ch.category as string) || "other";
    let cat = catMap.get(catKey);
    if (!cat) {
      cat = { category: catKey, id: nextId++, streams: [] };
      catMap.set(catKey, cat);
    }
    const streamUrl = ch.streamUrl as string;
    const direct = isDirectStreamUrl(streamUrl);
    cat.streams.push({
      id: ch.id as string,
      name: ch.name as string,
      poster: (ch.logo as string) ?? undefined,
      starts_at: t,
      ends_at: t + 7200,
      category_name: catKey,
      status: "live",
      league: "Manual channel",
      viewers: 0,
      playMode: direct ? "direct" : "redirect",
      directUrl: direct ? streamUrl : undefined,
      sources: [
        {
          source: "manual",
          id: "m1",
          name: ch.name as string,
          embed: streamUrl,
          playMode: direct ? "direct" : "redirect",
          directUrl: direct ? streamUrl : undefined,
        },
      ],
      embed: streamUrl,
      iframe: streamUrl,
    });
  }
  return Array.from(catMap.values());
}
