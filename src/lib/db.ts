// Database layer — works on Cloudflare Workers (D1) and local dev (Prisma/SQLite).
// Falls back to in-memory storage if neither is available.

import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// ---- In-memory fallback store ----
const memStore = {
  siteConfig: { id: 'global', contentMode: 'auto', siteName: 'StreamSpatial', siteLogo: null as string | null, updatedAt: new Date().toISOString() },
  adConfig: { id: 'global', adsEnabled: 0, config: '{}', scriptUrls: '[]', updatedAt: new Date().toISOString() },
  apiSources: [
    { id: 'seed-damitv', name: 'DAMITV OnDemand', baseUrl: 'https://ondemand.st/papi/api', headers: '{"Referer":"https://ondemand.st/api-docs"}', docsUrl: 'https://ondemand.st/api-docs', active: 1, healthy: 1, lastCheck: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'seed-cinevid', name: 'Cinevid', baseUrl: 'https://cinevid.st/api/public/events', headers: '{}', docsUrl: 'https://cinevid.st/api-docs', active: 0, healthy: 1, lastCheck: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { id: 'seed-vidcdn', name: 'Cinevid IPTV Channels', baseUrl: 'https://vidcdn.vip/api/channels', headers: '{}', docsUrl: 'https://cinevid.st/api-docs', active: 0, healthy: 1, lastCheck: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  ] as Record<string, unknown>[],
  channels: [] as Record<string, unknown>[],
  curatedMatches: [] as Record<string, unknown>[],
}

// ---- Try to get D1 binding from various sources ----
function getD1(): any | null {
  // OpenNext may expose env through globalThis
  const g = globalThis as Record<string, any>
  if (g.D1_DATABASE) return g.D1_DATABASE
  if (g.cloudflareEnv?.D1_DATABASE) return g.cloudflareEnv.D1_DATABASE
  if (g.process?.env?.D1_DATABASE) return g.process.env.D1_DATABASE
  return null
}

export const isCloudflareWorkers = !!getD1()
const d1 = getD1()

// Local dev Prisma client
const localDb = (!d1 && process.env.DATABASE_URL)
  ? (globalForPrisma.prisma ?? new PrismaClient({ log: process.env.NODE_ENV !== 'production' ? ['query'] : undefined }))
  : null
if (localDb && process.env.NODE_ENV !== 'production') globalForPrisma.prisma = localDb

export { localDb as db }

// ---- D1 query helpers ----
export async function d1Query(sql: string, params?: unknown[]): Promise<Record<string, unknown>[]> {
  if (d1) {
    try {
      const stmt = params && params.length > 0 ? d1.prepare(sql).bind(...params) : d1.prepare(sql)
      const result = await stmt.all()
      return result.results || []
    } catch (e) {
      console.error('D1 query error:', sql, e)
      return []
    }
  }
  return []
}

export async function d1Exec(sql: string): Promise<boolean> {
  if (d1) {
    try {
      await d1.prepare(sql).run()
      return true
    } catch (e) {
      console.error('D1 exec error:', sql, e)
      return false
    }
  }
  return false
}

// ---- Universal storage helpers (D1 > Prisma > in-memory) ----
export const useD1 = !!d1
export const usePrisma = !!localDb
export const useMemory = !d1 && !localDb

export { memStore }
