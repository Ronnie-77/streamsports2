import { PrismaClient } from '@prisma/client'
import { PrismaD1 } from '@prisma/adapter-d1'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  // Cloudflare Workers: D1 binding is available via globalThis.
  const d1Binding = (globalThis as Record<string, unknown>).D1_DATABASE
  if (d1Binding) {
    try {
      const adapter = new PrismaD1(d1Binding as ConstructorParameters<typeof PrismaD1>[0])
      return new PrismaClient({ adapter })
    } catch (e) {
      console.error('D1 adapter init failed:', e)
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
