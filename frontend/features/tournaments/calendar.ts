import type { TournamentSchedule } from "@/features/tournaments/types";

interface CalendarCopy {
  awaitingTeam: string;
  bestOf: string;
  round: string;
  versus: string;
}

interface TournamentCalendarOptions {
  generatedAt?: Date;
  location?: string | null;
  pageUrl: string;
  schedule: TournamentSchedule;
  copy: CalendarCopy;
}

function escapeIcsText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function formatIcsDate(value: Date) {
  return value
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function calendarFileName(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return `${normalized || "tournament"}-schedule.ics`;
}

export function createTournamentCalendar({
  generatedAt = new Date(),
  location,
  pageUrl,
  schedule,
  copy,
}: TournamentCalendarOptions) {
  const scheduledMatches = schedule.rounds.flatMap((round) =>
    round.dates.flatMap((dateGroup) =>
      dateGroup.matches.flatMap((match) => {
        if (!match.scheduledAt || !match.isActive || match.isBye) return [];
        return [{ match, round, scheduledAt: match.scheduledAt }];
      }),
    ),
  );
  const events = scheduledMatches.flatMap(({ match, round, scheduledAt }) => {
    const teamA = match.teamA?.name ?? copy.awaitingTeam;
    const teamB = match.teamB?.name ?? copy.awaitingTeam;
    const summary = `${teamA} ${copy.versus} ${teamB} — ${schedule.tournament.name}`;
    const descriptionParts = [
      `${copy.round}: ${round.name}`,
      `${copy.bestOf}: BO${match.bestOf}`,
    ];
    if (match.discordLink) descriptionParts.push(match.discordLink);

    return [
      "BEGIN:VEVENT",
      `UID:${escapeIcsText(`${match.id}@arenaverse`)}`,
      `DTSTAMP:${formatIcsDate(generatedAt)}`,
      `DTSTART:${formatIcsDate(new Date(scheduledAt))}`,
      `SUMMARY:${escapeIcsText(summary)}`,
      `DESCRIPTION:${escapeIcsText(descriptionParts.join("\n"))}`,
      `URL:${escapeIcsText(pageUrl)}`,
      ...(location ? [`LOCATION:${escapeIcsText(location)}`] : []),
      "STATUS:CONFIRMED",
      "END:VEVENT",
    ];
  });

  return {
    content: [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//ArenaVerse//Tournament Schedule//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      `X-WR-CALNAME:${escapeIcsText(schedule.tournament.name)}`,
      ...events,
      "END:VCALENDAR",
      "",
    ].join("\r\n"),
    eventCount: scheduledMatches.length,
    fileName: calendarFileName(schedule.tournament.name),
  };
}

export function downloadCalendar(content: string, fileName: string) {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
