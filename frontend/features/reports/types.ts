export const TOURNAMENT_REPORT_REASONS = [
  "MINOR_SAFETY",
  "HARASSMENT_OR_HATE",
  "VIOLENCE_OR_SELF_HARM",
  "GAMBLING",
  "RESTRICTED_GOODS",
  "ADULT_CONTENT",
  "SCAM",
  "INTELLECTUAL_PROPERTY",
  "SPAM_OR_MALICIOUS_LINKS",
  "INAPPROPRIATE_CONTENT",
  "OTHER",
] as const;

export type TournamentReportReason =
  (typeof TOURNAMENT_REPORT_REASONS)[number];

export interface CreateTournamentReportRequest {
  reason: TournamentReportReason;
  description?: string;
}

export interface TournamentReport {
  id: string;
  tournamentId: string;
  reason: TournamentReportReason;
  description: string | null;
  status: "PENDING" | "REVIEWED" | "DISMISSED";
  createdAt: string;
  pendingReportCount: number;
}
