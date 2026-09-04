import { ConflictException, Injectable } from '@nestjs/common';
import {
  MatchActivationCondition,
  MatchOutcome,
  MatchSlot,
  MatchStatus,
  Prisma,
  RoundFormat,
  RoundStatus,
  TournamentStatus,
} from '@prisma/client';
import type {
  ResultMatch,
  MatchTransactionClient,
} from './match-result.service';
import { ApplicationErrorCode } from '../common/errors/application-error-code';

/**
 * Competition-owned progression invoked inside the Match result transaction.
 * It never opens its own transaction: correction and progression stay atomic.
 */
@Injectable()
export class CompetitionProgressionService {
  async rollbackPreviousAdvancement(
    tx: MatchTransactionClient,
    match: ResultMatch,
    newWinnerTeamId: string | null,
    newStatus: MatchStatus,
    resultChanged: boolean,
  ) {
    if (!resultChanged) return;
    await this.rollbackInterRoundAdvancement(tx, match);
    if (
      newStatus === MatchStatus.COMPLETED &&
      newWinnerTeamId === match.winnerTeamId
    ) {
      return;
    }
    const oldWinner = match.winnerTeamId;
    const oldLoser =
      oldWinner === match.teamAId ? match.teamBId : match.teamAId;
    if (await this.rollbackConditionalReset(tx, match)) {
      await this.rollbackEliminationCompletion(tx, match, oldWinner);
      return;
    }
    const routes = [
      { id: match.nextMatchId, slot: match.nextMatchSlot, teamId: oldWinner },
      {
        id: match.loserNextMatchId,
        slot: match.loserNextMatchSlot,
        teamId: oldLoser,
      },
    ].filter(
      (route): route is { id: string; slot: MatchSlot; teamId: string } =>
        Boolean(route.id && route.slot && route.teamId),
    );
    const downstream = await Promise.all(
      [...new Set(routes.map((route) => route.id))].map((id) =>
        tx.match.findUnique({
          where: { id },
          select: { id: true, status: true, teamAId: true, teamBId: true },
        }),
      ),
    );
    if (downstream.some((item) => item?.status === MatchStatus.COMPLETED)) {
      throw new ConflictException(
        'Downstream match is completed; reset it before changing this result',
      );
    }
    for (const route of routes) {
      const target = downstream.find((item) => item?.id === route.id)!;
      const field = route.slot === MatchSlot.A ? 'teamAId' : 'teamBId';
      if (target[field] !== route.teamId) {
        throw new ConflictException(
          'Downstream slot no longer contains the previously advanced team',
        );
      }
      await tx.match.update({
        where: { id: route.id },
        data: { [field]: null },
      });
      target[field] = null;
    }
    await this.rollbackEliminationCompletion(tx, match, oldWinner);
  }

  private async rollbackInterRoundAdvancement(
    tx: MatchTransactionClient,
    match: ResultMatch,
  ): Promise<void> {
    const outgoing = await tx.roundTeam.findMany({
      where: { advancedFromRoundId: match.round.id },
      select: { roundId: true },
    });
    if (outgoing.length === 0) return;

    const targetRoundIds = [
      ...new Set(outgoing.map(({ roundId }) => roundId)),
    ].sort();
    for (const targetRoundId of targetRoundIds) {
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "rounds" WHERE "id" = ${targetRoundId} FOR UPDATE`,
      );
    }
    const targets = await Promise.all(
      targetRoundIds.map((id) =>
        tx.round.findUnique({
          where: { id },
          select: {
            id: true,
            tournamentId: true,
            _count: { select: { groups: true, matches: true } },
          },
        }),
      ),
    );
    if (
      targets.some(
        (target) => !target || target.tournamentId !== match.round.tournamentId,
      )
    ) {
      throw new ConflictException({
        code: ApplicationErrorCode.ROUND_ADVANCEMENT_TARGET_INVALID,
        message: 'Persisted Round advancement target is invalid',
      });
    }
    if (
      targets.some(
        (target) => target!._count.groups > 0 || target!._count.matches > 0,
      )
    ) {
      throw new ConflictException({
        code: ApplicationErrorCode.UPSTREAM_RESULT_LOCKED_BY_DOWNSTREAM_STRUCTURE,
        message:
          'Cannot change this result after the next Round structure is generated',
      });
    }

    await tx.roundTeam.deleteMany({
      where: { advancedFromRoundId: match.round.id },
    });
  }

  async advanceResult(
    tx: MatchTransactionClient,
    match: ResultMatch,
    winnerTeamId: string,
  ) {
    const loserTeamId =
      winnerTeamId === match.teamAId ? match.teamBId : match.teamAId;
    if (
      await this.processConditionalReset(tx, match, winnerTeamId, loserTeamId)
    ) {
      return;
    }
    await this.placeTeam(
      tx,
      match.nextMatchId,
      match.nextMatchSlot,
      winnerTeamId,
    );
    await this.placeTeam(
      tx,
      match.loserNextMatchId,
      match.loserNextMatchSlot,
      loserTeamId,
    );
  }

  private async processConditionalReset(
    tx: MatchTransactionClient,
    match: ResultMatch,
    winnerTeamId: string,
    loserTeamId: string | null,
  ): Promise<boolean> {
    if (!match.nextMatchId || match.nextMatchId !== match.loserNextMatchId)
      return false;
    const reset = await tx.match.findUnique({
      where: { id: match.nextMatchId },
      select: {
        id: true,
        teamAId: true,
        teamBId: true,
        status: true,
        isActive: true,
        activationCondition: true,
      },
    });
    if (
      !reset ||
      reset.activationCondition !==
        MatchActivationCondition.LOSER_BRACKET_CHAMPION_WINS_GRAND_FINAL
    )
      return false;
    if (!loserTeamId)
      throw new ConflictException('Grand Final loser is missing');
    if (winnerTeamId !== match.teamBId) return true;
    if (reset.status === MatchStatus.COMPLETED) {
      if (
        reset.isActive &&
        reset.teamAId === winnerTeamId &&
        reset.teamBId === loserTeamId
      )
        return true;
      throw new ConflictException('Grand Final Reset is already completed');
    }
    if (
      (reset.teamAId !== null && reset.teamAId !== winnerTeamId) ||
      (reset.teamBId !== null && reset.teamBId !== loserTeamId)
    )
      throw new ConflictException(
        'Grand Final Reset slots are already occupied',
      );
    if (
      !reset.isActive ||
      reset.teamAId !== winnerTeamId ||
      reset.teamBId !== loserTeamId
    ) {
      await tx.match.update({
        where: { id: reset.id },
        data: { isActive: true, teamAId: winnerTeamId, teamBId: loserTeamId },
      });
    }
    return true;
  }

  private async rollbackConditionalReset(
    tx: MatchTransactionClient,
    match: ResultMatch,
  ): Promise<boolean> {
    if (!match.nextMatchId || match.nextMatchId !== match.loserNextMatchId)
      return false;
    const reset = await tx.match.findUnique({
      where: { id: match.nextMatchId },
      select: {
        id: true,
        status: true,
        scoreA: true,
        scoreB: true,
        winnerTeamId: true,
        playedAt: true,
        activationCondition: true,
        _count: { select: { scores: true } },
      },
    });
    if (
      !reset ||
      reset.activationCondition !==
        MatchActivationCondition.LOSER_BRACKET_CHAMPION_WINS_GRAND_FINAL
    )
      return false;
    if (
      reset.status !== MatchStatus.PENDING ||
      reset.scoreA !== 0 ||
      reset.scoreB !== 0 ||
      reset.winnerTeamId !== null ||
      reset.playedAt !== null ||
      reset._count.scores > 0
    ) {
      throw new ConflictException(
        'Grand Final Reset has started; reset it before changing the Grand Final',
      );
    }
    await tx.match.update({
      where: { id: reset.id },
      data: { isActive: false, teamAId: null, teamBId: null },
    });
    return true;
  }

  async completeEliminationIfReady(
    tx: MatchTransactionClient,
    match: ResultMatch,
  ) {
    if (
      match.round.format !== RoundFormat.PLAYOFF &&
      match.round.format !== RoundFormat.DOUBLE_ELIM
    )
      return;
    const matches = await tx.match.findMany({
      where: { roundId: match.round.id },
      select: {
        status: true,
        isActive: true,
        bracketType: true,
        bracketRound: true,
        matchNumber: true,
        winnerTeamId: true,
      },
    });
    const required = matches.filter((candidate) => candidate.isActive);
    if (
      !required.length ||
      required.some((candidate) => candidate.status !== MatchStatus.COMPLETED)
    )
      return;
    const championship = required
      .filter(
        (candidate) =>
          candidate.bracketType === null &&
          candidate.matchNumber === 1 &&
          candidate.winnerTeamId !== null,
      )
      .sort(
        (left, right) => (right.bracketRound ?? 0) - (left.bracketRound ?? 0),
      )[0];
    if (!championship?.winnerTeamId) return;
    const winnerTeamId = championship.winnerTeamId;
    await tx.team.updateMany({
      where: {
        tournamentId: match.round.tournamentId,
        finalRank: 1,
        id: { not: winnerTeamId },
      },
      data: { finalRank: null },
    });
    await tx.team.update({
      where: { id: winnerTeamId },
      data: { finalRank: 1 },
    });
    await tx.round.update({
      where: { id: match.round.id },
      data: { status: RoundStatus.COMPLETED },
    });
    await tx.tournament.update({
      where: { id: match.round.tournamentId },
      data: { status: TournamentStatus.COMPLETED },
    });
  }

  private async rollbackEliminationCompletion(
    tx: MatchTransactionClient,
    match: ResultMatch,
    oldWinnerTeamId: string | null,
  ) {
    if (
      !oldWinnerTeamId ||
      (match.round.format !== RoundFormat.PLAYOFF &&
        match.round.format !== RoundFormat.DOUBLE_ELIM)
    )
      return;
    await tx.team.updateMany({
      where: { id: oldWinnerTeamId, finalRank: 1 },
      data: { finalRank: null },
    });
    await tx.round.update({
      where: { id: match.round.id },
      data: { status: RoundStatus.ONGOING },
    });
    await tx.tournament.update({
      where: { id: match.round.tournamentId },
      data: { status: TournamentStatus.ONGOING },
    });
  }

  private async placeTeam(
    tx: MatchTransactionClient,
    targetId: string | null,
    slot: MatchSlot | null,
    teamId: string | null,
  ) {
    if (!targetId && !slot) return;
    if (!targetId || !slot || !teamId)
      throw new ConflictException('Bracket progression link is incomplete');
    const target = await tx.match.findUnique({
      where: { id: targetId },
      select: {
        teamAId: true,
        teamBId: true,
        status: true,
        isBye: true,
        nextMatchId: true,
        nextMatchSlot: true,
      },
    });
    if (!target) throw new ConflictException('Downstream match not found');
    const field = slot === MatchSlot.A ? 'teamAId' : 'teamBId';
    if (target[field] !== null && target[field] !== teamId) {
      throw new ConflictException(
        'Downstream bracket slot is already occupied',
      );
    }
    await tx.match.update({
      where: { id: targetId },
      data: {
        [field]: teamId,
        ...(target.isBye && target.status !== MatchStatus.COMPLETED
          ? {
              status: MatchStatus.COMPLETED,
              scoreA: field === 'teamAId' ? 1 : 0,
              scoreB: field === 'teamBId' ? 1 : 0,
              winnerTeamId: teamId,
              outcome:
                field === 'teamAId' ? MatchOutcome.TEAM_A : MatchOutcome.TEAM_B,
            }
          : {}),
      },
    });
    if (target.isBye && target.status !== MatchStatus.COMPLETED) {
      await this.placeTeam(
        tx,
        target.nextMatchId,
        target.nextMatchSlot,
        teamId,
      );
    }
  }
}
