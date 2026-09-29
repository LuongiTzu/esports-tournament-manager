import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { syncGameCatalog } from '../src/games/sync-game-catalog';

const SMOKE_PASSWORD = 'SmokePass123!';
const BCRYPT_ROUNDS = 10;

const smokeUsers = [
  {
    id: 'smoke-admin',
    email: 'smoke-admin@e2e.test',
    displayName: 'Smoke Admin',
    role: Role.ADMIN,
  },
  {
    id: 'smoke-organizer',
    email: 'smoke-organizer@e2e.test',
    displayName: 'Smoke Organizer',
    role: Role.SIGNED_UP_USER,
  },
  {
    id: 'smoke-participant',
    email: 'smoke-participant@e2e.test',
    displayName: 'Smoke Participant',
    role: Role.SIGNED_UP_USER,
  },
] as const;

function isolatedDatabaseUrl(): string {
  if (process.env.RUN_UI_E2E !== 'true') {
    throw new Error('RUN_UI_E2E=true is required for the UI smoke seed.');
  }

  const value = process.env.E2E_DATABASE_URL;
  if (!value) throw new Error('E2E_DATABASE_URL is required.');

  const parsed = new URL(value);
  const identity = `${parsed.pathname}/${parsed.searchParams.get('schema') ?? ''}`;
  if (!/(^|[-_/])(e2e|test)([-_/]|$)/i.test(identity)) {
    throw new Error(
      'E2E_DATABASE_URL must identify an isolated database or schema containing an e2e/test marker.',
    );
  }
  return value;
}

async function main(): Promise<void> {
  process.env.DATABASE_URL = isolatedDatabaseUrl();
  const prisma = new PrismaClient();
  try {
    await prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "users", "games", "banned_keywords" RESTART IDENTITY CASCADE',
    );
    await syncGameCatalog(prisma);

    const passwordHash = await bcrypt.hash(SMOKE_PASSWORD, BCRYPT_ROUNDS);
    await prisma.user.createMany({
      data: smokeUsers.map((user) => ({
        ...user,
        passwordHash,
        emailVerifiedAt: new Date(),
      })),
    });
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error('UI smoke seed failed.', error);
  process.exitCode = 1;
});
