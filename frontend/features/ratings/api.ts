import { request } from "@/lib/api/client";
import type { AdminRatingList, Rating, RatingList } from "./types";
const base = (slug: string) =>
  `/tournaments/${encodeURIComponent(slug)}/ratings`;
export const ratingsApi = {
  list: (slug: string, page = 1) =>
    request<RatingList>(`${base(slug)}?page=${page}&limit=10`, {
      auth: true,
      cache: "no-store",
    }),
  save: (
    slug: string,
    data: { score: number; content: string },
    edit: boolean,
  ) =>
    request<Rating>(`${base(slug)}${edit ? "/me" : ""}`, {
      method: edit ? "PATCH" : "POST",
      body: JSON.stringify(data),
      auth: true,
    }),
  remove: (slug: string) =>
    request<{ deleted: boolean }>(`${base(slug)}/me`, {
      method: "DELETE",
      auth: true,
    }),
  adminList: (page: number, hidden: string) =>
    request<AdminRatingList>(
      `/admin/ratings?page=${page}&limit=10${hidden === "ALL" ? "" : `&isHidden=${hidden}`}`,
      { auth: true, cache: "no-store" },
    ),
  moderate: (id: string, isHidden: boolean, reason?: string) =>
    request<{ updated: boolean }>(
      `/admin/ratings/${encodeURIComponent(id)}/moderation`,
      {
        method: "PATCH",
        body: JSON.stringify({ isHidden, reason }),
        auth: true,
      },
    ),
};
