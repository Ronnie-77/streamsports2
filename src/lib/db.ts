import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  // Cloudflare Workers: D1 binding is available as env var.
  // Local dev: standard SQLite via DATABASE_URL.
  const d1Binding = (globalThis as Record<string, unknown>).D1_DATABASE
  if (d1Binding) {
    try {
      // Dynamic eval to avoid build-time module resolution.
      const adapterModule = eval("require('@prisma/adapter-d1')")
      const adapter = new adapterModule.PrismaD1(d1Binding)
      return new PrismaClient({ adapter })
    } catch {
      return new PrismaClient()
    }
  }

  return new PrismaClient({
    log: process.env.NODE_ENV !== 'production' ? ['query'] : undefined,
  })
}

export const db =
  globalForPrisma.prisma ??
  createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
