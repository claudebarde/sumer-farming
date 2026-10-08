import { LeaderboardResponseSchema, type LeaderboardQuery } from "../../schemas/leaderboard";
import { developmentPlayerHeaders } from "./developmentPlayer";

export const requestLeaderboard = async (query: LeaderboardQuery, signal?: AbortSignal) => {
  const response = await fetch(`/api/leaderboard?${new URLSearchParams(query)}`, {
    headers: developmentPlayerHeaders(), signal, cache: "no-store"
  });
  if (!response.ok) throw new Error("The leaderboard could not be loaded. Please try again.");
  return LeaderboardResponseSchema.parse(await response.json());
};
