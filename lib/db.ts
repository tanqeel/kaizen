import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  const url = process.env.DATABASE_URL ?? '';
  // Production (Neon Postgres over serverless): use the Neon HTTP/WebSocket
  // driver adapter instead of a raw TCP connection. On Vercel each page is its
  // own lambda, so every cold start used to pay a ~1.7s TLS+connect handshake
  // to the Singapore DB region before the first query could run. The adapter
  // issues queries over HTTP/WebSocket with no connection handshake, which
  // permanently removes that cold-start penalty in code (no keep-warm needed).
  // Local dev (SQLite file) keeps the plain client.
  if (url.startsWith('postgres')) {
    // Lazy-require so local SQLite dev never loads the Neon driver.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaNeon } = require('@prisma/adapter-neon') as typeof import('@prisma/adapter-neon');
    return new PrismaClient({ adapter: new PrismaNeon({ connectionString: url }) });
  }
  return new PrismaClient();
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
