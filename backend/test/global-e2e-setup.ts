import { PrismaClient } from '@prisma/client';
import { syncGameCatalog } from '../src/games/sync-game-catalog';
import { configureE2EDatabase } from './e2e-database';

export default async function globalE2ESetup(): Promise<void> {
  if (!configureE2EDatabase()) {
    throw new Error(
      'Database E2E is disabled. Set RUN_DATABASE_E2E=true and E2E_DATABASE_URL to an isolated test database.',
    );
  }

  const prisma = new PrismaClient();
  try {
    await syncGameCatalog(prisma);
  } finally {
    await prisma.$disconnect();
  }
}
