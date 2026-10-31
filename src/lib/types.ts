// Type definitions for the DAMITV OnDemand public API.
// Source: https://ondemand.st/api-docs (verified against live response)

export interface TeamInfo {
  name: string;
  badge?: string;
  color?: string;
}

export interface StreamSource {
  source: string;
  id: string;
  name: string;
  sd?: number;
  hd?: number;
  embed: string;
  /** Same-origin proxy URL for in-page playback. */
  playerUrl?: string;
  /** "direct" = playable inline (manual .m3u8/.mpd/.ts); "redirect" = open externally */
  playMode?: "direct" | "redirect";
  /** Direct stream URL for inline playback (manual channels). */
  directUrl?: string;
}

export interface Stream {
  id: string;
  name: string;
  poster?: string;
  starts_at: number;
  ends_at: number;
  category_name: string;
  status: "live" | "upcoming";
  league?: string;
  teams?: {
    home: TeamInfo;
    away: TeamInfo;
  };
  viewers?: number;
  uri_name?: string;
  always_live?: number;
  tag?: string;
  sources?: StreamSource[];
  iframe?: string;
  embed?: string;
  /** Same-origin proxy URL for in-page playback. */
  playerUrl?: string;
  /** "direct" = playable inline (manual .m3u8/.mpd/.ts); "redirect" = open externally */
  playMode?: "direct" | "redirect";
  /** Direct stream URL for inline playback (manual channels). */
  directUrl?: string;
}

export interface StreamCategory {
  category: string;
  id: number;
  streams: Stream[];
}

export interface StreamsResponse {
  success: boolean;
  timestamp: number;
  READ_ME: string;
  performance: number;
  streams: StreamCategory[];
}

export interface PingResponse {
  success: boolean;
  domains?: string[];
  timestamp?: number;
}

// Base origin used to resolve relative embed URLs returned by the API.
export const EMBED_BASE = "https://damitv.st";

/**
 * Resolve a possibly-relative URL from the API into an absolute embed URL.
 * The API returns paths like "/embed/?id=..." or "/player/jw/?url=...".
 */
export function resolveEmbedUrl(url: string | undefined | null): string {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("//")) return `https:${url}`;
  if (!url.startsWith("/")) url = `/${url}`;
  return `${EMBED_BASE}${url}`;
}

/**
 * Convert an absolute DAMITV embed URL (e.g.
 * "https://damitv.st/player/jw/?url=%2Fc%2F346.m3u8&name=Willow%20Cricket")
 * into a same-origin path-based proxy URL ("/api/embed/player/jw/?url=...")
 * so the player loads through our reverse proxy (preserving its query
 * string + routing all its token/m3u8/segment fetches server-side).
 */
export function toProxyEmbedUrl(url: string | undefined | null): string {
  if (!url) return "";
  let abs: URL;
  try {
    abs = new URL(url, EMBED_BASE + "/");
  } catch {
    return "";
  }
  if (!["damitv.st", "ondemand.st"].includes(abs.hostname)) return url;
  if (abs.pathname.startsWith("/api/embed")) return url;
  return `/api/embed${abs.pathname}${abs.search}${abs.hash}`;
}

/**
 * Detect whether a URL points to a directly-playable video stream that we
 * can render inline (HLS/DASH/MPEG-TS/MP4) rather than an embed page.
 */
export function isDirectStreamUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  const u = url.toLowerCase().split("?")[0].split("#")[0];
  return (
    u.endsWith(".m3u8") ||
    u.includes(".m3u8") ||
    u.endsWith(".mpd") ||
    u.endsWith(".ts") ||
    u.endsWith(".m2ts") ||
    u.endsWith(".mp4") ||
    u.endsWith(".webm") ||
    u.endsWith(".mkv") ||
    // Vidcdn stream API returns a .m3u8 playlist at /api/stream/<id>
    /\/api\/stream\//.test(u)
  );
}
