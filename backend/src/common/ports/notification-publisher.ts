import { NotificationType, Prisma } from '@prisma/client';

export const NOTIFICATION_PUBLISHER = Symbol('NOTIFICATION_PUBLISHER');

export type NotificationTransactionClient = Pick<
  Prisma.TransactionClient,
  'notification'
>;

export type NotificationData = Prisma.InputJsonObject;

export interface NotificationInput {
  type: NotificationType;
  content: string;
  data?: NotificationData;
  tournamentId?: string | null;
  sourceKey?: string;
}

export interface NotificationPublisher {
  createNotification(
    data: NotificationInput & {
      userId: string;
    },
    client?: NotificationTransactionClient,
    emit?: boolean,
  ): Promise<Prisma.NotificationGetPayload<object>>;
  createForUsers(
    data: NotificationInput & { userIds: Array<string | null | undefined> },
    client?: NotificationTransactionClient,
    emit?: boolean,
  ): Promise<Prisma.NotificationGetPayload<object>[]>;
  createForMatchEvent(
    data: NotificationInput & {
      tournamentId: string;
      teamIds: Array<string | null | undefined>;
      sourceKey: string;
    },
  ): Promise<unknown>;
  createForTournamentEvent(
    data: NotificationInput & {
      tournamentId: string;
      sourceKey: string;
    },
  ): Promise<unknown>;
  emitCreated(notification: Prisma.NotificationGetPayload<object>): void;
}

export const NOOP_NOTIFICATION_PUBLISHER: NotificationPublisher = {
  createNotification: () =>
    Promise.resolve({} as Prisma.NotificationGetPayload<object>),
  createForUsers: () => Promise.resolve([]),
  createForMatchEvent: () => Promise.resolve(undefined),
  createForTournamentEvent: () => Promise.resolve(undefined),
  emitCreated: () => undefined,
};
