import "server-only";
import { db, d1Query, d1Exec, isCloudflareWorkers } from "@/lib/db";
import type {
  ApiSource,
  Channel,
  AdConfig,
  CuratedMatch,
  SiteConfig,
} from "@prisma/client";
import { invalidateCache } from "@/lib/streams-cache";
import type { StreamsResponse, Stream, StreamCategory } from "@/lib/types";
import {
  resolveEmbedUrl,
  toProxyEmbedUrl,
  isDirectStreamUrl,
} from "@/lib/types";

// ---- API sources --------------------------------------------------------

export interface ApiSourceInput {
  name: string;
  baseUrl: string;
  headers?: Record<string, string>;
  docsUrl?: string | null;
  active?: boolean;
}

export async function listApiSources(): Promise<ApiSource[]> {
  if (isCloudflareWorkers) {
    const rows = await d1Query("SELECT * FROM ApiSource ORDER BY active DESC, createdAt ASC");
    return rows as unknown as ApiSource[];
  }
  return db.apiSource.findMany({ orderBy: [{ active: "desc" }, { createdAt: "asc" }] });
}

export async function getActiveApiSource(): Promise<ApiSource | null> {
  if (isCloudflareWorkers) {
    let rows = await d1Query("SELECT * FROM ApiSource WHERE active = 1 LIMIT 1");
    if (rows.length === 0) {
      rows = await d1Query("SELECT * FROM ApiSource ORDER BY createdAt DESC LIMIT 1");
    }
    return (rows[0] as unknown as ApiSource) ?? null;
  }
  const active = await db.apiSource.findFirst({ where: { active: true } });
  if (active) return active;
  return db.apiSource.findFirst({ orderBy: { createdAt: "desc" } });
}

export async function createApiSource(input: ApiSourceInput): Promise<ApiSource> {
  if (isCloudflareWorkers) {
    if (input.active) {
      await d1Exec("UPDATE ApiSource SET active = 0");
    }
    const id = `src-${Date.now()}`;
    const headers = JSON.stringify(input.headers || {}).replace(/'/g, "''");
    const docsUrl = input.docsUrl ? `'${input.docsUrl.replace(/'/g, "''")}'` : "NULL";
    await d1Exec(`INSERT INTO ApiSource (id, name, baseUrl, headers, docsUrl, active, healthy, createdAt, updatedAt) VALUES ('${id}', '${input.name.replace(/'/g, "''")}', '${input.baseUrl.replace(/'/g, "''")}', '${headers}', ${docsUrl}, ${input.active ? 1 : 0}, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`);
    invalidateCache();
    const rows = await d1Query("SELECT * FROM ApiSource WHERE id = ?", [id]);
    return rows[0] as unknown as ApiSource;
  }
  if (input.active) {
    await db.apiSource.updateMany({ data: { active: false } });
  }
  const item = await db.apiSource.create({
    data: {
      name: input.name,
      baseUrl: input.baseUrl,
      headers: JSON.stringify(input.headers || {}),
      docsUrl: input.docsUrl ?? null,
      active: input.active ?? false,
    },
  });
  invalidateCache();
  return item;
}

export async function updateApiSource(
  id: string,
  input: Partial<ApiSourceInput>
): Promise<ApiSource> {
  if (isCloudflareWorkers) {
    if (input.active) {
      await d1Exec("UPDATE ApiSource SET active = 0");
    }
    const sets: string[] = [];
    if (input.name !== undefined) sets.push(`name = '${input.name.replace(/'/g, "''")}'`);
    if (input.baseUrl !== undefined) sets.push(`baseUrl = '${input.baseUrl.replace(/'/g, "''")}'`);
    if (input.headers !== undefined) sets.push(`headers = '${JSON.stringify(input.headers).replace(/'/g, "''")}'`);
    if (input.docsUrl !== undefined) sets.push(`docsUrl = ${input.docsUrl ? `'${input.docsUrl.replace(/'/g, "''")}'` : "NULL"}`);
    if (input.active !== undefined) sets.push(`active = ${input.active ? 1 : 0}`);
    sets.push("updatedAt = CURRENT_TIMESTAMP");
    await d1Exec(`UPDATE ApiSource SET ${sets.join(", ")} WHERE id = '${id}'`);
    invalidateCache();
    const rows = await d1Query("SELECT * FROM ApiSource WHERE id = ?", [id]);
    return rows[0] as unknown as ApiSource;
  }
  if (input.active) {
    await db.apiSource.updateMany({ where: { id: { not: id } }, data: { active: false } });
  }
  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.baseUrl !== undefined) data.baseUrl = input.baseUrl;
  if (input.headers !== undefined) data.headers = JSON.stringify(input.headers);
  if (input.docsUrl !== undefined) data.docsUrl = input.docsUrl;
  if (input.active !== undefined) data.active = input.active;
  const item = await db.apiSource.update({ where: { id }, data });
  invalidateCache();
  return item;
}

export async function deleteApiSource(id: string): Promise<void> {
  if (isCloudflareWorkers) {
    await d1Exec(`DELETE FROM ApiSource WHERE id = '${id}'`);
    invalidateCache();
    return;
  }
  await db.apiSource.delete({ where: { id } });
  invalidateCache();
}

export async function setActiveApiSource(id: string): Promise<ApiSource> {
  if (isCloudflareWorkers) {
    await d1Exec("UPDATE ApiSource SET active = 0");
    await d1Exec(`UPDATE ApiSource SET active = 1 WHERE id = '${id}'`);
    invalidateCache();
    const rows = await d1Query("SELECT * FROM ApiSource WHERE id = ?", [id]);
    return rows[0] as unknown as ApiSource;
  }
  await db.apiSource.updateMany({ where: { id: { not: id } }, data: { active: false } });
  const item = await db.apiSource.update({ where: { id }, data: { active: true } });
  invalidateCache();
  return item;
}

// ---- Channels -----------------------------------------------------------

export interface ChannelInput {
  name: string;
  category?: string;
  logo?: string | null;
  streamUrl: string;
  sourceType?: string;
  enabled?: boolean;
  tags?: string | null;
  sortOrder?: number;
}

export async function listChannels(): Promise<Channel[]> {
  if (isCloudflareWorkers) {
    const rows = await d1Query("SELECT * FROM Channel ORDER BY sortOrder ASC, createdAt DESC");
    return rows as unknown as Channel[];
  }
  return db.channel.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] });
}

export async function listEnabledChannels(): Promise<Channel[]> {
  if (isCloudflareWorkers) {
    const rows = await d1Query("SELECT * FROM Channel WHERE enabled = 1 ORDER BY sortOrder ASC, createdAt DESC");
    return rows as unknown as Channel[];
  }
  return db.channel.findMany({
    where: { enabled: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });
}

export async function createChannel(input: ChannelInput): Promise<Channel> {
  if (isCloudflareWorkers) {
    const id = `ch-${Date.now()}`;
    const logo = input.logo ? `'${input.logo.replace(/'/g, "''")}'` : "NULL";
    const tags = input.tags ? `'${input.tags.replace(/'/g, "''")}'` : "NULL";
    await d1Exec(`INSERT INTO Channel (id, name, category, logo, streamUrl, sourceType, enabled, tags, sortOrder, createdAt, updatedAt) VALUES ('${id}', '${input.name.replace(/'/g, "''")}', '${(input.category || "other").replace(/'/g, "''")}', ${logo}, '${input.streamUrl.replace(/'/g, "''")}', '${(input.sourceType || "manual").replace(/'/g, "''")}', ${input.enabled !== false ? 1 : 0}, ${tags}, ${input.sortOrder || 0}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`);
    invalidateCache();
    const rows = await d1Query("SELECT * FROM Channel WHERE id = ?", [id]);
    return rows[0] as unknown as Channel;
  }
  const item = await db.channel.create({
    data: {
      name: input.name,
      category: input.category || "other",
      logo: input.logo ?? null,
      streamUrl: input.streamUrl,
      sourceType: input.sourceType || "manual",
      enabled: input.enabled ?? true,
      tags: input.tags ?? null,
      sortOrder: input.sortOrder ?? 0,
    },
  });
  invalidateCache();
  return item;
}

export async function createManyChannels(inputs: ChannelInput[]): Promise<number> {
  if (isCloudflareWorkers) {
    let count = 0;
    for (const input of inputs) {
      const id = `ch-${Date.now()}-${count}`;
      const logo = input.logo ? `'${input.logo.replace(/'/g, "''")}'` : "NULL";
      const tags = input.tags ? `'${input.tags.replace(/'/g, "''")}'` : "NULL";
      await d1Exec(`INSERT INTO Channel (id, name, category, logo, streamUrl, sourceType, enabled, tags, sortOrder, createdAt, updatedAt) VALUES ('${id}', '${input.name.replace(/'/g, "''")}', '${(input.category || "other").replace(/'/g, "''")}', ${logo}, '${input.streamUrl.replace(/'/g, "''")}', '${(input.sourceType || "manual").replace(/'/g, "''")}', 1, ${tags}, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`);
      count++;
    }
    invalidateCache();
    return count;
  }
  const res = await db.channel.createMany({
    data: inputs.map((i) => ({
      name: i.name,
      category: i.category || "other",
      logo: i.logo ?? null,
      streamUrl: i.streamUrl,
      sourceType: i.sourceType || "manual",
      enabled: i.enabled ?? true,
      tags: i.tags ?? null,
      sortOrder: i.sortOrder ?? 0,
    })),
  });
  invalidateCache();
  return res.count;
}

export async function updateChannel(
  id: string,
  input: Partial<ChannelInput>
): Promise<Channel> {
  if (isCloudflareWorkers) {
    const sets: string[] = [];
    if (input.name !== undefined) sets.push(`name = '${input.name.replace(/'/g, "''")}'`);
    if (input.category !== undefined) sets.push(`category = '${input.category.replace(/'/g, "''")}'`);
    if (input.logo !== undefined) sets.push(`logo = ${input.logo ? `'${input.logo.replace(/'/g, "''")}'` : "NULL"}`);
    if (input.streamUrl !== undefined) sets.push(`streamUrl = '${input.streamUrl.replace(/'/g, "''")}'`);
    if (input.enabled !== undefined) sets.push(`enabled = ${input.enabled ? 1 : 0}`);
    if (input.tags !== undefined) sets.push(`tags = ${input.tags ? `'${input.tags.replace(/'/g, "''")}'` : "NULL"}`);
    if (input.sortOrder !== undefined) sets.push(`sortOrder = ${input.sortOrder}`);
    sets.push("updatedAt = CURRENT_TIMESTAMP");
    await d1Exec(`UPDATE Channel SET ${sets.join(", ")} WHERE id = '${id}'`);
    invalidateCache();
    const rows = await d1Query("SELECT * FROM Channel WHERE id = ?", [id]);
    return rows[0] as unknown as Channel;
  }
  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.category !== undefined) data.category = input.category;
  if (input.logo !== undefined) data.logo = input.logo;
  if (input.streamUrl !== undefined) data.streamUrl = input.streamUrl;
  if (input.enabled !== undefined) data.enabled = input.enabled;
  if (input.tags !== undefined) data.tags = input.tags;
  if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
  const item = await db.channel.update({ where: { id }, data });
  invalidateCache();
  return item;
}

export async function deleteChannel(id: string): Promise<void> {
  if (isCloudflareWorkers) {
    await d1Exec(`DELETE FROM Channel WHERE id = '${id}'`);
    invalidateCache();
    return;
  }
  await db.channel.delete({ where: { id } });
  invalidateCache();
}

export async function deleteManyChannels(ids: string[]): Promise<number> {
  if (isCloudflareWorkers) {
    for (const id of ids) {
      await d1Exec(`DELETE FROM Channel WHERE id = '${id}'`);
    }
    invalidateCache();
    return ids.length;
  }
  const res = await db.channel.deleteMany({ where: { id: { in: ids } } });
  invalidateCache();
  return res.count;
}

// ---- Ad config ----------------------------------------------------------

export interface AdConfigShape {
  adsEnabled: boolean;
  config: Record<string, unknown>;
  scriptUrls: string[];
}

const DEFAULT_AD_CONFIG: AdConfigShape = {
  adsEnabled: false,
  config: {},
  scriptUrls: [],
};

export async function getAdConfig(): Promise<AdConfig & { _parsed: AdConfigShape }> {
  if (isCloudflareWorkers) {
    const rows = await d1Query("SELECT * FROM AdConfig WHERE id = ?", ["global"]);
    let row: Record<string, unknown>;
    if (rows.length === 0) {
      await d1Exec("INSERT OR IGNORE INTO AdConfig (id, adsEnabled, config, scriptUrls) VALUES ('global', 0, '{}', '[]')");
      row = { id: "global", adsEnabled: 0, config: "{}", scriptUrls: "[]" };
    } else {
      row = rows[0];
    }
    let parsed: AdConfigShape;
    try {
      parsed = {
        adsEnabled: Boolean(row.adsEnabled),
        config: JSON.parse((row.config as string) || "{}"),
        scriptUrls: JSON.parse((row.scriptUrls as string) || "[]"),
      };
    } catch {
      parsed = DEFAULT_AD_CONFIG;
    }
    return { ...(row as unknown as AdConfig), _parsed: parsed };
  }
  let row = await db.adConfig.findUnique({ where: { id: "global" } });
  if (!row) {
    row = await db.adConfig.create({ data: { id: "global" } });
  }
  let parsed: AdConfigShape;
  try {
    parsed = {
      adsEnabled: row.adsEnabled,
      config: JSON.parse(row.config || "{}"),
      scriptUrls: JSON.parse(row.scriptUrls || "[]"),
    };
  } catch {
    parsed = DEFAULT_AD_CONFIG;
  }
  return { ...row, _parsed: parsed };
}

export async function updateAdConfig(input: {
  adsEnabled?: boolean;
  config?: Record<string, unknown>;
  scriptUrls?: string[];
}): Promise<AdConfig> {
  const data: Record<string, unknown> = {};
  if (input.adsEnabled !== undefined) data.adsEnabled = input.adsEnabled;
  if (input.config !== undefined) data.config = JSON.stringify(input.config);
  if (input.scriptUrls !== undefined) data.scriptUrls = JSON.stringify(input.scriptUrls);
  return db.adConfig.upsert({
    where: { id: "global" },
    create: {
      id: "global",
      adsEnabled: input.adsEnabled ?? false,
      config: JSON.stringify(input.config ?? {}),
      scriptUrls: JSON.stringify(input.scriptUrls ?? []),
    },
    update: data,
  });
}

// ---- Seeding ------------------------------------------------------------

/** Seed default API sources + ad config on first run. */
export async function seedDefaults() {
  const count = await db.apiSource.count();
  if (count === 0) {
    await db.apiSource.create({
      data: {
        name: "DAMITV OnDemand",
        baseUrl: "https://ondemand.st/papi/api",
        headers: JSON.stringify({ Referer: "https://ondemand.st/api-docs" }),
        docsUrl: "https://ondemand.st/api-docs",
        active: true,
      },
    });
    await db.apiSource.create({
      data: {
        name: "Cinevid",
        baseUrl: "https://cinevid.st/api/public/events",
        headers: JSON.stringify({}),
        docsUrl: "https://cinevid.st/api-docs",
        active: false,
      },
    });
  }
  await db.adConfig.upsert({
    where: { id: "global" },
    create: { id: "global" },
    update: {},
  });
}

// ---- Curated matches (selectively added from any API source) ------------

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export interface CuratedMatchInput {
  sourceApiId?: string | null;
  streamId: string;
  name: string;
  category?: string;
  poster?: string | null;
  league?: string | null;
  startsAt?: number | null;
  endsAt?: number | null;
  status?: string;
  teams?: Record<string, unknown> | null;
  sources?: Record<string, unknown>[] | null;
  embed?: string | null;
  iframe?: string | null;
}

export async function listCurated(): Promise<CuratedMatch[]> {
  return db.curatedMatch.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
}

export async function listEnabledCurated(): Promise<CuratedMatch[]> {
  return db.curatedMatch.findMany({
    where: { enabled: true },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
}

export async function addCuratedMatch(
  input: CuratedMatchInput
): Promise<CuratedMatch> {
  // Avoid duplicates for the same source + stream id.
  const existing = await db.curatedMatch.findFirst({
    where: { sourceApiId: input.sourceApiId ?? null, streamId: input.streamId },
  });
  if (existing) return existing;
  const item = await db.curatedMatch.create({
    data: {
      sourceApiId: input.sourceApiId ?? null,
      streamId: input.streamId,
      name: input.name,
      category: input.category || "other",
      poster: input.poster ?? null,
      league: input.league ?? null,
      startsAt: input.startsAt ? new Date(input.startsAt * 1000) : null,
      endsAt: input.endsAt ? new Date(input.endsAt * 1000) : null,
      status: input.status || "upcoming",
      teams: JSON.stringify(input.teams || {}),
      sources: JSON.stringify(input.sources || []),
      embed: input.embed ?? null,
      iframe: input.iframe ?? null,
    },
  });
  invalidateCache();
  return item;
}

export async function deleteCuratedMatch(id: string): Promise<void> {
  await db.curatedMatch.delete({ where: { id } });
  invalidateCache();
}

export async function setCuratedEnabled(
  id: string,
  enabled: boolean
): Promise<CuratedMatch> {
  const item = await db.curatedMatch.update({
    where: { id },
    data: { enabled },
  });
  invalidateCache();
  return item;
}

/** Convert stored curated rows back into the public Stream shape. */
export function curatedToStreams(rows: CuratedMatch[]): StreamCategory[] {
  const catMap = new Map<string, StreamCategory>();
  let nextId = 5000;
  for (const r of rows) {
    const catKey = r.category || "other";
    let cat = catMap.get(catKey);
    if (!cat) {
      cat = { category: catKey, id: nextId++, streams: [] };
      catMap.set(catKey, cat);
    }
    let teams: Stream["teams"] = undefined;
    try {
      teams = JSON.parse(r.teams || "{}") as Stream["teams"];
    } catch {
      /* ignore */
    }
    let sources: Stream["sources"] = [];
    try {
      sources = JSON.parse(r.sources || "[]") as Stream["sources"];
    } catch {
      /* ignore */
    }
    // If the embed URL is a directly-playable video, mark it so the
    // inline player is used; otherwise it's a redirect target.
    const direct = isDirectStreamUrl(r.embed || r.iframe || "");
    const stream: Stream = {
      id: `curated-${r.id}`,
      name: r.name,
      poster: r.poster || undefined,
      starts_at: r.startsAt ? Math.floor(r.startsAt.getTime() / 1000) : 0,
      ends_at: r.endsAt ? Math.floor(r.endsAt.getTime() / 1000) : 0,
      category_name: catKey,
      status: (r.status === "live" ? "live" : "upcoming") as Stream["status"],
      league: r.league || undefined,
      teams,
      viewers: 0,
      playMode: direct ? "direct" : "redirect",
      directUrl: direct ? r.embed || r.iframe || undefined : undefined,
      sources: (sources || []).map((src) => {
        const embed = resolveEmbedUrl(src.embed);
        const sd = isDirectStreamUrl(embed);
        return {
          ...src,
          embed,
          playMode: sd ? ("direct" as const) : ("redirect" as const),
          directUrl: sd ? embed : undefined,
        };
      }),
      embed: r.embed || undefined,
      iframe: r.iframe || undefined,
    };
    cat.streams.push(stream);
  }
  return Array.from(catMap.values());
}

/**
 * Fetch the streams payload from a specific API source (for the admin
 * "browse & add" UI). Returns the raw upstream response so the admin can
 * pick individual matches to curate.
 */
export async function fetchStreamsFromSource(
  sourceId: string
): Promise<StreamsResponse | null> {
  const src = await db.apiSource.findUnique({ where: { id: sourceId } });
  if (!src) return null;
  let headers: Record<string, string> = {};
  try {
    headers = JSON.parse(src.headers || "{}");
  } catch {
    /* ignore */
  }
  const baseUrl = src.baseUrl;
  const lower = baseUrl.toLowerCase();
  const url =
    lower.endsWith("/streams") ||
    lower.endsWith("/events") ||
    lower.endsWith("/matches") ||
    lower.endsWith("/channels")
      ? baseUrl
      : baseUrl.replace(/\/$/, "") + "/streams";
  let upstreamOrigin = "https://damitv.st";
  try {
    upstreamOrigin = new URL(url).origin;
  } catch {
    /* ignore */
  }
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
      ...headers,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    throw new Error(`Upstream returned ${res.status}`);
  }
  const raw = await res.json();
  // Normalise whichever upstream shape (DAMITV / Cinevid / …) into ours.
  const { normalizeUpstream } = await import("@/lib/api-adapters");
  return normalizeUpstream(raw, upstreamOrigin);
}

// ---- Site config (content mode) -----------------------------------------

export type ContentMode = "auto" | "manual";

export interface SiteBranding {
  siteName: string;
  siteLogo: string | null;
}

export async function getSiteConfig(): Promise<SiteConfig> {
  if (isCloudflareWorkers) {
    const rows = await d1Query("SELECT * FROM SiteConfig WHERE id = ?", ["global"]);
    if (rows.length > 0) {
      return rows[0] as unknown as SiteConfig;
    }
    await d1Exec("INSERT OR IGNORE INTO SiteConfig (id, contentMode, siteName) VALUES ('global', 'auto', 'StreamSpatial')");
    const rows2 = await d1Query("SELECT * FROM SiteConfig WHERE id = ?", ["global"]);
    return rows2[0] as unknown as SiteConfig;
  }
  let row = await db.siteConfig.findUnique({ where: { id: "global" } });
  if (!row) {
    row = await db.siteConfig.create({ data: { id: "global" } });
  }
  return row;
}

export async function getContentMode(): Promise<ContentMode> {
  if (isCloudflareWorkers) {
    const rows = await d1Query("SELECT contentMode FROM SiteConfig WHERE id = ?", ["global"]);
    const mode = (rows[0]?.contentMode as string) || "auto";
    return mode === "manual" ? "manual" : "auto";
  }
  const cfg = await getSiteConfig();
  return cfg.contentMode === "manual" ? "manual" : "auto";
}

export async function setContentMode(mode: ContentMode): Promise<SiteConfig> {
  if (isCloudflareWorkers) {
    await d1Exec(`INSERT OR REPLACE INTO SiteConfig (id, contentMode, siteName, siteLogo, updatedAt) VALUES ('global', '${mode}', COALESCE((SELECT siteName FROM SiteConfig WHERE id='global'), 'StreamSpatial'), (SELECT siteLogo FROM SiteConfig WHERE id='global'), CURRENT_TIMESTAMP)`);
    const rows = await d1Query("SELECT * FROM SiteConfig WHERE id = ?", ["global"]);
    invalidateCache();
    return rows[0] as unknown as SiteConfig;
  }
  const row = await db.siteConfig.upsert({
    where: { id: "global" },
    create: { id: "global", contentMode: mode },
    update: { contentMode: mode },
  });
  invalidateCache();
  return row;
}

/** Read the site branding (name + logo) for site-wide display. */
export async function getBranding(): Promise<SiteBranding> {
  if (isCloudflareWorkers) {
    const rows = await d1Query("SELECT siteName, siteLogo FROM SiteConfig WHERE id = ?", ["global"]);
    return {
      siteName: (rows[0]?.siteName as string) || "StreamSpatial",
      siteLogo: (rows[0]?.siteLogo as string) ?? null,
    };
  }
  const cfg = await getSiteConfig();
  return {
    siteName: cfg.siteName || "StreamSpatial",
    siteLogo: cfg.siteLogo ?? null,
  };
}

/** Update the site branding. */
export async function updateBranding(input: {
  siteName?: string;
  siteLogo?: string | null;
}): Promise<SiteBranding> {
  if (isCloudflareWorkers) {
    const sets: string[] = [];
    if (input.siteName !== undefined) sets.push(`siteName = '${input.siteName.replace(/'/g, "''")}'`);
    if (input.siteLogo !== undefined) sets.push(`siteLogo = ${input.siteLogo ? `'${input.siteLogo.replace(/'/g, "''")}'` : "NULL"}`);
    sets.push("updatedAt = CURRENT_TIMESTAMP");
    await d1Exec(`INSERT OR IGNORE INTO SiteConfig (id, contentMode, siteName) VALUES ('global', 'auto', 'StreamSpatial')`);
    if (sets.length > 1) {
      await d1Exec(`UPDATE SiteConfig SET ${sets.join(", ")} WHERE id = 'global'`);
    }
    invalidateCache();
    const rows = await d1Query("SELECT siteName, siteLogo FROM SiteConfig WHERE id = ?", ["global"]);
    return {
      siteName: (rows[0]?.siteName as string) || "StreamSpatial",
      siteLogo: (rows[0]?.siteLogo as string) ?? null,
    };
  }
  const data: Record<string, unknown> = {};
  if (input.siteName !== undefined) data.siteName = input.siteName;
  if (input.siteLogo !== undefined) data.siteLogo = input.siteLogo ?? null;
  const row = await db.siteConfig.upsert({
    where: { id: "global" },
    create: {
      id: "global",
      siteName: input.siteName || "StreamSpatial",
      siteLogo: input.siteLogo ?? null,
    },
    update: data,
  });
  invalidateCache();
  return { siteName: row.siteName, siteLogo: row.siteLogo ?? null };
}

// ---- Channels curated from an API source --------------------------------

/**
 * Extract distinct TV channels (source feeds) from a raw API streams
 * response. Each channel = a unique source name with a representative
 * embed URL + category. Used by the admin Browse panel to let the admin
 * add channels (not just matches) from any API.
 */
export interface ApiChannel {
  id: string;
  name: string;
  embedUrl: string;
  category: string;
  quality: "HD" | "SD" | "AUTO";
  sampleMatch: string;
  live: boolean;
}

export function extractApiChannels(
  data: StreamsResponse
): ApiChannel[] {
  const map = new Map<string, ApiChannel>();
  for (const cat of data.streams || []) {
    for (const s of cat.streams || []) {
      for (const src of s.sources || []) {
        const key = (src.name || "").toLowerCase();
        if (!key) continue;
        const embed = resolveEmbedUrl(src.embed);
        const q = src.hd ? "HD" : src.sd ? "SD" : "AUTO";
        const existing = map.get(key);
        if (existing) {
          if (s.status === "live" && !existing.live) {
            existing.live = true;
            existing.embedUrl = embed;
            existing.sampleMatch = s.name;
          }
        } else {
          map.set(key, {
            id: key,
            name: src.name,
            embedUrl: embed,
            category: s.category_name || cat.category || "other",
            quality: q as ApiChannel["quality"],
            sampleMatch: s.name,
            live: s.status === "live",
          });
        }
      }
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => Number(b.live) - Number(a.live) || a.name.localeCompare(b.name)
  );
}

/** Add a channel (curated from an API) to the Channel table. */
export async function addChannelFromApi(input: {
  name: string;
  streamUrl: string;
  category?: string;
  logo?: string | null;
  sourceApiId?: string | null;
}): Promise<Channel> {
  const item = await db.channel.create({
    data: {
      name: input.name,
      streamUrl: input.streamUrl,
      category: input.category || "other",
      logo: input.logo ?? null,
      sourceType: "curated-api",
      enabled: true,
    },
  });
  invalidateCache();
  return item;
}

