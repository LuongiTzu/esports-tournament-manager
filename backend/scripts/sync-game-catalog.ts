import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve } from 'path';
import { syncGameCatalog } from '../src/games/sync-game-catalog';

const EXPECTED_DATABASE = 'esports_tournament_db';
const EXPECTED_PORT = '5432';
const EXPECTED_SCHEMA = 'public';
const EXPECTED_USERNAME = 'esports_admin';

function assertExpectedLocalDatabase(): void {
  config({ path: resolve(process.cwd(), '.env') });
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Catalog sync is disabled when NODE_ENV is production.');
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is not configured.');

  const target = new URL(databaseUrl);
  const allowedHosts = new Set(['localhost', '127.0.0.1', '::1']);
  const database = decodeURIComponent(target.pathname.replace(/^\/+/, ''));
  const schema = target.searchParams.get('schema') ?? EXPECTED_SCHEMA;
  const username = decodeURIComponent(target.username);

  if (
    !['postgres:', 'postgresql:'].includes(target.protocol) ||
    !allowedHosts.has(target.hostname.toLowerCase()) ||
    (target.port || EXPECTED_PORT) !== EXPECTED_PORT ||
    database !== EXPECTED_DATABASE ||
    schema !== EXPECTED_SCHEMA ||
    username !== EXPECTED_USERNAME
  ) {
    throw new Error(
      'Catalog sync requires the approved local development PostgreSQL database.',
    );
  }
}

async function main(): Promise<void> {
  assertExpectedLocalDatabase();
  const prisma = new PrismaClient();
  try {
    const codes = await syncGameCatalog(prisma);
    console.log(`Synchronized ${codes.length} canonical games by stable code.`);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
