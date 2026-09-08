// API-shaped fixtures only; no fixture generation is imported into the app.
export const teams = [
  "Sài Gòn Mãnh Hổ",
  "Thăng Long Kỳ Lân",
  "Đà Nẵng Cánh Én",
  "Cửu Long Tiên Phong",
  "Hải Phòng Chiến Binh",
  "Tây Nguyên Mãnh Hổ",
  "Đồng Đô Kỳ Lân",
  "Huế Cánh Én",
].map((name, index) => ({
  id: `team-${index + 1}`,
  name,
  shortName: ["SGMH", "TLKL", "DNCE", "CLTP", "HPCB", "TNMH", "DDKL", "HCE"][
    index
  ],
  logoUrl: null,
  seed: index + 1,
}));

export function match(id, overrides = {}) {
  return {
    id,
    groupId: null,
    bracketRound: 1,
    bracketType: null,
    matchNumber: 1,
    status: "PENDING",
    outcome: null,
    isActive: true,
    activationCondition: null,
    isBye: false,
    bestOf: 3,
    scheduledAt: null,
    slots: { A: null, B: null },
    score: { A: 0, B: 0 },
    winner: null,
    nextMatch: { id: null, slot: null },
    loserNextMatch: { id: null, slot: null },
    ...overrides,
  };
}

export function playoff(size = 8, bronze = false) {
  const matches = [];
  const rounds = Math.log2(size);
  for (let round = 1; round <= rounds; round++) {
    for (let number = 1; number <= size / 2 ** round; number++) {
      matches.push(
        match(`p-${round}-${number}`, {
          bracketRound: round,
          matchNumber: number,
          slots:
            round === 1
              ? {
                  A: teams[(number * 2 - 2) % 8],
                  B: teams[(number * 2 - 1) % 8],
                }
              : { A: null, B: null },
          scheduledAt: round === 1 ? "2026-09-12T03:00:00.000Z" : null,
          nextMatch:
            round < rounds
              ? {
                  id: `p-${round + 1}-${Math.ceil(number / 2)}`,
                  slot: number % 2 ? "A" : "B",
                }
              : { id: null, slot: null },
          loserNextMatch:
            bronze && round === rounds - 1
              ? { id: "bronze", slot: number === 1 ? "A" : "B" }
              : { id: null, slot: null },
        }),
      );
    }
  }
  if (bronze && size >= 4)
    matches.push(match("bronze", { bracketRound: rounds, matchNumber: 2 }));
  return {
    round: {
      id: "playoff",
      name: "Vòng Playoff",
      format: "PLAYOFF",
      status: "UPCOMING",
      orderIndex: 2,
      bestOf: 3,
      settings: { thirdPlaceMatch: bronze },
    },
    groups: [],
    matches,
  };
}

export function doubleElimination(reset = true) {
  const matches = [
    match("w1", {
      bracketType: "WINNER",
      slots: { A: teams[0], B: teams[1] },
      nextMatch: { id: "wf", slot: "A" },
      loserNextMatch: { id: "l1", slot: "B" },
    }),
    match("w2", {
      bracketType: "WINNER",
      matchNumber: 2,
      slots: { A: teams[2], B: teams[3] },
      nextMatch: { id: "wf", slot: "B" },
      loserNextMatch: { id: "l1", slot: "A" },
    }),
    match("wf", {
      bracketType: "WINNER",
      bracketRound: 2,
      nextMatch: { id: "gf", slot: "A" },
      loserNextMatch: { id: "lf", slot: "B" },
    }),
    match("l1", { bracketType: "LOSER", nextMatch: { id: "lf", slot: "A" } }),
    match("lf", {
      bracketType: "LOSER",
      bracketRound: 2,
      nextMatch: { id: "gf", slot: "B" },
    }),
    match("gf", {
      bracketRound: 3,
      nextMatch: { id: reset ? "reset" : null, slot: reset ? "A" : null },
      loserNextMatch: { id: reset ? "reset" : null, slot: reset ? "B" : null },
    }),
  ];
  if (reset)
    matches.push(
      match("reset", {
        bracketRound: 4,
        isActive: false,
        activationCondition: "LOSER_BRACKET_CHAMPION_WINS_GRAND_FINAL",
      }),
    );
  return {
    round: {
      id: "double",
      name: "Vòng Playoff hai nhánh",
      format: "DOUBLE_ELIM",
      status: "UPCOMING",
      orderIndex: 2,
      bestOf: 3,
      settings: { grandFinalReset: reset },
    },
    groups: [],
    matches,
  };
}

export function swiss() {
  const matches = [1, 2].flatMap((round) =>
    [1, 2, 3, 4].map((number) =>
      match(`s-${round}-${number}`, {
        bracketRound: round,
        matchNumber: number,
        status: round === 1 ? "COMPLETED" : "PENDING",
        outcome: round === 1 ? "TEAM_A" : null,
        slots:
          round === 1
            ? { A: teams[number - 1], B: teams[number + 3] }
            : { A: teams[(number - 1) * 2], B: teams[(number - 1) * 2 + 1] },
        winner: round === 1 ? teams[number - 1] : null,
        score: round === 1 ? { A: 2, B: 1 } : { A: 0, B: 0 },
        scheduledAt: "2026-09-12T03:00:00.000Z",
      }),
    ),
  );
  return {
    round: {
      id: "swiss",
      name: "Vòng Swiss",
      format: "SWISS",
      status: "ONGOING",
      orderIndex: 1,
      bestOf: 3,
      settings: { numberOfRounds: 3, advancingTeamCount: 4 },
    },
    groups: [],
    matches,
    swiss: {
      groups: [
        {
          id: "swiss-1-0-0",
          bracketRound: 1,
          records: [{ wins: 0, losses: 0 }],
          entries: [1, 2, 3, 4].map((n) => ({
            matchId: `s-1-${n}`,
            A: { wins: 0, losses: 0 },
            B: { wins: 0, losses: 0 },
          })),
        },
        {
          id: "swiss-2-1-0",
          bracketRound: 2,
          records: [{ wins: 1, losses: 0 }],
          entries: [1, 2].map((n) => ({
            matchId: `s-2-${n}`,
            A: { wins: 1, losses: 0 },
            B: { wins: 1, losses: 0 },
          })),
        },
        {
          id: "swiss-2-0-1",
          bracketRound: 2,
          records: [{ wins: 0, losses: 1 }],
          entries: [3, 4].map((n) => ({
            matchId: `s-2-${n}`,
            A: { wins: 0, losses: 1 },
            B: { wins: 0, losses: 1 },
          })),
        },
      ],
      links: [
        { from: "swiss-1-0-0", to: "swiss-2-1-0", result: "winner" },
        { from: "swiss-1-0-0", to: "swiss-2-0-1", result: "loser" },
      ],
    },
  };
}
