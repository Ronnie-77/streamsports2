import "server-only";
import type { ChannelInput } from "@/lib/admin";

export interface ParsedChannel {
  name: string;
  streamUrl: string;
  logo?: string;
  category?: string;
  group?: string;
}

/**
 * Parse an M3U / M3U8 playlist (extended format with #EXTINF lines) into
 * a list of channels.
 *
 * Supports the common `tvg-` attributes used by IPTV playlists:
 *   #EXTINF:-1 tvg-id="..." tvg-name="..." tvg-logo="..." group-title="...",Channel Name
 *   http://example/stream.m3u8
 */
export function parseM3u(content: string): ParsedChannel[] {
  const lines = content.split(/\r?\n/);
  const out: ParsedChannel[] = [];
  let cur: Partial<ParsedChannel> = {};

  for (let raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#EXTINF")) {
      // attributes
      const attrs: Record<string, string> = {};
      const attrMatch = line.match(/([a-zA-Z0-9_-]+)="([^"]*)"/g);
      if (attrMatch) {
        for (const a of attrMatch) {
          const m = a.match(/([a-zA-Z0-9_-]+)="([^"]*)"/);
          if (m) attrs[m[1].toLowerCase()] = m[2];
        }
      }
      // trailing name after the last comma
      const commaIdx = line.lastIndexOf(",");
      const name =
        commaIdx >= 0 ? line.slice(commaIdx + 1).trim() : attrs["tvg-name"] || "Channel";
      cur = {
        name: name || "Channel",
        logo: attrs["tvg-logo"] || undefined,
        category: attrs["group-title"] || undefined,
        group: attrs["group-title"] || undefined,
      };
    } else if (line.startsWith("#EXTGRP:")) {
      cur.category = line.slice(8).trim() || cur.category;
    } else if (line.startsWith("#")) {
      // ignore other directives
      continue;
    } else {
      // URL line
      if (cur.name) {
        out.push({
          name: cur.name,
          streamUrl: line,
          logo: cur.logo,
          category: cur.category || "other",
          group: cur.group,
        });
      }
      cur = {};
    }
  }
  return out;
}

/**
 * Parse a JSON channel list. Accepts either:
 *   [ { "name": "...", "url": "...", "logo": "...", "category": "..." }, ... ]
 * or an object with a `channels` / `items` / `streams` array.
 */
export function parseJsonChannels(content: string): ParsedChannel[] {
  let data: unknown;
  try {
    data = JSON.parse(content);
  } catch {
    return [];
  }
  let arr: unknown[] = [];
  if (Array.isArray(data)) {
    arr = data;
  } else if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    arr =
      (obj.channels as unknown[]) ||
      (obj.items as unknown[]) ||
      (obj.streams as unknown[]) ||
      (obj.data as unknown[]) ||
      [];
    if (!Array.isArray(arr)) arr = [];
  }
  const out: ParsedChannel[] = [];
  for (const item of arr) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const name =
      String(o.name || o.title || o.tvgName || o.channel || "Channel").trim();
    const url = String(
      o.url || o.streamUrl || o.stream || o.src || o.link || ""
    ).trim();
    if (!name || !url) continue;
    out.push({
      name,
      streamUrl: url,
      logo: o.logo || o.tvgLogo || o.icon ? String(o.logo || o.tvgLogo || o.icon) : undefined,
      category: o.category || o.group || o.groupTitle
        ? String(o.category || o.group || o.groupTitle)
        : "other",
    });
  }
  return out;
}

export function parsedToChannelInput(
  parsed: ParsedChannel[],
  sourceType: "json" | "m3u-file" | "m3u-link"
): ChannelInput[] {
  return parsed.map((p) => ({
    name: p.name,
    streamUrl: p.streamUrl,
    logo: p.logo ?? null,
    category: (p.category || "other").toLowerCase().replace(/\s+/g, "-"),
    sourceType,
    enabled: true,
  }));
}

/** Fetch an m3u playlist from a URL and parse it. */
export async function fetchAndParseM3u(url: string): Promise<ParsedChannel[]> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
      Accept: "*/*",
    },
    signal: AbortSignal.timeout(15000),
    redirect: "follow",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch m3u (HTTP ${res.status})`);
  }
  const text = await res.text();
  return parseM3u(text);
}
