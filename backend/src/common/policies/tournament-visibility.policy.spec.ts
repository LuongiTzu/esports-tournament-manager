import { ModerationStatus, Role, Visibility } from '@prisma/client';
import { tournamentVisibilityPolicy } from './tournament-visibility.policy';

const tournament = {
  organizerId: 'organizer',
  visibility: Visibility.PUBLIC,
  moderationStatus: ModerationStatus.ACTIVE,
};

describe('TournamentVisibilityPolicy', () => {
  it.each([
    ['anonymous', undefined],
    ['unrelated user', { id: 'other', role: Role.SIGNED_UP_USER }],
    ['organizer', { id: 'organizer', role: Role.SIGNED_UP_USER }],
    ['admin', { id: 'admin', role: Role.ADMIN }],
  ] as const)(
    'allows %s to view a public active tournament',
    (_actor, user) => {
      expect(tournamentVisibilityPolicy.canView({ ...tournament, user })).toBe(
        true,
      );
    },
  );

  it.each([
    ['anonymous', undefined, false],
    ['unrelated user', { id: 'other', role: Role.SIGNED_UP_USER }, false],
    ['organizer', { id: 'organizer', role: Role.SIGNED_UP_USER }, false],
    ['admin', { id: 'admin', role: Role.ADMIN }, false],
    ['captain/member', { id: 'member', role: Role.SIGNED_UP_USER }, true],
  ] as const)(
    'applies private visibility for %s',
    (_actor, user, isRelatedParticipant) => {
      expect(
        tournamentVisibilityPolicy.canView({
          ...tournament,
          visibility: Visibility.PRIVATE,
          user,
          isRelatedParticipant,
        }),
      ).toBe(
        Boolean(
          user &&
          (user.id === 'organizer' ||
            user.role === Role.ADMIN ||
            isRelatedParticipant),
        ),
      );
    },
  );

  it.each([
    ['anonymous', undefined, false],
    ['unrelated user', { id: 'other', role: Role.SIGNED_UP_USER }, false],
    ['participant', { id: 'member', role: Role.SIGNED_UP_USER }, false],
    ['organizer', { id: 'organizer', role: Role.SIGNED_UP_USER }, true],
    ['admin', { id: 'admin', role: Role.ADMIN }, true],
  ] as const)('applies hidden moderation for %s', (_actor, user, expected) => {
    expect(
      tournamentVisibilityPolicy.canView({
        ...tournament,
        moderationStatus: ModerationStatus.HIDDEN_BY_ADMIN,
        user,
        isRelatedParticipant: true,
      }),
    ).toBe(expected);
  });
});
