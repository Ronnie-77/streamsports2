import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/**
 * Same-origin streaming proxy for video streams (.ts / .m3u8 / .mpd / .mp4).
 *
 * Cross-origin stream servers usually don't send CORS headers, so the
 * browser blocks hls.js / mpegts.js / dashjs from fetching them directly.
 * This proxy fetches the data server-side (with a browser UA + forwarded
 * Range header) and streams it back to the client same-origin, bypassing
 * CORS entirely.
 *
 * For .m3u8 playlists it also rewrites internal segment/key URLs to route
 * through this same proxy so hls.js's segment fetches work too.
 *
 * Query: url=<absolute stream URL>
 */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const raw = u.searchParams.get("url");
  if (!raw) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }
  if (!["http:", "https:"].includes(target.protocol)) {
    return NextResponse.json({ error: "Bad protocol" }, { status: 400 });
  }

  // Forward the Range header so seeking works for VOD mp4/ts.
  const reqHeaders: Record<string, string> = {
    "User-Agent": UA,
    Accept: "*/*",
    "Accept-Language": "en-US,en;q=0.9",
  };
  const range = req.headers.get("range");
  if (range) reqHeaders.Range = range;

  let upstream: Response;
  try {
    upstream = await fetch(target.toString(), {
      headers: reqHeaders,
      redirect: "follow",
      signal: AbortSignal.timeout(30000),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "fetch failed" },
      { status: 502 }
    );
  }

  const contentType =
    upstream.headers.get("content-type") || "application/octet-stream";
  const isM3u8 =
    contentType.includes("mpegurl") ||
    contentType.includes("x-mpegurl") ||
    target.pathname.toLowerCase().endsWith(".m3u8") ||
    target.pathname.toLowerCase().endsWith(".m3u");

  // ---- HLS playlist: rewrite internal URLs to route through the proxy ----
  if (isM3u8) {
    const text = await upstream.text();
    const base = target.origin + target.pathname.replace(/\/[^/]*$/, "/");
    const rewritten = rewriteM3u8(text, base, target.toString());
    return new NextResponse(rewritten, {
      status: upstream.status,
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  // ---- Raw stream (.ts / .mp4 / .mpd / segments): pipe bytes through ----
  const headers = new Headers();
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Headers", "Range");
  headers.set("Access-Control-Expose-Headers", "Content-Range, Content-Length");
  // Forward content-type + content-range/length for seeking.
  const ct = upstream.headers.get("content-type");
  if (ct) headers.set("Content-Type", ct);
  const cr = upstream.headers.get("content-range");
  if (cr) headers.set("Content-Range", cr);
  const cl = upstream.headers.get("content-length");
  if (cl) headers.set("Content-Length", cl);
  headers.set("Cache-Control", "no-store");

  // Stream the body straight through without buffering.
  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers,
  });
}

/**
 * Rewrite every URL inside an m3u8 playlist so segment/key/init fetches
 * go through /api/stream?url=... (same-origin, CORS-free).
 *
 * - Absolute http(s) URLs → proxied
 * - Relative URLs → resolved against the playlist base, then proxied
 * - Already-proxied / data: / blob: → left alone
 */
function rewriteM3u8(text: string, base: string, selfUrl: string): string {
  const lines = text.split(/\r?\n/);
  return lines
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        // Rewrite URI="" attributes inside #EXT-X-KEY / #EXT-X-MAP etc.
        if (trimmed.startsWith("#") && /URI="/i.test(trimmed)) {
          return trimmed.replace(/URI="([^"]+)"/gi, (_m, uri: string) => {
            const abs = absify(uri, base);
            return abs ? `URI="${toProxy(abs)}"` : `URI="${uri}"`;
          });
        }
        return line;
      }
      const abs = absify(trimmed, base);
      return abs ? toProxy(abs) : line;
    })
    .join("\n");
}

function absify(url: string, base: string): string | null {
  if (!url) return null;
  if (/^(data:|blob:|javascript:|about:)/i.test(url)) return null;
  if (url.startsWith("/api/stream")) return null;
  try {
    return new URL(url, base).toString();
  } catch {
    return null;
  }
}

function toProxy(absUrl: string): string {
  return `/api/stream?url=${encodeURIComponent(absUrl)}`;
}
