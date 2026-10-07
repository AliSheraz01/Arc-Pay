import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'

const dbUrl = process.env.DATABASE_URL || 'libsql://easyzpay-alisheraz.aws-ap-south-1.turso.io'
const authToken = process.env.TURSO_AUTH_TOKEN || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3OTA5NTg3NDksImlkIjoiMDE5ZjRkNGItYmYwMS03N2UxLTk2YjUtMDNjZjRmNzYxMzBiIiwia2lkIjoiaEZCZ25GcjBjM3Z5b0NqSm9lMm95Z3ZyZ1h5U3V3WmRFbzE2R3prWXJHVSIsInJpZCI6IjI5N2YyMTNkLWRhNjUtNDA5Zi1hYWRkLTEzMDQ2ODA1MWY4MiJ9.LecOBOYZfglmZWVNPtTPgTgLMQ90YlJ3lfYr6M7yiLAclt0lAb1wwpwQeMYfsc785n-LFenmyZ4OwS2LYqVvDg'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

function createPrismaClient() {
  const adapter = new PrismaLibSql({
    url: dbUrl,
    authToken,
  })
  return new PrismaClient({ adapter })
}

export const db = globalForPrisma.prisma || createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
