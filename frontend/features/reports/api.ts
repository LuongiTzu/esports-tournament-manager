import type {
  CreateTournamentReportRequest,
  TournamentReport,
} from "@/features/reports/types";
import { request } from "@/lib/api/client";

export const reportsApi = {
  createTournamentReport: (
    slug: string,
    payload: CreateTournamentReportRequest,
  ) =>
    request<TournamentReport>(`/tournaments/${slug}/reports`, {
      method: "POST",
      body: JSON.stringify(payload),
      auth: true,
    }),
};
