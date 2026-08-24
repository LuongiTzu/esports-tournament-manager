import { ModerationStatus, Role, Visibility } from '@prisma/client';

export interface TournamentAccessContext {
  visibility: Visibility;
  moderationStatus: ModerationStatus;
  organizerId: string;
  user?: { id: string; role: Role | string } | null;
  isRelatedParticipant?: boolean;
}

export class TournamentVisibilityPolicy {
  canView(context: TournamentAccessContext): boolean {
    const isOrganizer = context.user?.id === context.organizerId;
    const isAdmin = context.user?.role === Role.ADMIN;

    if (context.moderationStatus === ModerationStatus.HIDDEN_BY_ADMIN) {
      return Boolean(isOrganizer || isAdmin);
    }

    if (context.visibility === Visibility.PUBLIC) {
      return true;
    }

    return Boolean(
      context.user && (isOrganizer || isAdmin || context.isRelatedParticipant),
    );
  }
}

export const tournamentVisibilityPolicy = new TournamentVisibilityPolicy();
