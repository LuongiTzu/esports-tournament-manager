import type { Game } from "@/features/games/types";
import { request } from "@/lib/api/client";

export const gamesApi = {
  findAll: () => request<Game[]>("/games"),
};
