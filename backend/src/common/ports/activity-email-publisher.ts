import { NotificationType, Prisma, RegistrationStatus } from '@prisma/client';

export type ActivityEmailEvent =
  | {
      kind: 'NOTIFICATION_CREATED';
      notification: {
        userId: string;
        type: NotificationType;
        data: Prisma.JsonValue | null;
        tournamentId: string | null;
      };
    }
  | {
      kind: 'TEAM_REGISTRATION_SUCCEEDED';
      userId: string;
      tournamentId: string;
      teamName: string;
      status: RegistrationStatus;
    }
  | {
      kind: 'ACCOUNT_LOCK_CHANGED';
      userId: string;
      isLocked: boolean;
    };

export interface ActivityEmailPublisher {
  publish(event: ActivityEmailEvent): Promise<void>;
}

export const ACTIVITY_EMAIL_PUBLISHER = Symbol('ACTIVITY_EMAIL_PUBLISHER');

export const NOOP_ACTIVITY_EMAIL_PUBLISHER: ActivityEmailPublisher = {
  publish: () => Promise.resolve(),
};
