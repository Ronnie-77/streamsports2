import "server-only";
import type { StreamsResponse, StreamCategory, Stream } from "@/lib/types";

/**
 * API format adapters.
 *
 * Different upstream APIs return different shapes. These adapters normalise
 * them into our internal StreamsResponse so the rest of the app (public
 * site, channels, curation) works uniformly.
 */

interface CinevidEvent {
  id?: string | number;
  slug?: string;
  title?: string;
  sport?: string;
  league?: string;
  date?: string;
  time?: string;
  status?: string;
  score?: string | null;
  round?: string | null;
  venue?: string | null;
  homeTeamImage?: string | null;
  awayTeamImage?: string | null;
  thumbnail?: string | null;
  playerUrl?: string | null;
}

interface CinevidResponse {
  count?: number;
  events?: CinevidEvent[];
}

interface VidcdnChannel {
  id: string;
  name: string;
  country?: string;
  language?: string;
  category?: string;
  logo?: string;
  status?: string;
  slug?: string;
  key?: string;
}

interface VidcdnResponse {
  total_channels?: number;
  channels?: VidcdnChannel[];
}

function absify(url: string | null | undefined, origin: string): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url, origin + "/").toString();
  } catch {
    return undefined;
  }
}

function parseTeams(title: string): { home: string; away: string } {
  // "Team A vs Team B" → { home: "Team A", away: "Team B" }
  const m = title.match(/^(.*?)\s+vs\.?\s+(.*)$/i);
  if (m) return { home: m[1].trim(), away: m[2].trim() };
  return { home: title, away: "" };
}

/** Normalise a Cinevid-style { events: [...] } response. */
export function normalizeCinevid(
  data: CinevidResponse,
  origin: string
): StreamsResponse {
  const events = data.events || [];
  const catMap = new Map<string, StreamCategory>();
  let nextId = 1;

  for (const e of events) {
    const id = String(e.id ?? e.slug ?? Math.random());
    const cat = (e.sport || "other")
      .toString()
      .toLowerCase()
      .replace(/\s+/g, "-");
    let cat_ = catMap.get(cat);
    if (!cat_) {
      cat_ = { category: cat, id: nextId++, streams: [] };
      catMap.set(cat, cat_);
    }
    const title = e.title || e.slug || id;
    const isLive = (e.status || "").toLowerCase() === "live";
    const playerUrl = absify(e.playerUrl, origin) || "";
    const thumbnail = absify(e.thumbnail, origin);
    const homeImg = absify(e.homeTeamImage, origin);
    const awayImg = absify(e.awayTeamImage, origin);
    const teams = parseTeams(title);

    // date + time are UTC per the docs.
    let startsAt = 0;
    if (e.date && e.time) {
      const t = Date.parse(`${e.date}T${e.time}:00Z`);
      if (!isNaN(t)) startsAt = Math.floor(t / 1000);
    }

    const stream: Stream = {
      id,
      name: title,
      poster: thumbnail,
      starts_at: startsAt,
      ends_at: startsAt ? startsAt + 7200 : 0,
      category_name: cat,
      status: isLive ? "live" : "upcoming",
      league: e.league || undefined,
      teams: {
        home: { name: teams.home, badge: homeImg },
        away: { name: teams.away, badge: awayImg },
      },
      viewers: 0,
      // Cinevid's player is CORS-enabled and designed for iframe embedding,
      // but we route it as "redirect" (open in player) by default. If the
      // playerUrl is a direct video format it'd be detected as "direct".
      playMode: "redirect",
      embed: playerUrl,
      iframe: playerUrl,
      sources: [
        {
          source: "cinevid",
          id: "c1",
          name: "Cinevid Player",
          embed: playerUrl,
        },
      ],
    };
    cat_.streams.push(stream);
  }

  return {
    success: true,
    timestamp: Math.floor(Date.now() / 1000),
    READ_ME: "Cinevid public events API.",
    performance: 0,
    streams: Array.from(catMap.values()),
  };
}

/**
 * Detect + normalise an upstream response into our StreamsResponse.
 * Supports:
 *  - DAMITV-style: { success, streams: [{ category, streams: [...] }] }
 *  - Cinevid-style: { count, events: [...] }
 */
export function normalizeUpstream(
  data: unknown,
  origin: string
): StreamsResponse {
  if (!data || typeof data !== "object") {
    return { success: false, timestamp: 0, READ_ME: "", performance: 0, streams: [] };
  }
  const d = data as Record<string, unknown>;
  // Vidcdn IPTV channels: { total_channels, channels: [...] }
  if (Array.isArray(d.channels) && !Array.isArray(d.streams)) {
    return normalizeVidcdnChannels(d as unknown as VidcdnResponse, origin);
  }
  // Cinevid: has an `events` array.
  if (Array.isArray(d.events)) {
    return normalizeCinevid(d as unknown as CinevidResponse, origin);
  }
  // DAMITV / default: has a `streams` array.
  if (Array.isArray(d.streams)) {
    return d as unknown as StreamsResponse;
  }
  // Unknown shape — return empty.
  return {
    success: Boolean(d.success),
    timestamp: Number(d.timestamp) || 0,
    READ_ME: String(d.READ_ME || ""),
    performance: Number(d.performance) || 0,
    streams: [],
  };
}

/** Normalise a Vidcdn IPTV channels response into StreamsResponse. */
export function normalizeVidcdnChannels(
  data: VidcdnResponse,
  origin: string
): StreamsResponse {
  const channels = data.channels || [];
  const catMap = new Map<string, StreamCategory>();
  let nextId = 1;
  const now = Math.floor(Date.now() / 1000);

  for (const ch of channels) {
    const cat = (ch.category || "other").toString().toLowerCase().replace(/\s+/g, "-");
    let cat_ = catMap.get(cat);
    if (!cat_) {
      cat_ = { category: cat, id: nextId++, streams: [] };
      catMap.set(cat, cat_);
    }
    const logo = ch.logo ? absify(ch.logo, origin) : undefined;
    // Vidcdn: /api/stream/<id> returns JSON {streamUrl: "/stream/<hash>"}.
    // The actual HLS m3u8 is at origin + streamUrl. We point directUrl to
    // the /api/stream/<id> endpoint; our /api/stream proxy will follow the
    // JSON redirect and fetch the real m3u8.
    // However, hls.js can't parse JSON as m3u8. So we use the embed URL
    // which is an iframe player page — this works as a redirect target
    // (opens in new tab). For inline play, the admin should use the
    // Cinevid events API source (which has direct playerUrls).
    const embedUrl = `${origin.replace("vidcdn.vip", "cinevid.st")}/embed/live/${ch.id}/${encodeURIComponent(ch.name)}`;
    cat_.streams.push({
      id: ch.id || ch.slug || Math.random().toString(),
      name: ch.name,
      poster: logo,
      starts_at: now,
      ends_at: now + 86400,
      category_name: cat,
      status: "live",
      league: ch.country || undefined,
      viewers: 0,
      playMode: "redirect",
      embed: embedUrl,
      iframe: embedUrl,
      sources: [
        {
          source: "cinevid-iptv",
          id: "c1",
          name: ch.name,
          embed: embedUrl,
        },
      ],
    });
  }

  return {
    success: true,
    timestamp: now,
    READ_ME: `Vidcdn IPTV channels (${data.total_channels || channels.length} total).`,
    performance: 0,
    streams: Array.from(catMap.values()),
  };
}
