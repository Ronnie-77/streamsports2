import "server-only";
import { db, d1Query, d1Exec, useD1, usePrisma, useMemory, memStore } from "@/lib/db";
import type { StreamsResponse, Stream, StreamCategory } from "@/lib/types";
import { resolveEmbedUrl, toProxyEmbedUrl, isDirectStreamUrl } from "@/lib/types";
import { invalidateCache } from "@/lib/streams-cache";

// Helper: escape SQL strings
function esc(s: string): string { return s.replace(/'/g, "''") }
function boolVal(b: boolean): number { return b ? 1 : 0 }

// ---- API sources --------------------------------------------------------

export interface ApiSourceInput {
  name: string;
  baseUrl: string;
  headers?: Record<string, string>;
  docsUrl?: string | null;
  active?: boolean;
}

export async function listApiSources() {
  if (useD1) return await d1Query("SELECT * FROM ApiSource ORDER BY active DESC, createdAt ASC")
  if (usePrisma && db) return await db.apiSource.findMany({ orderBy: [{ active: "desc" }, { createdAt: "asc" }] })
  return memStore.apiSources
}

export async function getActiveApiSource() {
  if (useD1) {
    let rows = await d1Query("SELECT * FROM ApiSource WHERE active = 1 LIMIT 1")
    if (rows.length === 0) rows = await d1Query("SELECT * FROM ApiSource ORDER BY createdAt DESC LIMIT 1")
    return rows[0] ?? null
  }
  if (usePrisma && db) {
    const active = await db.apiSource.findFirst({ where: { active: true } })
    if (active) return active
    return db.apiSource.findFirst({ orderBy: { createdAt: "desc" } })
  }
  return memStore.apiSources.find(s => s.active) ?? memStore.apiSources[0] ?? null
}

export async function createApiSource(input: ApiSourceInput) {
  if (useD1) {
    if (input.active) await d1Exec("UPDATE ApiSource SET active = 0")
    const id = `src-${Date.now()}`
    await d1Exec(`INSERT INTO ApiSource (id,name,baseUrl,headers,docsUrl,active,healthy,createdAt,updatedAt) VALUES ('${id}','${esc(input.name)}','${esc(input.baseUrl)}','${esc(JSON.stringify(input.headers||{}))}',${input.docsUrl?`'${esc(input.docsUrl)}'`:"NULL"},${boolVal(input.active||false)},1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`)
    invalidateCache()
    return (await d1Query("SELECT * FROM ApiSource WHERE id = ?", [id]))[0]
  }
  if (usePrisma && db) {
    if (input.active) await db.apiSource.updateMany({ data: { active: false } })
    const item = await db.apiSource.create({ data: { name: input.name, baseUrl: input.baseUrl, headers: JSON.stringify(input.headers||{}), docsUrl: input.docsUrl ?? null, active: input.active ?? false } })
    invalidateCache()
    return item
  }
  const item = { id: `src-${Date.now()}`, name: input.name, baseUrl: input.baseUrl, headers: JSON.stringify(input.headers||{}), docsUrl: input.docsUrl ?? null, active: boolVal(input.active||false), healthy: 1, lastCheck: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
  memStore.apiSources.push(item)
  invalidateCache()
  return item
}

export async function updateApiSource(id: string, input: Partial<ApiSourceInput>) {
  if (useD1) {
    if (input.active) await d1Exec("UPDATE ApiSource SET active = 0")
    const sets: string[] = []
    if (input.name !== undefined) sets.push(`name='${esc(input.name)}'`)
    if (input.baseUrl !== undefined) sets.push(`baseUrl='${esc(input.baseUrl)}'`)
    if (input.headers !== undefined) sets.push(`headers='${esc(JSON.stringify(input.headers))}'`)
    if (input.docsUrl !== undefined) sets.push(`docsUrl=${input.docsUrl?`'${esc(input.docsUrl)}'`:"NULL"}`)
    if (input.active !== undefined) sets.push(`active=${boolVal(input.active)}`)
    sets.push("updatedAt=CURRENT_TIMESTAMP")
    await d1Exec(`UPDATE ApiSource SET ${sets.join(",")} WHERE id='${esc(id)}'`)
    invalidateCache()
    return (await d1Query("SELECT * FROM ApiSource WHERE id = ?", [id]))[0]
  }
  if (usePrisma && db) {
    if (input.active) await db.apiSource.updateMany({ where: { id: { not: id } }, data: { active: false } })
    const data: Record<string, unknown> = {}
    if (input.name !== undefined) data.name = input.name
    if (input.baseUrl !== undefined) data.baseUrl = input.baseUrl
    if (input.headers !== undefined) data.headers = JSON.stringify(input.headers)
    if (input.docsUrl !== undefined) data.docsUrl = input.docsUrl
    if (input.active !== undefined) data.active = input.active
    const item = await db.apiSource.update({ where: { id }, data })
    invalidateCache()
    return item
  }
  const item = memStore.apiSources.find(s => s.id === id)
  if (item) {
    if (input.name !== undefined) item.name = input.name
    if (input.baseUrl !== undefined) item.baseUrl = input.baseUrl
    if (input.active !== undefined) { item.active = boolVal(input.active); if (input.active) memStore.apiSources.forEach(s => { if (s.id !== id) s.active = 0 }) }
  }
  invalidateCache()
  return item
}

export async function deleteApiSource(id: string) {
  if (useD1) { await d1Exec(`DELETE FROM ApiSource WHERE id='${esc(id)}'`); invalidateCache(); return }
  if (usePrisma && db) { await db.apiSource.delete({ where: { id } }); invalidateCache(); return }
  memStore.apiSources = memStore.apiSources.filter(s => s.id !== id)
  invalidateCache()
}

export async function setActiveApiSource(id: string) {
  if (useD1) {
    await d1Exec("UPDATE ApiSource SET active = 0")
    await d1Exec(`UPDATE ApiSource SET active = 1 WHERE id='${esc(id)}'`)
    invalidateCache()
    return (await d1Query("SELECT * FROM ApiSource WHERE id = ?", [id]))[0]
  }
  if (usePrisma && db) {
    await db.apiSource.updateMany({ where: { id: { not: id } }, data: { active: false } })
    const item = await db.apiSource.update({ where: { id }, data: { active: true } })
    invalidateCache()
    return item
  }
  memStore.apiSources.forEach(s => { s.active = boolVal(s.id === id) })
  invalidateCache()
  return memStore.apiSources.find(s => s.id === id)
}

// ---- Channels -----------------------------------------------------------

export interface ChannelInput {
  name: string; category?: string; logo?: string | null; streamUrl: string;
  sourceType?: string; enabled?: boolean; tags?: string | null; sortOrder?: number;
}

export async function listChannels() {
  if (useD1) return await d1Query("SELECT * FROM Channel ORDER BY sortOrder ASC, createdAt DESC")
  if (usePrisma && db) return await db.channel.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] })
  return memStore.channels
}

export async function listEnabledChannels() {
  if (useD1) return await d1Query("SELECT * FROM Channel WHERE enabled = 1 ORDER BY sortOrder ASC, createdAt DESC")
  if (usePrisma && db) return await db.channel.findMany({ where: { enabled: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] })
  return memStore.channels.filter(c => c.enabled)
}

export async function createChannel(input: ChannelInput) {
  if (useD1) {
    const id = `ch-${Date.now()}`
    await d1Exec(`INSERT INTO Channel (id,name,category,logo,streamUrl,sourceType,enabled,tags,sortOrder,createdAt,updatedAt) VALUES ('${id}','${esc(input.name)}','${esc(input.category||"other")}',${input.logo?`'${esc(input.logo)}'`:"NULL"},'${esc(input.streamUrl)}','${esc(input.sourceType||"manual")}',${boolVal(input.enabled!==false)},${input.tags?`'${esc(input.tags)}'`:"NULL"},${input.sortOrder||0},CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`)
    invalidateCache()
    return (await d1Query("SELECT * FROM Channel WHERE id = ?", [id]))[0]
  }
  if (usePrisma && db) {
    const item = await db.channel.create({ data: { name: input.name, category: input.category||"other", logo: input.logo ?? null, streamUrl: input.streamUrl, sourceType: input.sourceType||"manual", enabled: input.enabled ?? true, tags: input.tags ?? null, sortOrder: input.sortOrder ?? 0 } })
    invalidateCache()
    return item
  }
  const item = { id: `ch-${Date.now()}`, name: input.name, category: input.category||"other", logo: input.logo ?? null, streamUrl: input.streamUrl, sourceType: input.sourceType||"manual", enabled: boolVal(input.enabled!==false), tags: input.tags ?? null, sortOrder: input.sortOrder||0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
  memStore.channels.push(item)
  invalidateCache()
  return item
}

export async function createManyChannels(inputs: ChannelInput[]) {
  if (useD1) {
    let count = 0
    for (const i of inputs) {
      const id = `ch-${Date.now()}-${count}`
      await d1Exec(`INSERT INTO Channel (id,name,category,logo,streamUrl,sourceType,enabled,tags,sortOrder,createdAt,updatedAt) VALUES ('${id}','${esc(i.name)}','${esc(i.category||"other")}',${i.logo?`'${esc(i.logo)}'`:"NULL"},'${esc(i.streamUrl)}','${esc(i.sourceType||"manual")}',1,NULL,0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`)
      count++
    }
    invalidateCache()
    return count
  }
  if (usePrisma && db) {
    const res = await db.channel.createMany({ data: inputs.map(i => ({ name: i.name, category: i.category||"other", logo: i.logo ?? null, streamUrl: i.streamUrl, sourceType: i.sourceType||"manual", enabled: i.enabled ?? true, tags: i.tags ?? null, sortOrder: i.sortOrder ?? 0 })) })
    invalidateCache()
    return res.count
  }
  for (const i of inputs) {
    memStore.channels.push({ id: `ch-${Date.now()}-${memStore.channels.length}`, name: i.name, category: i.category||"other", logo: i.logo ?? null, streamUrl: i.streamUrl, sourceType: i.sourceType||"manual", enabled: 1, tags: i.tags ?? null, sortOrder: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
  }
  invalidateCache()
  return inputs.length
}

export async function updateChannel(id: string, input: Partial<ChannelInput>) {
  if (useD1) {
    const sets: string[] = []
    if (input.name !== undefined) sets.push(`name='${esc(input.name)}'`)
    if (input.category !== undefined) sets.push(`category='${esc(input.category)}'`)
    if (input.logo !== undefined) sets.push(`logo=${input.logo?`'${esc(input.logo)}'`:"NULL"}`)
    if (input.streamUrl !== undefined) sets.push(`streamUrl='${esc(input.streamUrl)}'`)
    if (input.enabled !== undefined) sets.push(`enabled=${boolVal(input.enabled)}`)
    sets.push("updatedAt=CURRENT_TIMESTAMP")
    await d1Exec(`UPDATE Channel SET ${sets.join(",")} WHERE id='${esc(id)}'`)
    invalidateCache()
    return (await d1Query("SELECT * FROM Channel WHERE id = ?", [id]))[0]
  }
  if (usePrisma && db) {
    const data: Record<string, unknown> = {}
    if (input.name !== undefined) data.name = input.name
    if (input.category !== undefined) data.category = input.category
    if (input.logo !== undefined) data.logo = input.logo
    if (input.streamUrl !== undefined) data.streamUrl = input.streamUrl
    if (input.enabled !== undefined) data.enabled = input.enabled
    const item = await db.channel.update({ where: { id }, data })
    invalidateCache()
    return item
  }
  const item = memStore.channels.find(c => c.id === id)
  if (item) { if (input.name !== undefined) item.name = input.name; if (input.logo !== undefined) item.logo = input.logo; if (input.enabled !== undefined) item.enabled = boolVal(input.enabled); if (input.streamUrl !== undefined) item.streamUrl = input.streamUrl }
  invalidateCache()
  return item
}

export async function deleteChannel(id: string) {
  if (useD1) { await d1Exec(`DELETE FROM Channel WHERE id='${esc(id)}'`); invalidateCache(); return }
  if (usePrisma && db) { await db.channel.delete({ where: { id } }); invalidateCache(); return }
  memStore.channels = memStore.channels.filter(c => c.id !== id)
  invalidateCache()
}

export async function deleteManyChannels(ids: string[]) {
  if (useD1) { for (const id of ids) await d1Exec(`DELETE FROM Channel WHERE id='${esc(id)}'`); invalidateCache(); return ids.length }
  if (usePrisma && db) { const res = await db.channel.deleteMany({ where: { id: { in: ids } } }); invalidateCache(); return res.count }
  memStore.channels = memStore.channels.filter(c => !ids.includes(c.id as string))
  invalidateCache()
  return ids.length
}

// ---- Ad config ----------------------------------------------------------

export interface AdConfigShape { adsEnabled: boolean; config: Record<string, unknown>; scriptUrls: string[] }

export async function getAdConfig() {
  const defaults = { adsEnabled: false, config: {}, scriptUrls: [] }
  if (useD1) {
    const rows = await d1Query("SELECT * FROM AdConfig WHERE id = ?", ["global"])
    const row = rows[0] || { id: "global", adsEnabled: 0, config: "{}", scriptUrls: "[]" }
    try { return { ...row, _parsed: { adsEnabled: Boolean(row.adsEnabled), config: JSON.parse((row.config as string)||"{}"), scriptUrls: JSON.parse((row.scriptUrls as string)||"[]") } } } catch { return { ...row, _parsed: defaults } }
  }
  if (usePrisma && db) {
    let row = await db.adConfig.findUnique({ where: { id: "global" } })
    if (!row) row = await db.adConfig.create({ data: { id: "global" } })
    try { return { ...row, _parsed: { adsEnabled: row.adsEnabled, config: JSON.parse(row.config||"{}"), scriptUrls: JSON.parse(row.scriptUrls||"[]") } } } catch { return { ...row, _parsed: defaults } }
  }
  const row = memStore.adConfig
  try { return { ...row, _parsed: { adsEnabled: Boolean(row.adsEnabled), config: JSON.parse(row.config||"{}"), scriptUrls: JSON.parse(row.scriptUrls||"[]") } } } catch { return { ...row, _parsed: defaults } }
}

export async function updateAdConfig(input: { adsEnabled?: boolean; config?: Record<string, unknown>; scriptUrls?: string[] }) {
  if (useD1) {
    const sets: string[] = []
    if (input.adsEnabled !== undefined) sets.push(`adsEnabled=${boolVal(input.adsEnabled)}`)
    if (input.config !== undefined) sets.push(`config='${esc(JSON.stringify(input.config))}'`)
    if (input.scriptUrls !== undefined) sets.push(`scriptUrls='${esc(JSON.stringify(input.scriptUrls))}'`)
    sets.push("updatedAt=CURRENT_TIMESTAMP")
    await d1Exec("INSERT OR IGNORE INTO AdConfig (id,adsEnabled,config,scriptUrls) VALUES ('global',0,'{}','[]')")
    if (sets.length > 1) await d1Exec(`UPDATE AdConfig SET ${sets.join(",")} WHERE id='global'`)
    return (await d1Query("SELECT * FROM AdConfig WHERE id = ?", ["global"]))[0]
  }
  if (usePrisma && db) {
    const data: Record<string, unknown> = {}
    if (input.adsEnabled !== undefined) data.adsEnabled = input.adsEnabled
    if (input.config !== undefined) data.config = JSON.stringify(input.config)
    if (input.scriptUrls !== undefined) data.scriptUrls = JSON.stringify(input.scriptUrls)
    return db.adConfig.upsert({ where: { id: "global" }, create: { id: "global", ...data }, update: data })
  }
  if (input.adsEnabled !== undefined) memStore.adConfig.adsEnabled = boolVal(input.adsEnabled)
  if (input.config !== undefined) memStore.adConfig.config = JSON.stringify(input.config)
  if (input.scriptUrls !== undefined) memStore.adConfig.scriptUrls = JSON.stringify(input.scriptUrls)
  return memStore.adConfig
}

// ---- Site config / branding ---------------------------------------------

export type ContentMode = "auto" | "manual"
export interface SiteBranding { siteName: string; siteLogo: string | null }

export async function getBranding(): Promise<SiteBranding> {
  if (useD1) {
    const rows = await d1Query("SELECT siteName, siteLogo FROM SiteConfig WHERE id = ?", ["global"])
    return { siteName: (rows[0]?.siteName as string) || "StreamSpatial", siteLogo: (rows[0]?.siteLogo as string) ?? null }
  }
  if (usePrisma && db) {
    let row = await db.siteConfig.findUnique({ where: { id: "global" } })
    if (!row) row = await db.siteConfig.create({ data: { id: "global" } })
    return { siteName: row.siteName || "StreamSpatial", siteLogo: row.siteLogo ?? null }
  }
  return { siteName: memStore.siteConfig.siteName || "StreamSpatial", siteLogo: memStore.siteConfig.siteLogo ?? null }
}

export async function getContentMode(): Promise<ContentMode> {
  if (useD1) {
    const rows = await d1Query("SELECT contentMode FROM SiteConfig WHERE id = ?", ["global"])
    return ((rows[0]?.contentMode as string) || "auto") === "manual" ? "manual" : "auto"
  }
  if (usePrisma && db) {
    let row = await db.siteConfig.findUnique({ where: { id: "global" } })
    if (!row) row = await db.siteConfig.create({ data: { id: "global" } })
    return row.contentMode === "manual" ? "manual" : "auto"
  }
  return (memStore.siteConfig.contentMode as string) === "manual" ? "manual" : "auto"
}

export async function setContentMode(mode: ContentMode) {
  if (useD1) {
    await d1Exec("INSERT OR IGNORE INTO SiteConfig (id,contentMode,siteName) VALUES ('global','auto','StreamSpatial')")
    await d1Exec(`UPDATE SiteConfig SET contentMode='${mode}',updatedAt=CURRENT_TIMESTAMP WHERE id='global'`)
    invalidateCache()
    return (await d1Query("SELECT * FROM SiteConfig WHERE id = ?", ["global"]))[0]
  }
  if (usePrisma && db) {
    const row = await db.siteConfig.upsert({ where: { id: "global" }, create: { id: "global", contentMode: mode }, update: { contentMode: mode } })
    invalidateCache()
    return row
  }
  memStore.siteConfig.contentMode = mode
  invalidateCache()
  return memStore.siteConfig
}

export async function updateBranding(input: { siteName?: string; siteLogo?: string | null }) {
  if (useD1) {
    const sets: string[] = []
    if (input.siteName !== undefined) sets.push(`siteName='${esc(input.siteName)}'`)
    if (input.siteLogo !== undefined) sets.push(`siteLogo=${input.siteLogo?`'${esc(input.siteLogo)}'`:"NULL"}`)
    sets.push("updatedAt=CURRENT_TIMESTAMP")
    await d1Exec("INSERT OR IGNORE INTO SiteConfig (id,contentMode,siteName) VALUES ('global','auto','StreamSpatial')")
    if (sets.length > 1) await d1Exec(`UPDATE SiteConfig SET ${sets.join(",")} WHERE id='global'`)
    invalidateCache()
    const rows = await d1Query("SELECT siteName, siteLogo FROM SiteConfig WHERE id = ?", ["global"])
    return { siteName: (rows[0]?.siteName as string) || "StreamSpatial", siteLogo: (rows[0]?.siteLogo as string) ?? null }
  }
  if (usePrisma && db) {
    const data: Record<string, unknown> = {}
    if (input.siteName !== undefined) data.siteName = input.siteName
    if (input.siteLogo !== undefined) data.siteLogo = input.siteLogo ?? null
    const row = await db.siteConfig.upsert({ where: { id: "global" }, create: { id: "global", siteName: input.siteName||"StreamSpatial", siteLogo: input.siteLogo ?? null }, update: data })
    invalidateCache()
    return { siteName: row.siteName, siteLogo: row.siteLogo ?? null }
  }
  if (input.siteName !== undefined) memStore.siteConfig.siteName = input.siteName
  if (input.siteLogo !== undefined) memStore.siteConfig.siteLogo = input.siteLogo as string | null
  invalidateCache()
  return { siteName: memStore.siteConfig.siteName, siteLogo: memStore.siteConfig.siteLogo ?? null }
}

// ---- Curated matches ----------------------------------------------------

export interface CuratedMatchInput {
  sourceApiId?: string | null; streamId: string; name: string; category?: string;
  poster?: string | null; league?: string | null; startsAt?: number | null; endsAt?: number | null;
  status?: string; teams?: Record<string, unknown> | null; sources?: Record<string, unknown>[] | null;
  embed?: string | null; iframe?: string | null;
}

export async function listCurated() {
  if (useD1) return await d1Query("SELECT * FROM CuratedMatch ORDER BY status ASC, createdAt DESC")
  if (usePrisma && db) return await db.curatedMatch.findMany({ orderBy: [{ status: "asc" }, { createdAt: "desc" }] })
  return memStore.curatedMatches
}

export async function listEnabledCurated() {
  if (useD1) return await d1Query("SELECT * FROM CuratedMatch WHERE enabled = 1 ORDER BY status ASC, createdAt DESC")
  if (usePrisma && db) return await db.curatedMatch.findMany({ where: { enabled: true }, orderBy: [{ status: "asc" }, { createdAt: "desc" }] })
  return memStore.curatedMatches.filter(m => m.enabled)
}

export async function addCuratedMatch(input: CuratedMatchInput) {
  if (useD1) {
    const existing = await d1Query("SELECT * FROM CuratedMatch WHERE streamId = ? AND sourceApiId " + (input.sourceApiId ? "= ?" : "IS NULL"), input.sourceApiId ? [input.streamId, input.sourceApiId] : [input.streamId])
    if (existing.length > 0) return existing[0]
    const id = `cur-${Date.now()}`
    await d1Exec(`INSERT INTO CuratedMatch (id,sourceApiId,streamId,name,category,poster,league,startsAt,endsAt,status,teams,sources,embed,iframe,enabled,createdAt,updatedAt) VALUES ('${id}',${input.sourceApiId?`'${esc(input.sourceApiId)}'`:"NULL"},'${esc(input.streamId)}','${esc(input.name)}','${esc(input.category||"other")}',${input.poster?`'${esc(input.poster)}'`:"NULL"},${input.league?`'${esc(input.league)}'`:"NULL"},${input.startsAt?`datetime(${input.startsAt},'unixepoch')`:"NULL"},${input.endsAt?`datetime(${input.endsAt},'unixepoch')`:"NULL"},'${esc(input.status||"upcoming")}','${esc(JSON.stringify(input.teams||{}))}','${esc(JSON.stringify(input.sources||[]))}',${input.embed?`'${esc(input.embed)}'`:"NULL"},${input.iframe?`'${esc(input.iframe)}'`:"NULL"},1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`)
    invalidateCache()
    return (await d1Query("SELECT * FROM CuratedMatch WHERE id = ?", [id]))[0]
  }
  if (usePrisma && db) {
    const existing = await db.curatedMatch.findFirst({ where: { sourceApiId: input.sourceApiId ?? null, streamId: input.streamId } })
    if (existing) return existing
    const item = await db.curatedMatch.create({ data: { sourceApiId: input.sourceApiId ?? null, streamId: input.streamId, name: input.name, category: input.category||"other", poster: input.poster ?? null, league: input.league ?? null, startsAt: input.startsAt ? new Date(input.startsAt*1000) : null, endsAt: input.endsAt ? new Date(input.endsAt*1000) : null, status: input.status||"upcoming", teams: JSON.stringify(input.teams||{}), sources: JSON.stringify(input.sources||[]), embed: input.embed ?? null, iframe: input.iframe ?? null } })
    invalidateCache()
    return item
  }
  const item = { id: `cur-${Date.now()}`, sourceApiId: input.sourceApiId ?? null, streamId: input.streamId, name: input.name, category: input.category||"other", poster: input.poster ?? null, league: input.league ?? null, startsAt: input.startsAt ? new Date(input.startsAt*1000).toISOString() : null, endsAt: input.endsAt ? new Date(input.endsAt*1000).toISOString() : null, status: input.status||"upcoming", teams: JSON.stringify(input.teams||{}), sources: JSON.stringify(input.sources||[]), embed: input.embed ?? null, iframe: input.iframe ?? null, enabled: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
  memStore.curatedMatches.push(item)
  invalidateCache()
  return item
}

export async function deleteCuratedMatch(id: string) {
  if (useD1) { await d1Exec(`DELETE FROM CuratedMatch WHERE id='${esc(id)}'`); invalidateCache(); return }
  if (usePrisma && db) { await db.curatedMatch.delete({ where: { id } }); invalidateCache(); return }
  memStore.curatedMatches = memStore.curatedMatches.filter(m => m.id !== id)
  invalidateCache()
}

export async function setCuratedEnabled(id: string, enabled: boolean) {
  if (useD1) { await d1Exec(`UPDATE CuratedMatch SET enabled=${boolVal(enabled)} WHERE id='${esc(id)}'`); invalidateCache(); return (await d1Query("SELECT * FROM CuratedMatch WHERE id = ?", [id]))[0] }
  if (usePrisma && db) { const item = await db.curatedMatch.update({ where: { id }, data: { enabled } }); invalidateCache(); return item }
  const item = memStore.curatedMatches.find(m => m.id === id); if (item) item.enabled = boolVal(enabled); invalidateCache(); return item
}

// ---- Convert curated to streams ----

export function curatedToStreams(rows: Record<string, unknown>[]): StreamCategory[] {
  const catMap = new Map<string, StreamCategory>(); let nextId = 5000
  for (const r of rows) {
    const catKey = (r.category as string) || "other"
    let cat = catMap.get(catKey)
    if (!cat) { cat = { category: catKey, id: nextId++, streams: [] }; catMap.set(catKey, cat) }
    let teams: Stream["teams"]; try { teams = JSON.parse(r.teams as string) } catch { teams = undefined }
    let sources: Stream["sources"] = []; try { sources = JSON.parse(r.sources as string) } catch { /* ignore */ }
    const embed = r.embed as string
    const direct = isDirectStreamUrl(embed)
    cat.streams.push({
      id: `curated-${r.id}`, name: r.name as string, poster: r.poster as string|undefined,
      starts_at: r.startsAt ? Math.floor(new Date(r.startsAt as string).getTime()/1000) : 0,
      ends_at: r.endsAt ? Math.floor(new Date(r.endsAt as string).getTime()/1000) : 0,
      category_name: catKey, status: r.status === "live" ? "live" : "upcoming",
      league: r.league as string|undefined, teams, viewers: 0,
      playMode: direct ? "direct" : "redirect", directUrl: direct ? embed : undefined,
      sources: (sources as Record<string, unknown>[]).map((src: Record<string, unknown>) => { const e = resolveEmbedUrl(src.embed as string); const sd = isDirectStreamUrl(e); return { ...src, embed: e, playMode: sd ? ("direct" as const) : ("redirect" as const), directUrl: sd ? e : undefined } }),
      embed: embed || undefined, iframe: r.iframe as string|undefined,
    } as Stream)
  }
  return Array.from(catMap.values())
}

// ---- Fetch from API source ----

export async function fetchStreamsFromSource(sourceId: string): Promise<StreamsResponse | null> {
  let src: Record<string, unknown> | null = null
  if (useD1) {
    const rows = await d1Query("SELECT * FROM ApiSource WHERE id = ?", [sourceId])
    src = rows[0] ?? null
  } else if (usePrisma && db) {
    src = await db.apiSource.findUnique({ where: { id: sourceId } })
  } else {
    src = memStore.apiSources.find(s => s.id === sourceId) ?? null
  }
  if (!src) return null
  let headers: Record<string, string> = {}; try { headers = JSON.parse(src.headers as string) } catch { /* ignore */ }
  const baseUrl = src.baseUrl as string
  const lower = baseUrl.toLowerCase()
  const url = lower.endsWith("/streams") || lower.endsWith("/events") || lower.endsWith("/matches") || lower.endsWith("/channels") ? baseUrl : baseUrl.replace(/\/$/, "") + "/streams"
  let upstreamOrigin = "https://damitv.st"; try { upstreamOrigin = new URL(url).origin } catch { /* ignore */ }
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36", Accept: "application/json,text/plain,*/*", "Accept-Language": "en-US,en;q=0.9", ...headers }, cache: "no-store", signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error(`Upstream returned ${res.status}`)
  const raw = await res.json()
  const { normalizeUpstream } = await import("@/lib/api-adapters")
  return normalizeUpstream(raw, upstreamOrigin)
}

// ---- Seeding ----

export async function seedDefaults() {
  if (useD1) {
    const count = (await d1Query("SELECT count(*) as c FROM ApiSource"))[0]?.c as number
    if (count === 0) {
      await d1Exec("INSERT INTO ApiSource (id,name,baseUrl,headers,docsUrl,active,healthy,createdAt,updatedAt) VALUES ('seed-damitv','DAMITV OnDemand','https://ondemand.st/papi/api','{\"Referer\":\"https://ondemand.st/api-docs\"}','https://ondemand.st/api-docs',1,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)")
      await d1Exec("INSERT INTO ApiSource (id,name,baseUrl,headers,docsUrl,active,healthy,createdAt,updatedAt) VALUES ('seed-cinevid','Cinevid','https://cinevid.st/api/public/events','{}','https://cinevid.st/api-docs',0,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)")
      await d1Exec("INSERT INTO ApiSource (id,name,baseUrl,headers,docsUrl,active,healthy,createdAt,updatedAt) VALUES ('seed-vidcdn','Cinevid IPTV Channels','https://vidcdn.vip/api/channels','{}','https://cinevid.st/api-docs',0,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)")
    }
    await d1Exec("INSERT OR IGNORE INTO AdConfig (id,adsEnabled,config,scriptUrls) VALUES ('global',0,'{}','[]')")
    await d1Exec("INSERT OR IGNORE INTO SiteConfig (id,contentMode,siteName) VALUES ('global','auto','StreamSpatial')")
    return
  }
  if (usePrisma && db) {
    if (await db.apiSource.count() === 0) {
      await db.apiSource.create({ data: { name: "DAMITV OnDemand", baseUrl: "https://ondemand.st/papi/api", headers: JSON.stringify({ Referer: "https://ondemand.st/api-docs" }), docsUrl: "https://ondemand.st/api-docs", active: true } })
      await db.apiSource.create({ data: { name: "Cinevid", baseUrl: "https://cinevid.st/api/public/events", headers: JSON.stringify({}), docsUrl: "https://cinevid.st/api-docs" } })
      await db.apiSource.create({ data: { name: "Cinevid IPTV Channels", baseUrl: "https://vidcdn.vip/api/channels", headers: JSON.stringify({}), docsUrl: "https://cinevid.st/api-docs" } })
    }
    await db.adConfig.upsert({ where: { id: "global" }, create: { id: "global" }, update: {} })
    return
  }
  // Memory: already seeded in memStore
}
