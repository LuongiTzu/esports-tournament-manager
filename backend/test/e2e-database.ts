import { resolve } from 'node:path';
import { config } from 'dotenv';

export function configureE2EDatabase(): string | null {
  if (process.env.RUN_DATABASE_E2E !== 'true') return null;

  config({ path: resolve(__dirname, '../.env'), quiet: true });

  const databaseUrl = process.env.E2E_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      'RUN_DATABASE_E2E=true requires E2E_DATABASE_URL. Refusing to use the application DATABASE_URL.',
    );
  }

  const parsedUrl = new URL(databaseUrl);
  const databaseName = parsedUrl.pathname.replace(/^\//, '').toLowerCase();
  const schemaName = parsedUrl.searchParams.get('schema')?.toLowerCase() ?? '';
  const hasIsolationMarker = [databaseName, schemaName].some((value) =>
    /(^|[_-])(test|e2e)([_-]|$)/.test(value),
  );

  if (!hasIsolationMarker) {
    throw new Error(
      'E2E_DATABASE_URL must target a database or schema whose name contains a standalone "test" or "e2e" marker.',
    );
  }

  process.env.DATABASE_URL = databaseUrl;
  return databaseUrl;
}
