import { NotificationType, Prisma } from '@prisma/client';

export const NOTIFICATION_PUBLISHER = Symbol('NOTIFICATION_PUBLISHER');

export type NotificationTransactionClient = Pick<
  Prisma.TransactionClient,
  'notification'
>;

export interface NotificationPublisher {
  createNotification(
    data: {
      userId: string;
      type: NotificationType;
      content: string;
      tournamentId?: string | null;
    },
    client?: NotificationTransactionClient,
    emit?: boolean,
  ): Promise<Prisma.NotificationGetPayload<object>>;
  createForTournamentEvent(data: {
    tournamentId: string;
    type: NotificationType;
    content: string;
    sourceKey: string;
  }): Promise<unknown>;
  emitCreated(notification: Prisma.NotificationGetPayload<object>): void;
}

export const NOOP_NOTIFICATION_PUBLISHER: NotificationPublisher = {
  createNotification: async () => ({}) as Prisma.NotificationGetPayload<object>,
  createForTournamentEvent: async () => undefined,
  emitCreated: () => undefined,
};
