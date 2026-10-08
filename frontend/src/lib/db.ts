// SERVER-ONLY. Turso credentials are read from server env vars and must never
// be exposed via NEXT_PUBLIC_ variables.
import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function createPrismaClient(): PrismaClient {
  const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL || 'libsql://easyzpay-alisheraz.aws-ap-south-1.turso.io'
  const authToken = process.env.TURSO_AUTH_TOKEN || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3OTA5NTg3NDksImlkIjoiMDE5ZjRkNGItYmYwMS03N2UxLTk2YjUtMDNjZjRmNzYxMzBiIiwia2lkIjoiaEZCZ25GcjBjM3Z5b0NqSm9lMm95Z3ZyZ1h5U3V3WmRFbzE2R3prWXJHVSIsInJpZCI6IjI5N2YyMTNkLWRhNjUtNDA5Zi1hYWRkLTEzMDQ2ODA1MWY4MiJ9.LecOBOYZfglmZWVNPtTPgTgLMQ90YlJ3lfYr6M7yiLAclt0lAb1wwpwQeMYfsc785n-LFenmyZ4OwS2LYqVvDg'
  if (!url) {
    throw new Error('[DB] TURSO_DATABASE_URL is not set (server env var)')
  }
  const adapter = new PrismaLibSql({ url, authToken })
  return new PrismaClient({ adapter })
}

function getClient(): PrismaClient {
  if (!globalForPrisma.prisma) globalForPrisma.prisma = createPrismaClient()
  return globalForPrisma.prisma
}

// Lazy proxy: the client is only created on first use (at request time),
// so `next build` never needs database credentials.
export const db = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getClient() as any
    const value = client[prop]
    return typeof value === 'function' ? value.bind(client) : value
  },
})
