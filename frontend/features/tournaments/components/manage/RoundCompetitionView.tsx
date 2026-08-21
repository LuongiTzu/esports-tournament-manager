import type {
  BracketGroup,
  BracketMatch,
  RoundBracket,
} from "@/features/tournaments/types";
import BracketMatchCard from "./BracketMatchCard";

function matchesByRound(matches: BracketMatch[]) {
  const grouped = new Map<number, BracketMatch[]>();
  for (const match of matches) {
    const round = match.bracketRound ?? 0;
    grouped.set(round, [...(grouped.get(round) ?? []), match]);
  }
  return [...grouped.entries()].sort(([a], [b]) => a - b);
}

function EmptyMatches({
  message = "Chưa có trận đấu được tạo.",
}: {
  message?: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-line px-5 py-10 text-center text-sm text-ink-muted">
      {message}
    </div>
  );
}

function MatchRounds({
  matches,
  label,
  linkLabels,
  onSelectMatch,
}: {
  matches: BracketMatch[];
  label: (round: number) => string;
  linkLabels?: (match: BracketMatch) => { winner?: string; loser?: string };
  onSelectMatch?: (match: BracketMatch) => void;
}) {
  if (!matches.length) return <EmptyMatches />;

  return (
    <div className="overflow-x-auto pb-3">
      <div className="flex min-w-max items-start gap-5">
        {matchesByRound(matches).map(([round, roundMatches]) => (
          <section key={round} className="w-64 shrink-0">
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-brand">
              {label(round)}
            </h4>
            <div className="space-y-3">
              {roundMatches.map((match) => (
                <BracketMatchCard
                  key={match.id}
                  match={match}
                  linkLabels={linkLabels?.(match)}
                  onSelect={onSelectMatch}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function RoundRobinView({
  matches,
  onSelectMatch,
}: {
  matches: BracketMatch[];
  onSelectMatch?: (match: BracketMatch) => void;
}) {
  return (
    <MatchRounds
      matches={matches}
      label={(round) => `Lượt ${round}`}
      onSelectMatch={onSelectMatch}
    />
  );
}

function GroupTeamList({ group }: { group: BracketGroup }) {
  return (
    <div className="flex flex-wrap gap-2">
      {group.teams.map((team) => (
        <span
          key={team.id}
          className="rounded-full border border-line bg-surface-sub px-3 py-1.5 text-xs text-ink-muted"
        >
          {team.seed != null && (
            <span className="mr-1 text-ink-faint">#{team.seed}</span>
          )}
          {team.name}
        </span>
      ))}
    </div>
  );
}

function GroupStageView({
  bracket,
  onSelectMatch,
}: {
  bracket: RoundBracket;
  onSelectMatch?: (match: BracketMatch) => void;
}) {
  if (!bracket.groups.length)
    return <EmptyMatches message="Chưa có bảng đấu được tạo." />;

  return (
    <div className="space-y-5">
      {bracket.groups.map((group) => {
        const groupMatches = bracket.matches.filter(
          (match) => match.groupId === group.id,
        );
        return (
          <section
            key={group.id}
            className="rounded-2xl border border-line bg-surface-sub/35 p-4 sm:p-5"
          >
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-ink">{group.name}</h3>
                <p className="mt-1 text-xs text-ink-faint">
                  {group.teams.length} đội · {groupMatches.length} trận
                </p>
              </div>
              <GroupTeamList group={group} />
            </div>
            {groupMatches.length ? (
              <MatchRounds
                matches={groupMatches}
                label={(round) => `Lượt ${round}`}
                onSelectMatch={onSelectMatch}
              />
            ) : (
              <EmptyMatches message="Bảng này chưa có trận đấu." />
            )}
          </section>
        );
      })}
    </div>
  );
}

function SwissView({
  matches,
  onSelectMatch,
}: {
  matches: BracketMatch[];
  onSelectMatch?: (match: BracketMatch) => void;
}) {
  if (!matches.length) return <EmptyMatches />;
  return (
    <div className="space-y-5">
      {matchesByRound(matches).map(([round, iterationMatches]) => {
        const completed = iterationMatches.filter(
          (match) => match.status === "COMPLETED",
        ).length;
        return (
          <section
            key={round}
            className="rounded-2xl border border-line p-4 sm:p-5"
          >
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-ink">Lượt Swiss {round}</h3>
                <p className="mt-1 text-xs text-ink-faint">
                  {completed}/{iterationMatches.length} trận hoàn tất
                </p>
              </div>
              {iterationMatches.some((match) => match.isBye) && (
                <span className="rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
                  Có BYE
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              {iterationMatches.map((match) => (
                <BracketMatchCard
                  key={match.id}
                  match={match}
                  onSelect={onSelectMatch}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function PlayoffView({
  bracket,
  onSelectMatch,
}: {
  bracket: RoundBracket;
  onSelectMatch?: (match: BracketMatch) => void;
}) {
  const maxRound = Math.max(
    0,
    ...bracket.matches.map((match) => match.bracketRound ?? 0),
  );
  const thirdPlaceEnabled =
    bracket.round.format === "PLAYOFF" &&
    bracket.round.settings.thirdPlaceMatch;

  if (!bracket.matches.length) return <EmptyMatches />;
  return (
    <div className="overflow-x-auto pb-3">
      <div className="flex min-w-max items-start gap-5">
        {matchesByRound(bracket.matches).map(([round, roundMatches]) => (
          <section key={round} className="w-64 shrink-0">
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-brand">
              {round === maxRound ? "Chung kết" : `Vòng loại ${round}`}
            </h4>
            <div className="space-y-3">
              {roundMatches.map((match) => (
                <BracketMatchCard
                  key={match.id}
                  match={match}
                  label={
                    thirdPlaceEnabled &&
                    round === maxRound &&
                    match.matchNumber === 2
                      ? "Tranh hạng ba"
                      : undefined
                  }
                  onSelect={onSelectMatch}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function DoubleEliminationView({
  matches,
  onSelectMatch,
}: {
  matches: BracketMatch[];
  onSelectMatch?: (match: BracketMatch) => void;
}) {
  const winners = matches.filter((match) => match.bracketType === "WINNER");
  const losers = matches.filter((match) => match.bracketType === "LOSER");
  const finals = matches.filter((match) => match.bracketType === null);
  const matchLabels = new Map(
    matches.map((match) => [
      match.id,
      match.activationCondition
        ? "Grand Final Reset"
        : match.bracketType === null
          ? "Grand Final"
          : `${match.bracketType === "WINNER" ? "Nhánh thắng" : "Nhánh thua"} V${match.bracketRound ?? "–"} T${match.matchNumber ?? "–"}`,
    ]),
  );
  const linkLabels = (match: BracketMatch) => ({
    winner: match.nextMatch.id
      ? matchLabels.get(match.nextMatch.id)
      : undefined,
    loser: match.loserNextMatch.id
      ? matchLabels.get(match.loserNextMatch.id)
      : undefined,
  });

  if (!matches.length) return <EmptyMatches />;
  return (
    <div className="space-y-8">
      <section>
        <h3 className="mb-4 text-base font-bold text-approved">Nhánh thắng</h3>
        <MatchRounds
          matches={winners}
          label={(round) => `Vòng ${round}`}
          linkLabels={linkLabels}
          onSelectMatch={onSelectMatch}
        />
      </section>
      <section>
        <h3 className="mb-4 text-base font-bold text-rejected">Nhánh thua</h3>
        <MatchRounds
          matches={losers}
          label={(round) => `Vòng ${round}`}
          linkLabels={linkLabels}
          onSelectMatch={onSelectMatch}
        />
      </section>
      <section>
        <h3 className="mb-4 text-base font-bold text-brand">Chung kết tổng</h3>
        <div className="flex flex-wrap gap-3">
          {finals.map((match) => (
            <BracketMatchCard
              key={match.id}
              match={match}
              label={
                match.activationCondition ? "Grand Final Reset" : "Grand Final"
              }
              linkLabels={linkLabels(match)}
              onSelect={onSelectMatch}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

export default function RoundCompetitionView({
  bracket,
  onSelectMatch,
}: {
  bracket: RoundBracket;
  onSelectMatch?: (match: BracketMatch) => void;
}) {
  switch (bracket.round.format) {
    case "ROUND_ROBIN":
      return (
        <RoundRobinView
          matches={bracket.matches}
          onSelectMatch={onSelectMatch}
        />
      );
    case "GROUP_STAGE":
      return <GroupStageView bracket={bracket} onSelectMatch={onSelectMatch} />;
    case "SWISS":
      return (
        <SwissView matches={bracket.matches} onSelectMatch={onSelectMatch} />
      );
    case "PLAYOFF":
      return <PlayoffView bracket={bracket} onSelectMatch={onSelectMatch} />;
    case "DOUBLE_ELIM":
      return (
        <DoubleEliminationView
          matches={bracket.matches}
          onSelectMatch={onSelectMatch}
        />
      );
  }
}
