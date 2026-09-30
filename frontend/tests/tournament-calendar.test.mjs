import assert from "node:assert/strict";
import test from "node:test";
import { createTournamentCalendar } from "../features/tournaments/calendar.ts";

const baseSchedule = {
  tournament: { id: "tournament-1", name: "Cúp Mùa Hè", slug: "cup-mua-he" },
  rounds: [
    {
      id: "round-1",
      name: "Vòng bảng; A",
      orderIndex: 0,
      dates: [
        {
          date: "2026-10-10",
          matches: [
            {
              id: "match-1",
              status: "PENDING",
              isActive: true,
              isBye: false,
              bestOf: 3,
              bracketRound: 1,
              matchNumber: 1,
              scheduledAt: "2026-10-10T12:30:00.000Z",
              discordLink: "https://discord.gg/arena",
              teamA: { id: "a", name: "Alpha, One" },
              teamB: { id: "b", name: "Beta" },
            },
            {
              id: "match-bye",
              status: "COMPLETED",
              isActive: true,
              isBye: true,
              bestOf: 1,
              bracketRound: 1,
              matchNumber: 2,
              scheduledAt: "2026-10-10T13:30:00.000Z",
              discordLink: null,
              teamA: { id: "a", name: "Alpha" },
              teamB: null,
            },
            {
              id: "match-unscheduled",
              status: "PENDING",
              isActive: true,
              isBye: false,
              bestOf: 1,
              bracketRound: 1,
              matchNumber: 3,
              scheduledAt: null,
              discordLink: null,
              teamA: null,
              teamB: null,
            },
          ],
        },
      ],
    },
  ],
};

test("creates one calendar event for each scheduled playable match", () => {
  const result = createTournamentCalendar({
    schedule: baseSchedule,
    pageUrl: "https://arena.example/tournaments/cup-mua-he",
    location: "Hà Nội, Việt Nam",
    generatedAt: new Date("2026-09-30T00:00:00.000Z"),
    copy: {
      awaitingTeam: "Chờ xác định",
      bestOf: "Best of",
      round: "Giai đoạn",
      versus: "gặp",
    },
  });

  assert.equal(result.eventCount, 1);
  assert.equal(result.fileName, "cup-mua-he-schedule.ics");
  assert.match(result.content, /DTSTART:20261010T123000Z/);
  assert.match(result.content, /SUMMARY:Alpha\\, One gặp Beta — Cúp Mùa Hè/);
  assert.match(result.content, /Giai đoạn: Vòng bảng\\; A/);
  assert.match(result.content, /https:\/\/discord\.gg\/arena/);
  assert.match(result.content, /LOCATION:Hà Nội\\, Việt Nam/);
  assert.doesNotMatch(result.content, /match-bye@arenaverse/);
  assert.doesNotMatch(result.content, /match-unscheduled@arenaverse/);
  assert.ok(result.content.endsWith("END:VCALENDAR\r\n"));
});

test("returns an empty calendar when no match has a schedule", () => {
  const result = createTournamentCalendar({
    schedule: {
      ...baseSchedule,
      rounds: baseSchedule.rounds.map((round) => ({
        ...round,
        dates: round.dates.map((date) => ({
          ...date,
          matches: date.matches.map((match) => ({
            ...match,
            scheduledAt: null,
          })),
        })),
      })),
    },
    pageUrl: "https://arena.example/tournaments/cup-mua-he",
    copy: {
      awaitingTeam: "TBD",
      bestOf: "Best of",
      round: "Round",
      versus: "vs",
    },
  });

  assert.equal(result.eventCount, 0);
  assert.doesNotMatch(result.content, /BEGIN:VEVENT/);
});
