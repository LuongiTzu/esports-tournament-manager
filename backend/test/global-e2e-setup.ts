import { PrismaClient } from '@prisma/client';
import { syncGameCatalog } from '../src/games/sync-game-catalog';
import { configureE2EDatabase } from './e2e-database';

export default async function globalE2ESetup(): Promise<void> {
  if (!configureE2EDatabase()) return;

  const prisma = new PrismaClient();
  try {
    await syncGameCatalog(prisma);
  } finally {
    await prisma.$disconnect();
  }
}
