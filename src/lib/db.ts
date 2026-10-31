import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Standard PrismaClient — works with SQLite (dev) and D1 (production
// via DATABASE_URL env var set in Cloudflare Dashboard).
export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV !== 'production' ? ['query'] : undefined,
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
