"use client";

import { useEffect, useRef } from "react";
import { useTournamentRealtime } from "@/features/realtime/provider";
import type { TournamentRealtimeEvent } from "@/features/realtime/types";

const COMPETITION_REFRESH_EVENTS: ReadonlySet<TournamentRealtimeEvent> =
  new Set([
    "matchUpdated",
    "scheduleUpdated",
    "bracketGenerated",
    "teamApproved",
    "standingsUpdated",
  ]);

export function useCompetitionInvalidation(
  tournamentId: string,
  onInvalidate: () => void,
) {
  const invalidateRef = useRef(onInvalidate);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    invalidateRef.current = onInvalidate;
  }, [onInvalidate]);

  useTournamentRealtime(tournamentId, (event) => {
    if (!COMPETITION_REFRESH_EVENTS.has(event)) return;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => invalidateRef.current(), 150);
  });

  useEffect(
    () => () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    },
    [],
  );
}
