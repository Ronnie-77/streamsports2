import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Local dev: standard PrismaClient with SQLite.
// Cloudflare Workers: D1 is accessed directly via the binding (not through Prisma).
// Prisma's D1 adapter has compatibility issues on Workers, so we use
// the standard client only for local dev and fall back to direct D1
// queries on Workers (handled in each route).

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV !== 'production' ? ['query'] : undefined,
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

// D1 direct query helper for Cloudflare Workers.
// Falls back to Prisma in local dev.
type D1Result = { results?: Record<string, unknown>[]; success: boolean; meta?: Record<string, unknown> }

export async function d1Query(sql: string, params?: unknown[]): Promise<Record<string, unknown>[]> {
  // In Cloudflare Workers, D1 binding is on globalThis.
  const d1 = (globalThis as Record<string, unknown>).D1_DATABASE as
    | { prepare: (sql: string) => { bind: (...params: unknown[]) => { all: () => Promise<D1Result> }; all: () => Promise<D1Result> } }
    | undefined

  if (d1) {
    try {
      const stmt = params && params.length > 0 ? d1.prepare(sql).bind(...params) : d1.prepare(sql)
      const result = await stmt.all()
      return result.results || []
    } catch (e) {
      console.error('D1 query error:', e)
      return []
    }
  }

  // Local dev fallback: not used (Prisma handles local dev)
  return []
}

export async function d1Exec(sql: string): Promise<boolean> {
  const d1 = (globalThis as Record<string, unknown>).D1_DATABASE as
    | { prepare: (sql: string) => { run: () => Promise<{ success: boolean }> } }
    | undefined

  if (d1) {
    try {
      const result = await d1.prepare(sql).run()
      return result.success
    } catch (e) {
      console.error('D1 exec error:', e)
      return false
    }
  }
  return false
}

// Check if we're on Cloudflare Workers (D1 binding available).
export const isCloudflareWorkers = !!(globalThis as Record<string, unknown>).D1_DATABASE
