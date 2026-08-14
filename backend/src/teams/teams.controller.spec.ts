/* eslint-disable @typescript-eslint/unbound-method */
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { VISIBILITY_RESOURCE_KEY } from '../common/decorators/visibility.decorator';
import { VisibilityGuard } from '../common/guards/visibility.guard';
import { TEAM_ACCESS_KEY, TeamAccessGuard } from './guards/team-access.guard';
import { TeamsController } from './teams.controller';

describe('TeamsController visibility', () => {
  it.each([
    ['findByTournament', 'slug:slug'],
    ['findOne', 'team:id'],
  ] as const)(
    'protects %s with optional authentication and parent tournament visibility',
    (methodName, resource) => {
      const method = TeamsController.prototype[methodName];

      expect(Reflect.getMetadata(GUARDS_METADATA, method)).toEqual([
        OptionalJwtAuthGuard,
        VisibilityGuard,
      ]);
      expect(Reflect.getMetadata(VISIBILITY_RESOURCE_KEY, method)).toBe(
        resource,
      );
    },
  );

  it.each(['update', 'addMember', 'updateMember', 'removeMember'] as const)(
    'protects %s with JWT and captain-or-organizer access',
    (methodName) => {
      const method = TeamsController.prototype[methodName];

      expect(Reflect.getMetadata(GUARDS_METADATA, method)).toEqual([
        JwtAuthGuard,
        TeamAccessGuard,
      ]);
      expect(Reflect.getMetadata(TEAM_ACCESS_KEY, method)).toBe(
        'CAPTAIN_OR_ORGANIZER',
      );
    },
  );
});
