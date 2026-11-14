import { RoundFormat, TournamentMode } from '@prisma/client';
import { searchFilterProperties } from '../tournament-ai-search.service';
import { assistantTopics } from './assistant-scope';
import { recordReports } from './assistant-records.service';

const string = { type: 'string' };
const integer = { type: 'integer' };
const boolean = { type: 'boolean' };
const dateTime = { type: 'string', format: 'date-time' };
export const settingsSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    scoringMode: { type: 'string', enum: ['SERIES_SCORE', 'POINT_SCORE'] },
    mode: { type: 'string', enum: ['FIXED_ROUNDS', 'THRESHOLD'] },
    numberOfRounds: { type: ['integer', 'null'] },
    advancingTeamCount: integer,
    winsToAdvance: integer,
    lossesToEliminate: integer,
    numberOfGroups: integer,
    advancingTeamsPerGroup: integer,
    winPoints: integer,
    drawPoints: integer,
    lossPoints: integer,
    allowDraws: boolean,
    meetingsPerPair: integer,
    thirdPlaceMatch: boolean,
    grandFinalReset: boolean,
  },
};
const roundSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'format'],
  properties: {
    name: string,
    format: { type: 'string', enum: Object.values(RoundFormat) },
    bestOf: { type: 'integer', enum: [1, 3, 5, 7, 9] },
    settings: settingsSchema,
  },
};
export const tournamentPayloadProperties = {
  name: string,
  gameId: string,
  customGameName: string,
  description: string,
  rules: string,
  mode: { type: 'string', enum: Object.values(TournamentMode) },
  location: string,
  visibility: { type: 'string', enum: ['PUBLIC', 'PRIVATE'] },
  maxTeams: integer,
  teamSize: integer,
  maxTeamSize: integer,
  minAge: integer,
  maxAge: integer,
  registrationOpen: boolean,
  registrationStartDate: dateTime,
  registrationDeadline: dateTime,
  startDate: dateTime,
  endDate: dateTime,
  autoApproveTeams: boolean,
  requireMemberFullInfo: boolean,
  prizePool: string,
  rounds: { type: 'array', items: roundSchema, maxItems: 8 },
};
export const assistantSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['topic', 'action', 'message', 'report'],
  properties: {
    topic: { type: 'string', enum: [...assistantTopics] },
    catalogGameId: { type: 'string' },
    researchQuery: { type: 'string', maxLength: 300 },
    report: { type: ['string', 'null'], enum: [...recordReports, null] },
    teamName: { type: 'string', maxLength: 100 },
    action: {
      type: 'string',
      enum: [
        'answer',
        'search',
        'records',
        'create',
        'update',
        'update_round',
        'add_round',
      ],
    },
    message: { type: 'string', maxLength: 3000 },
    filters: {
      type: 'object',
      additionalProperties: false,
      properties: searchFilterProperties,
    },
  },
};

// Keep independent action schemas small enough for Gemini's constrained decoder.
export const proposalSchemas: Record<string, Record<string, unknown>> = {
  create: {
    type: 'object',
    additionalProperties: false,
    properties: tournamentPayloadProperties,
    required: ['name', 'gameId'],
  },
  update: {
    type: 'object',
    additionalProperties: false,
    properties: Object.fromEntries(
      Object.entries(tournamentPayloadProperties).filter(
        ([key]) => key !== 'rounds',
      ),
    ),
  },
  add_round: roundSchema,
  update_round: {
    type: 'object',
    additionalProperties: false,
    properties: { roundId: string, settings: settingsSchema },
    required: ['roundId', 'settings'],
  },
};
