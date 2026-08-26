import { GamePositionMode, Gender } from '@prisma/client';

export interface RegistrationError {
  field: string;
  memberIndex: number | null;
  message: string;
}

export interface RegistrationRules {
  tournamentId: string;
  minTeamSize: number;
  maxTeamSize: number;
  minAge: number | null;
  maxAge: number | null;
  allowedGenders: Gender[] | null;
  requireMemberFullInfo: boolean;
  startDate: Date | null;
  positions: string[];
  positionMode: GamePositionMode;
}
