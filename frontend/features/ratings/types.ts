import type { Pagination } from "@/shared/types/pagination";

export interface Rating {
  id: string;
  score: number;
  content: string | null;
  createdAt: string;
  updatedAt: string;
  author: { id: string; displayName: string; avatarUrl: string | null };
}
export interface OwnRating extends Rating {
  isHidden: boolean;
  moderationReason: string | null;
}
export type RatingReason =
  | "ALLOWED"
  | "LOGIN_REQUIRED"
  | "VERIFY_EMAIL"
  | "ORGANIZER"
  | "NOT_COMPLETED"
  | "NOT_PARTICIPANT";
export interface RatingList {
  data: Rating[];
  summary: { average: number | null; count: number };
  mine: OwnRating | null;
  eligibility: {
    reason: RatingReason;
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
  };
  pagination: Pagination;
}
export interface AdminRating extends OwnRating {
  tournament: { id: string; name: string; slug: string };
  moderatedAt: string | null;
}
export interface AdminRatingList {
  data: AdminRating[];
  pagination: Pagination;
}
