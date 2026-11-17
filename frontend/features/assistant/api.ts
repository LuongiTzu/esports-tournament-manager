import { ApiError, request } from "@/lib/api/client";
export type AssistantPage =
  "discover" | "tournament" | "create" | "manage" | "general";
export interface AssistantProposal {
  kind: "create" | "update" | "publish" | "add_round" | "update_round";
  targetId?: string;
  slug?: string;
  targetName: string;
  gameName?: string;
  payload: Record<string, unknown>;
  before?: Record<string, unknown>;
}
export interface AssistantReply {
  message: string;
  sources?: { label: string; href: string }[];
  checkedAt?: string;
  searchSuggestionsHtml?: string;
  total?: number;
  filters?: Record<string, unknown>;
  tournaments?: {
    id: string;
    name: string;
    slug: string;
    game: string;
    mode: string;
    status: string;
    startDate: string | null;
  }[];
  proposal?: AssistantProposal;
}
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  reply?: AssistantReply;
}
export function chatWithArena(
  message: string,
  history: ChatMessage[],
  context: { page: AssistantPage; slug?: string },
  locale: "vi" | "en",
  signal: AbortSignal,
) {
  return request<AssistantReply>("/assistant/chat", {
    method: "POST",
    auth: true,
    signal,
    body: JSON.stringify({
      message,
      ...context,
      locale,
      history: history.slice(-10).map((m) => ({
        role: m.role,
        content: (
          m.content +
          (m.reply?.proposal
            ? `\nProposal (not saved): ${JSON.stringify(m.reply.proposal)}`
            : "") +
          (m.reply?.filters
            ? `\nSearch filters: ${JSON.stringify(m.reply.filters)}`
            : "")
        ).slice(0, 8000),
      })),
    }),
  });
}
export async function applyProposal(proposal: AssistantProposal) {
  if (proposal.kind === "publish") {
    const current = await request<{ id: string; status: string }>(
      `/tournaments/${encodeURIComponent(proposal.slug!)}`,
      { auth: true },
    );
    if (current.id !== proposal.targetId || current.status !== "DRAFT")
      throw new ApiError(
        "Giải không còn là bản nháp. Hãy kiểm tra trạng thái hiện tại trước khi thay đổi.",
        409,
      );
  }
  const path =
    proposal.kind === "create"
      ? "/tournaments"
      : proposal.kind === "update" || proposal.kind === "publish"
        ? `/tournaments/${encodeURIComponent(proposal.targetId!)}`
        : proposal.kind === "add_round"
          ? `/tournaments/${encodeURIComponent(proposal.slug!)}/rounds`
          : `/rounds/${encodeURIComponent(proposal.targetId!)}/settings`;
  return request<{ id: string; slug?: string }>(path, {
    method:
      proposal.kind === "create" || proposal.kind === "add_round"
        ? "POST"
        : "PATCH",
    auth: true,
    body: JSON.stringify(proposal.payload),
  });
}
