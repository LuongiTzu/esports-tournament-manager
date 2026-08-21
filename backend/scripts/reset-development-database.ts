import { execFileSync, spawnSync } from 'child_process';
import { config } from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';

const EXPECTED_DATABASE = 'esports_tournament_db';
const EXPECTED_SCHEMA = 'public';
const EXPECTED_PORT = '5432';
const EXPECTED_COMPOSE_SERVICE = 'postgres';
const EXPECTED_CONTAINER = 'esports-postgres';
const RESET_CONFIRMATION = 'RESET_LOCAL_ESPORTS_DEV_DB';

type GuardMode = '--check' | '--execute';

interface DatabaseTarget {
  host: string;
  port: string;
  database: string;
  schema: string;
  username: string;
}

interface ComposeConfig {
  services?: Record<
    string,
    {
      container_name?: string;
      environment?: Record<string, string>;
      volumes?: Array<{ target?: string; type?: string }>;
    }
  >;
}

function fail(message: string): never {
  console.error(`Development reset guard refused to continue: ${message}`);
  process.exit(1);
}

function readDatabaseTarget(): DatabaseTarget {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    fail('DATABASE_URL is not configured.');
  }

  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    fail('DATABASE_URL is invalid.');
  }

  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    fail('DATABASE_URL is not PostgreSQL.');
  }

  return {
    host: parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase(),
    port: parsed.port || EXPECTED_PORT,
    database: decodeURIComponent(parsed.pathname.replace(/^\/+/, '')),
    schema: parsed.searchParams.get('schema') || EXPECTED_SCHEMA,
    username: decodeURIComponent(parsed.username),
  };
}

function runDockerCompose(repositoryRoot: string, args: string[]): string {
  const dockerCommand = process.platform === 'win32' ? 'docker.exe' : 'docker';

  try {
    return execFileSync(dockerCommand, ['compose', ...args], {
      cwd: repositoryRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch {
    fail('the repository Docker Compose project could not be inspected.');
  }
}

function verifyComposeTarget(
  repositoryRoot: string,
  target: DatabaseTarget,
): void {
  const runningServices = runDockerCompose(repositoryRoot, [
    'ps',
    '--services',
    '--status',
    'running',
  ]).split(/\r?\n/);
  if (!runningServices.includes(EXPECTED_COMPOSE_SERVICE)) {
    fail('the local PostgreSQL Compose service is not running.');
  }

  const publishedPort = runDockerCompose(repositoryRoot, [
    'port',
    EXPECTED_COMPOSE_SERVICE,
    EXPECTED_PORT,
  ]);
  const publishedPortMatch = publishedPort.match(/:(\d+)$/);
  if (!publishedPortMatch || publishedPortMatch[1] !== target.port) {
    fail('DATABASE_URL does not use the PostgreSQL port published by Compose.');
  }

  let composeConfig: ComposeConfig;
  try {
    composeConfig = JSON.parse(
      runDockerCompose(repositoryRoot, ['config', '--format', 'json']),
    ) as ComposeConfig;
  } catch {
    fail('the repository Docker Compose configuration is invalid.');
  }

  const postgresService = composeConfig.services?.[EXPECTED_COMPOSE_SERVICE];
  if (!postgresService) {
    fail('the expected PostgreSQL Compose service is missing.');
  }
  if (postgresService.container_name !== EXPECTED_CONTAINER) {
    fail(
      'the running PostgreSQL container is not the expected project container.',
    );
  }
  if (postgresService.environment?.POSTGRES_DB !== target.database) {
    fail('DATABASE_URL does not target the database configured by Compose.');
  }
  if (postgresService.environment?.POSTGRES_USER !== target.username) {
    fail(
      'DATABASE_URL does not use the PostgreSQL user configured by Compose.',
    );
  }

  const hasPersistentDataVolume = postgresService.volumes?.some(
    (volume) =>
      volume.type === 'volume' && volume.target === '/var/lib/postgresql/data',
  );
  if (!hasPersistentDataVolume) {
    fail(
      'the PostgreSQL service does not use the expected persistent data volume.',
    );
  }
}

function main(): void {
  const mode = process.argv[2] as GuardMode | undefined;
  if (mode !== '--check' && mode !== '--execute') {
    fail('use --check or --execute.');
  }

  const backendRoot = process.cwd();
  const repositoryRoot = resolve(backendRoot, '..');
  if (!existsSync(resolve(backendRoot, 'prisma', 'schema.prisma'))) {
    fail('run this command from the backend package directory.');
  }

  config({ path: resolve(backendRoot, '.env') });
  if (process.env.NODE_ENV === 'production') {
    fail('NODE_ENV is production.');
  }

  const target = readDatabaseTarget();
  const allowedHosts = new Set(['localhost', '127.0.0.1', '::1']);
  if (!allowedHosts.has(target.host)) {
    fail('DATABASE_URL is not a loopback-only target.');
  }
  if (
    target.port !== EXPECTED_PORT ||
    target.database !== EXPECTED_DATABASE ||
    target.schema !== EXPECTED_SCHEMA
  ) {
    fail(
      'DATABASE_URL does not match the approved local development identity.',
    );
  }

  verifyComposeTarget(repositoryRoot, target);
  console.log(
    `Verified local development database: ${target.host}:${target.port}/${target.database} (schema ${target.schema}), Compose service ${EXPECTED_COMPOSE_SERVICE}, container ${EXPECTED_CONTAINER}.`,
  );

  if (mode === '--check') {
    return;
  }
  if (process.env.CONFIRM_DEV_DB_RESET !== RESET_CONFIRMATION) {
    fail(
      `set CONFIRM_DEV_DB_RESET=${RESET_CONFIRMATION} for an explicitly authorized reset.`,
    );
  }

  const prismaArguments = process.argv.slice(3);
  if (!prismaArguments.includes('--force')) {
    fail('the guarded reset must include --force.');
  }

  const prismaCli = resolve(
    backendRoot,
    'node_modules',
    'prisma',
    'build',
    'index.js',
  );
  const result = spawnSync(
    process.execPath,
    [prismaCli, 'migrate', 'reset', ...prismaArguments],
    {
      cwd: backendRoot,
      env: process.env,
      stdio: 'inherit',
    },
  );
  if (result.error) {
    fail('Prisma could not be started.');
  }
  process.exit(result.status ?? 1);
}

main();
