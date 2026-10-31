import { PrismaClient } from '@prisma/client'
import { PrismaD1 } from '@prisma/adapter-d1'

// Cloudflare Workers: use D1 binding if available, fall back to SQLite for dev.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  // In Cloudflare Workers, the D1 binding is available on the env.
  // In dev, we use SQLite via DATABASE_URL.
  if (process.env.D1_DATABASE) {
    // Cloudflare D1 via binding (set by wrangler.jsonc d1_databases)
    // @ts-expect-error - D1Database is a Cloudflare type
    const adapter = new PrismaD1(process.env.D1_DATABASE)
    return new PrismaClient({ adapter })
  }

  // Local dev: SQLite
  return new PrismaClient({
    log: ['query'],
  })
}

export const db =
  globalForPrisma.prisma ??
  createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
