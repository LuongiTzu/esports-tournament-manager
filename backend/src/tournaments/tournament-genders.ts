import { Gender } from '@prisma/client';

export interface TournamentGenderRelations {
  genderRestrictionEnabled: boolean;
  allowedGenders: Array<{ gender: Gender; orderIndex: number }>;
}

export function allowedGenderValues(tournament: TournamentGenderRelations) {
  return tournament.genderRestrictionEnabled
    ? tournament.allowedGenders
        .slice()
        .sort((left, right) => left.orderIndex - right.orderIndex)
        .map(({ gender }) => gender)
    : null;
}

export function withAllowedGenders<T extends TournamentGenderRelations>(
  tournament: T,
) {
  const { genderRestrictionEnabled, allowedGenders, ...rest } = tournament;
  return {
    ...rest,
    allowedGenders: allowedGenderValues({
      genderRestrictionEnabled,
      allowedGenders,
    }),
  };
}
