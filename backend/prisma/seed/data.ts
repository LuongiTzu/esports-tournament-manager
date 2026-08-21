import {
  Gender,
  Role,
  RoundFormat,
  TournamentMode,
  TournamentStatus,
  Visibility,
} from '@prisma/client';
import {
  DoubleElimSettings,
  GroupStageSettings,
  PlayoffSettings,
  RoundRobinSettings,
  SwissSettings,
} from '../../src/brackets/types/round-settings';

export const DEVELOPMENT_PASSWORD = '12345678';
export const SEED_EMAIL_DOMAIN = 'seed.esports.test';
export const SEED_SLUG_PREFIX = 'dev-seed-';

export interface SeedUserSpec {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  persona: 'ADMIN' | 'ORGANIZER' | 'PARTICIPANT';
  gender: Gender;
  phoneNumber: string;
  birthDate: string;
  currentAddress: string;
  bio: string;
}

interface RoundBase {
  key: string;
  name: string;
  bestOf: number;
}

export type SeedRoundSpec =
  | (RoundBase & {
      format: typeof RoundFormat.ROUND_ROBIN;
      settings: RoundRobinSettings;
    })
  | (RoundBase & {
      format: typeof RoundFormat.GROUP_STAGE;
      settings: GroupStageSettings;
    })
  | (RoundBase & {
      format: typeof RoundFormat.SWISS;
      settings: SwissSettings;
    })
  | (RoundBase & {
      format: typeof RoundFormat.PLAYOFF;
      settings: PlayoffSettings;
    })
  | (RoundBase & {
      format: typeof RoundFormat.DOUBLE_ELIM;
      settings: DoubleElimSettings;
    });

export interface SeedTournamentSpec {
  id: string;
  name: string;
  slug: string;
  game: string;
  organizerIndex: number;
  description: string;
  status: TournamentStatus;
  visibility: Visibility;
  mode: TournamentMode;
  location: string | null;
  maxTeams: number;
  maxTeamSize: number;
  approvedTeams: number;
  pendingTeams: number;
  rejectedTeams: number;
  startDate: string;
  endDate: string;
  registrationStartDate: string;
  registrationDeadline: string;
  competition: 'NONE' | 'PARTIAL' | 'COMPLETE';
  partialMatchLimit?: number;
  swissCompletedRounds?: number;
  forceGrandFinalReset?: boolean;
  rounds: SeedRoundSpec[];
}

const people = [
  ['admin-01', 'admin.one', 'Platform Admin', 'ADMIN'],
  ['admin-02', 'admin.two', 'Safety Admin', 'ADMIN'],
  ['organizer-01', 'aurora.events', 'Aurora Event Lead', 'ORGANIZER'],
  ['organizer-02', 'nova.operations', 'Nova Operations Lead', 'ORGANIZER'],
  ['organizer-03', 'summit.arena', 'Summit Arena Manager', 'ORGANIZER'],
  ['organizer-04', 'pulse.league', 'Pulse League Director', 'ORGANIZER'],
  ['organizer-05', 'vertex.circuit', 'Vertex Circuit Host', 'ORGANIZER'],
  ['organizer-06', 'ember.studio', 'Ember Studio Organizer', 'ORGANIZER'],
  ['organizer-07', 'harbor.esports', 'Harbor Esports Coordinator', 'ORGANIZER'],
  ['organizer-08', 'lotus.community', 'Lotus Community Host', 'ORGANIZER'],
  ['participant-01', 'kai.tran', 'Kai Tran', 'PARTICIPANT'],
  ['participant-02', 'mira.vo', 'Mira Vo', 'PARTICIPANT'],
  ['participant-03', 'linh.dao', 'Linh Dao', 'PARTICIPANT'],
  ['participant-04', 'son.pham', 'Son Pham', 'PARTICIPANT'],
  ['participant-05', 'an.le', 'An Le', 'PARTICIPANT'],
  ['participant-06', 'vy.nguyen', 'Vy Nguyen', 'PARTICIPANT'],
  ['participant-07', 'huy.do', 'Huy Do', 'PARTICIPANT'],
  ['participant-08', 'mai.bui', 'Mai Bui', 'PARTICIPANT'],
  ['participant-09', 'nam.hoang', 'Nam Hoang', 'PARTICIPANT'],
  ['participant-10', 'yen.lam', 'Yen Lam', 'PARTICIPANT'],
  ['participant-11', 'quang.vu', 'Quang Vu', 'PARTICIPANT'],
  ['participant-12', 'thao.dinh', 'Thao Dinh', 'PARTICIPANT'],
  ['participant-13', 'duc.ngo', 'Duc Ngo', 'PARTICIPANT'],
  ['participant-14', 'nhi.truong', 'Nhi Truong', 'PARTICIPANT'],
  ['participant-15', 'khanh.ly', 'Khanh Ly', 'PARTICIPANT'],
  ['participant-16', 'tuan.cao', 'Tuan Cao', 'PARTICIPANT'],
  ['participant-17', 'my.chau', 'My Chau', 'PARTICIPANT'],
  ['participant-18', 'phuc.dang', 'Phuc Dang', 'PARTICIPANT'],
  ['participant-19', 'han.nguyen', 'Han Nguyen', 'PARTICIPANT'],
  ['participant-20', 'bao.tran', 'Bao Tran', 'PARTICIPANT'],
] as const;

export const SEED_USERS: SeedUserSpec[] = people.map(
  ([id, emailPrefix, displayName, persona], index) => ({
    id: `seed-user-${id}`,
    email: `${emailPrefix}@${SEED_EMAIL_DOMAIN}`,
    displayName,
    role: persona === 'ADMIN' ? Role.ADMIN : Role.SIGNED_UP_USER,
    persona,
    gender: [Gender.MALE, Gender.FEMALE, Gender.OTHER][index % 3],
    phoneNumber: `0901${String(index + 1).padStart(6, '0')}`,
    birthDate: `${1988 + (index % 12)}-${String((index % 9) + 1).padStart(2, '0')}-15T00:00:00.000Z`,
    currentAddress: ['Ho Chi Minh City', 'Ha Noi', 'Da Nang'][index % 3],
    bio: `${displayName} is a fictional development account for tournament testing.`,
  }),
);

const rr = (
  allowDraws: boolean,
  meetingsPerPair = 1,
  winPoints = 3,
  drawPoints = 1,
  lossPoints = 0,
): RoundRobinSettings => ({
  winPoints,
  drawPoints,
  lossPoints,
  allowDraws,
  meetingsPerPair,
});

const groups = (
  allowDraws: boolean,
  meetingsPerPair = 1,
): GroupStageSettings => ({
  numberOfGroups: 2,
  advancingTeamsPerGroup: 2,
  winPoints: 3,
  drawPoints: 1,
  lossPoints: 0,
  allowDraws,
  meetingsPerPair,
});

const swiss = (
  numberOfRounds: number,
  advancingTeamCount: number,
): SwissSettings => ({ numberOfRounds, advancingTeamCount });

export const SEED_TOURNAMENTS: SeedTournamentSpec[] = [
  {
    id: 'seed-tournament-01',
    name: 'Celestial Vanguard Championship',
    slug: `${SEED_SLUG_PREFIX}celestial-vanguard`,
    game: 'Liên Quân Mobile',
    organizerIndex: 0,
    description:
      'A completed mobile MOBA championship with balanced groups and a four-team playoff.',
    status: TournamentStatus.COMPLETED,
    visibility: Visibility.PUBLIC,
    mode: TournamentMode.OFFLINE,
    location: 'Aurora Convention Hall, Ho Chi Minh City',
    maxTeams: 12,
    maxTeamSize: 7,
    approvedTeams: 8,
    pendingTeams: 2,
    rejectedTeams: 1,
    startDate: '2026-05-02T02:00:00.000Z',
    endDate: '2026-05-10T12:00:00.000Z',
    registrationStartDate: '2026-03-01T00:00:00.000Z',
    registrationDeadline: '2026-04-20T16:59:59.000Z',
    competition: 'COMPLETE',
    rounds: [
      {
        key: 'groups',
        name: 'Group Stage',
        format: RoundFormat.GROUP_STAGE,
        bestOf: 3,
        settings: groups(true),
      },
      {
        key: 'playoff',
        name: 'Championship Playoff',
        format: RoundFormat.PLAYOFF,
        bestOf: 5,
        settings: { thirdPlaceMatch: true },
      },
    ],
  },
  {
    id: 'seed-tournament-02',
    name: 'Neon Rift League',
    slug: `${SEED_SLUG_PREFIX}neon-rift-league`,
    game: 'League of Legends',
    organizerIndex: 1,
    description:
      'A two-leg league season with custom scoring and live standings.',
    status: TournamentStatus.ONGOING,
    visibility: Visibility.PUBLIC,
    mode: TournamentMode.ONLINE,
    location: null,
    maxTeams: 8,
    maxTeamSize: 5,
    approvedTeams: 6,
    pendingTeams: 1,
    rejectedTeams: 0,
    startDate: '2026-08-10T11:00:00.000Z',
    endDate: '2026-09-15T15:00:00.000Z',
    registrationStartDate: '2026-06-20T00:00:00.000Z',
    registrationDeadline: '2026-08-01T16:59:59.000Z',
    competition: 'PARTIAL',
    partialMatchLimit: 8,
    rounds: [
      {
        key: 'league',
        name: 'League Season',
        format: RoundFormat.ROUND_ROBIN,
        bestOf: 3,
        settings: rr(true, 2, 2, 1, 0),
      },
    ],
  },
  {
    id: 'seed-tournament-03',
    name: 'Radiant Protocol Invitational',
    slug: `${SEED_SLUG_PREFIX}radiant-protocol`,
    game: 'Valorant',
    organizerIndex: 2,
    description:
      'Three Swiss pairing rounds followed by a decisive four-team final bracket.',
    status: TournamentStatus.COMPLETED,
    visibility: Visibility.PUBLIC,
    mode: TournamentMode.HYBRID,
    location: 'Summit Broadcast Studio, Ha Noi',
    maxTeams: 10,
    maxTeamSize: 7,
    approvedTeams: 8,
    pendingTeams: 0,
    rejectedTeams: 1,
    startDate: '2026-06-12T03:00:00.000Z',
    endDate: '2026-06-21T13:00:00.000Z',
    registrationStartDate: '2026-04-01T00:00:00.000Z',
    registrationDeadline: '2026-05-31T16:59:59.000Z',
    competition: 'COMPLETE',
    rounds: [
      {
        key: 'swiss',
        name: 'Swiss Stage',
        format: RoundFormat.SWISS,
        bestOf: 3,
        settings: swiss(3, 4),
      },
      {
        key: 'playoff',
        name: 'Final Four',
        format: RoundFormat.PLAYOFF,
        bestOf: 3,
        settings: { thirdPlaceMatch: false },
      },
    ],
  },
  {
    id: 'seed-tournament-04',
    name: 'Iron Circuit Open',
    slug: `${SEED_SLUG_PREFIX}iron-circuit-open`,
    game: 'Counter-Strike 2',
    organizerIndex: 3,
    description:
      'A live double-elimination open featuring seeded byes and loser-bracket routing.',
    status: TournamentStatus.ONGOING,
    visibility: Visibility.PUBLIC,
    mode: TournamentMode.OFFLINE,
    location: 'Pulse Arena, Da Nang',
    maxTeams: 8,
    maxTeamSize: 6,
    approvedTeams: 6,
    pendingTeams: 1,
    rejectedTeams: 1,
    startDate: '2026-08-18T02:00:00.000Z',
    endDate: '2026-08-24T14:00:00.000Z',
    registrationStartDate: '2026-07-01T00:00:00.000Z',
    registrationDeadline: '2026-08-10T16:59:59.000Z',
    competition: 'PARTIAL',
    partialMatchLimit: 6,
    rounds: [
      {
        key: 'double',
        name: 'Double Elimination',
        format: RoundFormat.DOUBLE_ELIM,
        bestOf: 3,
        settings: { grandFinalReset: true },
      },
    ],
  },
  {
    id: 'seed-tournament-05',
    name: 'Ancient Nexus Draft Cup',
    slug: `${SEED_SLUG_PREFIX}ancient-nexus-draft`,
    game: 'Dota 2',
    organizerIndex: 4,
    description:
      'A private organizer draft prepared for a future single-elimination cup.',
    status: TournamentStatus.DRAFT,
    visibility: Visibility.PRIVATE,
    mode: TournamentMode.ONLINE,
    location: null,
    maxTeams: 8,
    maxTeamSize: 5,
    approvedTeams: 0,
    pendingTeams: 0,
    rejectedTeams: 0,
    startDate: '2026-11-07T03:00:00.000Z',
    endDate: '2026-11-08T14:00:00.000Z',
    registrationStartDate: '2026-09-01T00:00:00.000Z',
    registrationDeadline: '2026-10-25T16:59:59.000Z',
    competition: 'NONE',
    rounds: [
      {
        key: 'playoff',
        name: 'Main Bracket',
        format: RoundFormat.PLAYOFF,
        bestOf: 3,
        settings: { thirdPlaceMatch: false },
      },
    ],
  },
  {
    id: 'seed-tournament-06',
    name: 'Skyline Trios Championship',
    slug: `${SEED_SLUG_PREFIX}skyline-trios`,
    game: 'Rocket League',
    organizerIndex: 5,
    description:
      'A six-team single-elimination championship demonstrating deterministic first-round byes.',
    status: TournamentStatus.COMPLETED,
    visibility: Visibility.PUBLIC,
    mode: TournamentMode.HYBRID,
    location: 'Ember Studio, Ho Chi Minh City',
    maxTeams: 8,
    maxTeamSize: 4,
    approvedTeams: 6,
    pendingTeams: 1,
    rejectedTeams: 0,
    startDate: '2026-04-11T03:00:00.000Z',
    endDate: '2026-04-12T13:00:00.000Z',
    registrationStartDate: '2026-02-01T00:00:00.000Z',
    registrationDeadline: '2026-03-31T16:59:59.000Z',
    competition: 'COMPLETE',
    rounds: [
      {
        key: 'playoff',
        name: 'Championship Bracket',
        format: RoundFormat.PLAYOFF,
        bestOf: 5,
        settings: { thirdPlaceMatch: true },
      },
    ],
  },
  {
    id: 'seed-tournament-07',
    name: 'Crimson Fist Masters',
    slug: `${SEED_SLUG_PREFIX}crimson-fist-masters`,
    game: 'Tekken 8',
    organizerIndex: 6,
    description:
      'An eight-player double-elimination fighting game final without a bracket reset.',
    status: TournamentStatus.COMPLETED,
    visibility: Visibility.PRIVATE,
    mode: TournamentMode.OFFLINE,
    location: 'Harbor Community Stage, Hai Phong',
    maxTeams: 8,
    maxTeamSize: 1,
    approvedTeams: 8,
    pendingTeams: 0,
    rejectedTeams: 0,
    startDate: '2026-03-21T03:00:00.000Z',
    endDate: '2026-03-22T13:00:00.000Z',
    registrationStartDate: '2026-01-10T00:00:00.000Z',
    registrationDeadline: '2026-03-10T16:59:59.000Z',
    competition: 'COMPLETE',
    rounds: [
      {
        key: 'double',
        name: 'Masters Bracket',
        format: RoundFormat.DOUBLE_ELIM,
        bestOf: 5,
        settings: { grandFinalReset: false },
      },
    ],
  },
  {
    id: 'seed-tournament-08',
    name: 'Metro Clash League',
    slug: `${SEED_SLUG_PREFIX}metro-clash-league`,
    game: 'Street Fighter 6',
    organizerIndex: 7,
    description:
      'A completed round-robin league where configured draws contribute to standings.',
    status: TournamentStatus.COMPLETED,
    visibility: Visibility.PUBLIC,
    mode: TournamentMode.ONLINE,
    location: null,
    maxTeams: 6,
    maxTeamSize: 1,
    approvedTeams: 6,
    pendingTeams: 0,
    rejectedTeams: 0,
    startDate: '2026-02-14T03:00:00.000Z',
    endDate: '2026-02-28T13:00:00.000Z',
    registrationStartDate: '2025-12-20T00:00:00.000Z',
    registrationDeadline: '2026-02-01T16:59:59.000Z',
    competition: 'COMPLETE',
    rounds: [
      {
        key: 'league',
        name: 'Metro League',
        format: RoundFormat.ROUND_ROBIN,
        bestOf: 3,
        settings: rr(true),
      },
    ],
  },
  {
    id: 'seed-tournament-09',
    name: 'Stormgate Swiss Series',
    slug: `${SEED_SLUG_PREFIX}stormgate-swiss`,
    game: 'Liên Quân Mobile',
    organizerIndex: 0,
    description:
      'An active four-round Swiss series with record-influenced pairings and no draws.',
    status: TournamentStatus.ONGOING,
    visibility: Visibility.PUBLIC,
    mode: TournamentMode.ONLINE,
    location: null,
    maxTeams: 12,
    maxTeamSize: 6,
    approvedTeams: 8,
    pendingTeams: 2,
    rejectedTeams: 0,
    startDate: '2026-08-08T03:00:00.000Z',
    endDate: '2026-09-05T13:00:00.000Z',
    registrationStartDate: '2026-06-15T00:00:00.000Z',
    registrationDeadline: '2026-07-30T16:59:59.000Z',
    competition: 'PARTIAL',
    swissCompletedRounds: 2,
    rounds: [
      {
        key: 'swiss',
        name: 'Swiss Stage',
        format: RoundFormat.SWISS,
        bestOf: 3,
        settings: swiss(4, 4),
      },
    ],
  },
  {
    id: 'seed-tournament-10',
    name: 'Arcane Groups Cup',
    slug: `${SEED_SLUG_PREFIX}arcane-groups`,
    game: 'League of Legends',
    organizerIndex: 1,
    description:
      'An ongoing equal-sized group stage with partially reported match results.',
    status: TournamentStatus.ONGOING,
    visibility: Visibility.PUBLIC,
    mode: TournamentMode.OFFLINE,
    location: 'Nova Campus Arena, Ha Noi',
    maxTeams: 10,
    maxTeamSize: 6,
    approvedTeams: 8,
    pendingTeams: 0,
    rejectedTeams: 1,
    startDate: '2026-08-15T03:00:00.000Z',
    endDate: '2026-08-30T13:00:00.000Z',
    registrationStartDate: '2026-06-01T00:00:00.000Z',
    registrationDeadline: '2026-08-05T16:59:59.000Z',
    competition: 'PARTIAL',
    partialMatchLimit: 5,
    rounds: [
      {
        key: 'groups',
        name: 'Group Stage',
        format: RoundFormat.GROUP_STAGE,
        bestOf: 3,
        settings: groups(true),
      },
    ],
  },
  {
    id: 'seed-tournament-11',
    name: 'Prism Strike Rookie Cup',
    slug: `${SEED_SLUG_PREFIX}prism-strike-rookie`,
    game: 'Valorant',
    organizerIndex: 2,
    description:
      'An open registration cup with approved, pending, and rejected team applications.',
    status: TournamentStatus.REGISTRATION,
    visibility: Visibility.PUBLIC,
    mode: TournamentMode.ONLINE,
    location: null,
    maxTeams: 8,
    maxTeamSize: 5,
    approvedTeams: 3,
    pendingTeams: 2,
    rejectedTeams: 1,
    startDate: '2026-10-10T03:00:00.000Z',
    endDate: '2026-10-11T13:00:00.000Z',
    registrationStartDate: '2026-08-01T00:00:00.000Z',
    registrationDeadline: '2026-09-30T16:59:59.000Z',
    competition: 'NONE',
    rounds: [
      {
        key: 'playoff',
        name: 'Rookie Playoff',
        format: RoundFormat.PLAYOFF,
        bestOf: 3,
        settings: { thirdPlaceMatch: false },
      },
    ],
  },
  {
    id: 'seed-tournament-12',
    name: 'Midnight Tactical League',
    slug: `${SEED_SLUG_PREFIX}midnight-tactical`,
    game: 'Counter-Strike 2',
    organizerIndex: 3,
    description:
      'A completed double round-robin tactical league with configurable draw scoring.',
    status: TournamentStatus.COMPLETED,
    visibility: Visibility.PUBLIC,
    mode: TournamentMode.ONLINE,
    location: null,
    maxTeams: 4,
    maxTeamSize: 7,
    approvedTeams: 4,
    pendingTeams: 0,
    rejectedTeams: 0,
    startDate: '2026-01-10T03:00:00.000Z',
    endDate: '2026-02-07T13:00:00.000Z',
    registrationStartDate: '2025-11-01T00:00:00.000Z',
    registrationDeadline: '2025-12-31T16:59:59.000Z',
    competition: 'COMPLETE',
    rounds: [
      {
        key: 'league',
        name: 'Tactical League',
        format: RoundFormat.ROUND_ROBIN,
        bestOf: 3,
        settings: rr(true, 2),
      },
    ],
  },
  {
    id: 'seed-tournament-13',
    name: 'Aegis Forge Double Crown',
    slug: `${SEED_SLUG_PREFIX}aegis-forge`,
    game: 'Dota 2',
    organizerIndex: 4,
    description:
      'A completed four-team double-elimination event with an activated Grand Final Reset.',
    status: TournamentStatus.COMPLETED,
    visibility: Visibility.PUBLIC,
    mode: TournamentMode.HYBRID,
    location: 'Vertex Production House, Ho Chi Minh City',
    maxTeams: 4,
    maxTeamSize: 7,
    approvedTeams: 4,
    pendingTeams: 0,
    rejectedTeams: 0,
    startDate: '2026-04-25T03:00:00.000Z',
    endDate: '2026-04-27T13:00:00.000Z',
    registrationStartDate: '2026-02-01T00:00:00.000Z',
    registrationDeadline: '2026-04-10T16:59:59.000Z',
    competition: 'COMPLETE',
    forceGrandFinalReset: true,
    rounds: [
      {
        key: 'double',
        name: 'Double Crown Bracket',
        format: RoundFormat.DOUBLE_ELIM,
        bestOf: 3,
        settings: { grandFinalReset: true },
      },
    ],
  },
  {
    id: 'seed-tournament-14',
    name: 'Aerial Pulse Championship',
    slug: `${SEED_SLUG_PREFIX}aerial-pulse`,
    game: 'Rocket League',
    organizerIndex: 5,
    description:
      'Equal-sized groups have concluded and the four-team playoff is underway.',
    status: TournamentStatus.ONGOING,
    visibility: Visibility.PUBLIC,
    mode: TournamentMode.OFFLINE,
    location: 'Ember Dome, Da Nang',
    maxTeams: 10,
    maxTeamSize: 3,
    approvedTeams: 8,
    pendingTeams: 1,
    rejectedTeams: 0,
    startDate: '2026-08-16T03:00:00.000Z',
    endDate: '2026-08-29T13:00:00.000Z',
    registrationStartDate: '2026-06-15T00:00:00.000Z',
    registrationDeadline: '2026-08-05T16:59:59.000Z',
    competition: 'PARTIAL',
    partialMatchLimit: 2,
    rounds: [
      {
        key: 'groups',
        name: 'Group Stage',
        format: RoundFormat.GROUP_STAGE,
        bestOf: 3,
        settings: groups(false),
      },
      {
        key: 'playoff',
        name: 'Aerial Playoff',
        format: RoundFormat.PLAYOFF,
        bestOf: 5,
        settings: { thirdPlaceMatch: true },
      },
    ],
  },
  {
    id: 'seed-tournament-15',
    name: 'Electric Dojo Open',
    slug: `${SEED_SLUG_PREFIX}electric-dojo`,
    game: 'Tekken 8',
    organizerIndex: 6,
    description:
      'A seven-player completed bracket with seeded byes and a third-place match.',
    status: TournamentStatus.COMPLETED,
    visibility: Visibility.PUBLIC,
    mode: TournamentMode.OFFLINE,
    location: 'Harbor Arcade Hall, Hai Phong',
    maxTeams: 8,
    maxTeamSize: 1,
    approvedTeams: 7,
    pendingTeams: 0,
    rejectedTeams: 0,
    startDate: '2026-07-04T03:00:00.000Z',
    endDate: '2026-07-05T13:00:00.000Z',
    registrationStartDate: '2026-05-01T00:00:00.000Z',
    registrationDeadline: '2026-06-25T16:59:59.000Z',
    competition: 'COMPLETE',
    rounds: [
      {
        key: 'playoff',
        name: 'Dojo Bracket',
        format: RoundFormat.PLAYOFF,
        bestOf: 5,
        settings: { thirdPlaceMatch: true },
      },
    ],
  },
  {
    id: 'seed-tournament-16',
    name: 'Street Pulse Swiss Lab',
    slug: `${SEED_SLUG_PREFIX}street-pulse-swiss`,
    game: 'Street Fighter 6',
    organizerIndex: 7,
    description:
      'An odd-player Swiss event demonstrating deterministic bye allocation.',
    status: TournamentStatus.ONGOING,
    visibility: Visibility.PUBLIC,
    mode: TournamentMode.ONLINE,
    location: null,
    maxTeams: 8,
    maxTeamSize: 1,
    approvedTeams: 7,
    pendingTeams: 0,
    rejectedTeams: 0,
    startDate: '2026-08-20T03:00:00.000Z',
    endDate: '2026-09-03T13:00:00.000Z',
    registrationStartDate: '2026-07-01T00:00:00.000Z',
    registrationDeadline: '2026-08-12T16:59:59.000Z',
    competition: 'PARTIAL',
    swissCompletedRounds: 1,
    rounds: [
      {
        key: 'swiss',
        name: 'Swiss Lab',
        format: RoundFormat.SWISS,
        bestOf: 3,
        settings: swiss(3, 4),
      },
    ],
  },
  {
    id: 'seed-tournament-17',
    name: 'Lotus Mobile Academy',
    slug: `${SEED_SLUG_PREFIX}lotus-mobile-academy`,
    game: 'Liên Quân Mobile',
    organizerIndex: 0,
    description:
      'A private draft configured for an equal-sized academy group stage.',
    status: TournamentStatus.DRAFT,
    visibility: Visibility.PRIVATE,
    mode: TournamentMode.ONLINE,
    location: null,
    maxTeams: 8,
    maxTeamSize: 5,
    approvedTeams: 0,
    pendingTeams: 0,
    rejectedTeams: 0,
    startDate: '2026-12-05T03:00:00.000Z',
    endDate: '2026-12-13T13:00:00.000Z',
    registrationStartDate: '2026-10-01T00:00:00.000Z',
    registrationDeadline: '2026-11-25T16:59:59.000Z',
    competition: 'NONE',
    rounds: [
      {
        key: 'groups',
        name: 'Academy Groups',
        format: RoundFormat.GROUP_STAGE,
        bestOf: 3,
        settings: groups(false),
      },
    ],
  },
  {
    id: 'seed-tournament-18',
    name: 'Shattered Nexus Showcase',
    slug: `${SEED_SLUG_PREFIX}shattered-nexus`,
    game: 'League of Legends',
    organizerIndex: 1,
    description:
      'A cancelled showcase retained to exercise lifecycle and rejected registration views.',
    status: TournamentStatus.CANCELLED,
    visibility: Visibility.PUBLIC,
    mode: TournamentMode.HYBRID,
    location: 'Nova Broadcast Room, Ha Noi',
    maxTeams: 8,
    maxTeamSize: 7,
    approvedTeams: 0,
    pendingTeams: 0,
    rejectedTeams: 2,
    startDate: '2026-09-12T03:00:00.000Z',
    endDate: '2026-09-13T13:00:00.000Z',
    registrationStartDate: '2026-07-01T00:00:00.000Z',
    registrationDeadline: '2026-08-31T16:59:59.000Z',
    competition: 'NONE',
    rounds: [
      {
        key: 'playoff',
        name: 'Showcase Bracket',
        format: RoundFormat.PLAYOFF,
        bestOf: 3,
        settings: { thirdPlaceMatch: false },
      },
    ],
  },
  {
    id: 'seed-tournament-19',
    name: 'Valorant Campus Qualifier',
    slug: `${SEED_SLUG_PREFIX}valorant-campus`,
    game: 'Valorant',
    organizerIndex: 2,
    description:
      'A private campus qualifier accepting registrations for a three-round Swiss stage.',
    status: TournamentStatus.REGISTRATION,
    visibility: Visibility.PRIVATE,
    mode: TournamentMode.OFFLINE,
    location: 'Summit University Hall, Ha Noi',
    maxTeams: 8,
    maxTeamSize: 6,
    approvedTeams: 4,
    pendingTeams: 2,
    rejectedTeams: 1,
    startDate: '2026-10-17T03:00:00.000Z',
    endDate: '2026-10-18T13:00:00.000Z',
    registrationStartDate: '2026-08-01T00:00:00.000Z',
    registrationDeadline: '2026-10-05T16:59:59.000Z',
    competition: 'NONE',
    rounds: [
      {
        key: 'swiss',
        name: 'Campus Swiss',
        format: RoundFormat.SWISS,
        bestOf: 3,
        settings: swiss(3, 4),
      },
    ],
  },
  {
    id: 'seed-tournament-20',
    name: 'Counter Core Invitational',
    slug: `${SEED_SLUG_PREFIX}counter-core`,
    game: 'Counter-Strike 2',
    organizerIndex: 3,
    description:
      'A private hybrid invitational taking applications for two equal groups.',
    status: TournamentStatus.REGISTRATION,
    visibility: Visibility.PRIVATE,
    mode: TournamentMode.HYBRID,
    location: 'Pulse Broadcast Center, Da Nang',
    maxTeams: 8,
    maxTeamSize: 5,
    approvedTeams: 4,
    pendingTeams: 2,
    rejectedTeams: 0,
    startDate: '2026-11-14T03:00:00.000Z',
    endDate: '2026-11-22T13:00:00.000Z',
    registrationStartDate: '2026-08-15T00:00:00.000Z',
    registrationDeadline: '2026-10-31T16:59:59.000Z',
    competition: 'NONE',
    rounds: [
      {
        key: 'groups',
        name: 'Invitational Groups',
        format: RoundFormat.GROUP_STAGE,
        bestOf: 3,
        settings: groups(false),
      },
    ],
  },
];

export const TEAM_NAME_PREFIXES = [
  'Aurora',
  'Crimson',
  'Vertex',
  'Solar',
  'Obsidian',
  'Nimbus',
  'Ember',
  'Harbor',
  'Quantum',
  'Lotus',
  'Neon',
  'Aegis',
] as const;

export const TEAM_NAME_SUFFIXES = [
  'Foxes',
  'Sentinels',
  'Drakes',
  'Comets',
  'Titans',
  'Wolves',
  'Ravens',
  'Sparks',
  'Guardians',
  'Voyagers',
] as const;
