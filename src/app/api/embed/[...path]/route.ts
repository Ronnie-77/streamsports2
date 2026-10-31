import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const UPSTREAM_ORIGIN = "https://damitv.st";
const REFERER = "https://ondemand.st/api-docs";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const MAX_HOPS = 4;
const FETCH_TIMEOUT_MS = 20000;

/**
 * Path-based same-origin reverse proxy for the DAMITV player.
 *
 * Why this exists
 * ---------------
 * The DAMITV HLS player reads its config (stream url, name, etc.) from
 * `location.search`, fetches a short-lived token from the upstream, then
 * plays a tokenized m3u8 via hls.js + P2P. It cannot be embedded
 * cross-origin (Sec-Fetch-Dest: iframe → 403) and cannot run under a
 * foreign query string (it would misread its config).
 *
 * This proxy mirrors the upstream path + query so the player "sees" the
 * same URL it expects, and injects a fetch/XHR interceptor that rewrites
 * every network request the player makes (token, m3u8, .ts segments)
 * back through this same-origin proxy. That way the entire playback
 * pipeline runs server-side-fetched with a matching Referer and never
 * touches the cross-origin block.
 *
 * Usage
 * -----
 *   /api/embed/<upstream-path>?<upstream-query>
 * e.g. /api/embed/player/hls?v=542&url=%2Fc%2F346.m3u8&name=Willow%20Cricket
 */

export async function GET(req: Request) {
  const url = new URL(req.url);
  // Use the raw pathname so trailing slashes are preserved (the upstream
  // serves /player/jw/ but 301s /player/jw, and Node's fetch fails to
  // follow that particular redirect).
  const upstreamPath = url.pathname.replace(/^\/api\/embed/, "") || "/";
  const query = url.search; // includes leading "?"

  const upstreamUrl = `${UPSTREAM_ORIGIN}${upstreamPath}${query}`;

  return proxyFetch(upstreamUrl, query, 0);
}

async function proxyFetch(
  target: string,
  query: string,
  hop: number
): Promise<Response> {
  if (hop >= MAX_HOPS) {
    return NextResponse.json(
      { error: "Too many redirects" },
      { status: 502 }
    );
  }

  let res: Response | null = null;
  try {
    res = await fetchUpstream(target);
  } catch (err) {
    // Node's fetch sometimes fails to follow the upstream's 301 when a
    // trailing slash is missing (e.g. /player/jw). Retry with a slash
    // appended to the path before giving up.
    const u = new URL(target);
    if (!u.pathname.endsWith("/")) {
      const withSlash = `${u.origin}${u.pathname}/${u.search}`;
      try {
        res = await fetchUpstream(withSlash);
      } catch (err2) {
        return NextResponse.json(
          {
            error:
              err2 instanceof Error ? err2.message : "fetch failed",
          },
          { status: 502 }
        );
      }
    } else {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "fetch failed" },
        { status: 502 }
      );
    }
  }

  if (!res) {
    return NextResponse.json({ error: "no response" }, { status: 502 });
  }

  const contentType = res.headers.get("content-type") || "";
  const isHtml = contentType.includes("text/html");

  // --- Non-HTML assets (m3u8, .ts, json, js, css, images) -------------
  // Pass through raw bytes with the upstream content-type so hls.js /
  // the player receive exactly what they expect.
  if (!isHtml) {
    const buf = Buffer.from(await res.arrayBuffer());
    // For .m3u8 playlists, rewrite absolute upstream URLs inside the
    // text so segment fetches also route through the proxy. Relative
    // segment URLs already resolve against the m3u8's proxy URL.
    let body: Buffer = buf;
    if (
      (target.includes(".m3u8") || contentType.includes("mpegurl")) &&
      contentType.includes("text")
    ) {
      const text = buf.toString("utf-8");
      const rewritten = rewriteM3u8Urls(text);
      body = Buffer.from(rewritten, "utf-8");
    }
    return new NextResponse(body as unknown as BodyInit, {
      status: res.status,
      headers: {
        "Content-Type": contentType || "application/octet-stream",
        "Cache-Control": "public, max-age=30, s-maxage=60",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  // --- HTML page ------------------------------------------------------
  const html = await res.text();

  // Follow in-page JS redirects (location.replace/assign) server-side.
  // The jw page does: location.replace("/player/hls/?v=542" + (q ? "&"+q : ""))
  // where q is the *current* query string — so we append the request's
  // query to the captured literal path.
  const next = detectJsRedirect(html, UPSTREAM_ORIGIN, query);
  if (next) {
    try {
      const nextUrl = new URL(next, UPSTREAM_ORIGIN + "/");
      if (nextUrl.hostname === new URL(UPSTREAM_ORIGIN).hostname) {
        return proxyFetch(nextUrl.toString(), nextUrl.search, hop + 1);
      }
    } catch {
      /* ignore malformed */
    }
  }

  const out = renderProxyHtml(html);
  return new NextResponse(out, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Frame-Options": "SAMEORIGIN",
      "Cache-Control": "public, max-age=30, s-maxage=60",
    },
  });
}

async function fetchUpstream(target: string): Promise<Response> {
  return fetch(target, {
    headers: {
      "User-Agent": UA,
      Referer: REFERER,
      Origin: "https://ondemand.st",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
    cache: "no-store",
    redirect: "follow",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
}

/** Rewrite absolute upstream URLs inside an m3u8 playlist to proxy URLs. */
function rewriteM3u8Urls(text: string): string {
  return text.replace(
    /https?:\/\/(?:damitv\.st|ondemand\.st)(\/[^\s"']+)/g,
    (_m, p: string) => `/api/embed${p}`
  );
}

/**
 * Inject a <base> (so relative static assets load from the upstream),
 * a no-referrer policy, and a fetch/XHR interceptor that routes every
 * network request the player makes back through this proxy.
 */
function renderProxyHtml(html: string): string {
  const interceptor = `<base href="${UPSTREAM_ORIGIN}/">
<meta name="referrer" content="no-referrer">
<script>
(function(){
  var UPSTREAM = ${JSON.stringify(UPSTREAM_ORIGIN)};
  var HOSTS = ["damitv.st","ondemand.st"];
  function toProxy(u){
    try {
      var raw = String(u == null ? "" : u);
      if (!raw || raw.charAt(0) === "#") return raw;
      if (/^(data:|blob:|javascript:|about:)/i.test(raw)) return raw;
      var abs = new URL(raw, UPSTREAM + "/");
      if (HOSTS.indexOf(abs.hostname) === -1) return raw;
      if (abs.pathname.indexOf("/api/embed") === 0) return raw;
      return "/api/embed" + abs.pathname + abs.search + abs.hash;
    } catch(e) { return u; }
  }
  var origFetch = window.fetch ? window.fetch.bind(window) : null;
  if (origFetch) {
    window.fetch = function(input, init){
      try {
        if (typeof input === "string") input = toProxy(input);
        else if (input && input.url) input = new Request(toProxy(input.url), input);
      } catch(e){}
      return origFetch(input, init);
    };
  }
  var OrigOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url){
    var args = Array.prototype.slice.call(arguments);
    try { args[1] = toProxy(url); } catch(e){}
    return OrigOpen.apply(this, args);
  };
  document.addEventListener("click", function(e){
    try {
      var t = e.target;
      var a = t && t.closest ? t.closest("a[href]") : null;
      if (a) {
        var p = toProxy(a.getAttribute("href"));
        if (p && p !== a.getAttribute("href")) a.setAttribute("href", p);
      }
    } catch(_){}
  }, true);
})();
</script>`;

  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/(<head[^>]*>)/i, `$1${interceptor}`);
  }
  if (/<html[^>]*>/i.test(html)) {
    return html.replace(/(<html[^>]*>)/i, `$1<head>${interceptor}</head>`);
  }
  return `${interceptor}${html}`;
}

function detectJsRedirect(
  html: string,
  origin: string,
  query: string
): string | null {
  const patterns: RegExp[] = [
    /location\.replace\(\s*['"]([^'"]+)['"]/i,
    /location\.assign\(\s*['"]([^'"]+)['"]/i,
    /location(?:\.href)?\s*=\s*['"]([^'"]+)['"]/i,
    /window\.location\s*=\s*['"]([^'"]+)['"]/i,
  ];
  const q = (query || "").replace(/^\?/, "");
  for (const re of patterns) {
    const m = html.match(re);
    if (m && m[1]) {
      // The captured literal often omits the dynamic query concatenation
      // (e.g. "/player/hls/?v=542" + (q ? "&"+q : "")). Re-attach the
      // current request's query so the followed URL keeps the player's
      // expected params.
      let dest = m[1];
      if (q) {
        dest += (dest.includes("?") ? "&" : "?") + q;
      }
      try {
        const abs = new URL(dest, origin + "/");
        if (abs.hostname === new URL(origin).hostname) return abs.toString();
      } catch {
        /* ignore */
      }
    }
  }
  return null;
}
