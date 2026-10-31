import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  // Cloudflare Workers: use D1 binding if available.
  // Dynamic import to avoid build-time type issues with the adapter.
  const d1Binding = (globalThis as Record<string, unknown>).D1_DATABASE
  if (d1Binding) {
    try {
      const mod = eval("require('@prisma/adapter-d1')")
      const adapter = new mod.PrismaD1(d1Binding)
      return new PrismaClient({ adapter })
    } catch {
      return new PrismaClient()
    }
  }

  // Local dev: SQLite via DATABASE_URL
  return new PrismaClient({
    log: process.env.NODE_ENV !== 'production' ? ['query'] : undefined,
  })
}

export const db =
  globalForPrisma.prisma ??
  createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
