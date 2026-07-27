import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    adapter,
  });
}

function resolvePrismaClient(): PrismaClient {
  const existing = globalForPrisma.prisma;
  // Dev HMR can keep a singleton built from a stale generated client.
  if (existing && typeof (existing as { careerBrief?: unknown }).careerBrief === "undefined") {
    return createPrismaClient();
  }
  return existing ?? createPrismaClient();
}

export const prisma = resolvePrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}