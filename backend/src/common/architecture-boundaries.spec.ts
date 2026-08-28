import { readdirSync, readFileSync } from 'fs';
import { basename, join, relative, resolve } from 'path';
import { NotificationType } from '@prisma/client';
import { TOURNAMENT_EVENT_NAMES } from './ports/tournament-event-publisher';

const sourceRoot = resolve(__dirname, '..');
const backendRoot = resolve(sourceRoot, '..');

function productionTypescriptFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return productionTypescriptFiles(path);
    if (!entry.name.endsWith('.ts') || entry.name.endsWith('.spec.ts')) {
      return [];
    }
    return [path];
  });
}

function violations(
  files: string[],
  rules: ReadonlyArray<{ name: string; pattern: RegExp }>,
): string[] {
  return files.flatMap((file) => {
    const source = readFileSync(file, 'utf8');
    return rules
      .filter(({ pattern }) => pattern.test(source))
      .map(({ name }) => `${relative(sourceRoot, file)} imports ${name}`);
  });
}

const productionFiles = productionTypescriptFiles(sourceRoot);
const pureDomainFiles = [
  ...productionTypescriptFiles(join(sourceRoot, 'tournaments', 'domain')),
  ...productionTypescriptFiles(join(sourceRoot, 'teams', 'domain')),
  ...productionTypescriptFiles(join(sourceRoot, 'matches', 'domain')),
  ...productionTypescriptFiles(join(sourceRoot, 'brackets', 'domain')),
  join(sourceRoot, 'common', 'policies', 'tournament-visibility.policy.ts'),
];

describe('backend architecture boundaries', () => {
  it('keeps pure domain code independent from runtime adapters and transport', () => {
    expect(
      violations(pureDomainFiles, [
        { name: 'PrismaService', pattern: /\bPrismaService\b/ },
        { name: 'Nest runtime', pattern: /from ['"]@nestjs\// },
        { name: 'Express', pattern: /from ['"]express['"]/ },
        {
          name: 'Socket.IO',
          pattern:
            /from ['"](?:socket\.io|@nestjs\/websockets|@nestjs\/platform-socket\.io)['"]/,
        },
        { name: 'HTTP DTO', pattern: /from ['"][^'"]*\/dto(?:\/|['"])/ },
        {
          name: 'NotificationService',
          pattern: /\bNotificationService\b/,
        },
        {
          name: 'TournamentEventsService',
          pattern: /\bTournamentEventsService\b/,
        },
      ]),
    ).toEqual([]);
  });

  it('keeps bracket generators persistence and transport independent', () => {
    const generators = productionTypescriptFiles(
      join(sourceRoot, 'brackets', 'generators'),
    );
    expect(
      violations(generators, [
        { name: 'PrismaService', pattern: /\bPrismaService\b/ },
        { name: 'HTTP DTO', pattern: /from ['"][^'"]*\/dto(?:\/|['"])/ },
        { name: 'Socket.IO', pattern: /from ['"]socket\.io['"]/ },
        {
          name: 'NotificationService',
          pattern: /\bNotificationService\b/,
        },
        {
          name: 'TournamentEventsService',
          pattern: /\bTournamentEventsService\b/,
        },
      ]),
    ).toEqual([]);
  });

  it('keeps concrete realtime publication inside adapter wiring', () => {
    const allowed = new Set([
      'tournament-realtime.module.ts',
      'tournament.gateway.ts',
    ]);
    const invalid = productionFiles.filter((file) => {
      const source = readFileSync(file, 'utf8');
      return (
        /from ['"][^'"]*tournament-events\.service['"]/.test(source) &&
        !allowed.has(basename(file))
      );
    });
    expect(invalid.map((file) => relative(sourceRoot, file))).toEqual([]);
  });

  it('keeps concrete notification production inside its adapter', () => {
    const allowed = new Set([
      'notification.controller.ts',
      'notification.module.ts',
    ]);
    const invalid = productionFiles.filter((file) => {
      const source = readFileSync(file, 'utf8');
      return (
        /from ['"][^'"]*notification\.service['"]/.test(source) &&
        !allowed.has(basename(file))
      );
    });
    expect(invalid.map((file) => relative(sourceRoot, file))).toEqual([]);
  });

  it('does not make publisher dependencies optional', () => {
    const publisherConsumers = productionFiles.filter((file) =>
      /(?:NotificationPublisher|TournamentEventPublisher)/.test(
        readFileSync(file, 'utf8'),
      ),
    );
    expect(
      publisherConsumers.filter((file) =>
        /@Optional\s*\(/.test(readFileSync(file, 'utf8')),
      ),
    ).toEqual([]);
  });

  it('does not introduce forwardRef into production source', () => {
    expect(
      productionFiles.filter((file) =>
        /\bforwardRef\s*\(/.test(readFileSync(file, 'utf8')),
      ),
    ).toEqual([]);
  });

  it('keeps notification and realtime modules explicit rather than global', () => {
    for (const modulePath of [
      join(sourceRoot, 'notifications', 'notification.module.ts'),
      join(sourceRoot, 'tournaments', 'tournament-realtime.module.ts'),
    ]) {
      expect(readFileSync(modulePath, 'utf8')).not.toMatch(/@Global\s*\(/);
    }
  });

  it('keeps strict TypeScript enabled without permissive overrides', () => {
    const config = JSON.parse(
      readFileSync(join(backendRoot, 'tsconfig.json'), 'utf8'),
    ) as { compilerOptions?: Record<string, unknown> };
    expect(config.compilerOptions?.strict).toBe(true);
    expect(config.compilerOptions?.noImplicitAny).not.toBe(false);
    expect(config.compilerOptions?.strictBindCallApply).not.toBe(false);
  });

  it('freezes canonical realtime and notification enum values', () => {
    expect([...TOURNAMENT_EVENT_NAMES]).toEqual([
      'matchUpdated',
      'scheduleUpdated',
      'bracketGenerated',
      'teamApproved',
      'newComment',
      'standingsUpdated',
    ]);
    expect(Object.values(NotificationType)).toEqual([
      'SCHEDULE_CHANGE',
      'SCORE_UPDATE',
      'TEAM_REGISTERED',
      'TEAM_APPROVED',
      'TEAM_REJECTED',
      'TOURNAMENT_STATUS',
      'REPORT_THRESHOLD',
      'ADMIN_WARNING',
      'COMMENT_REPLY',
      'SYSTEM',
    ]);
  });
});
