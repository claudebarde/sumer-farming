import { PlayerHomeSchema, PlayerProfileSchema } from "../../schemas/playerHome";
import { developmentPlayerHeaders } from "./developmentPlayer";

const read = async (path: string, playerId: string, signal?: AbortSignal) => {
  const response = await fetch(`/api/${path}?playerId=${encodeURIComponent(playerId)}`, {
    headers: developmentPlayerHeaders(), signal, cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok) throw new Error((data as { error?: { message?: string } }).error?.message ?? "This home is unavailable.");
  return data;
};
export const requestPlayerProfile = async (id: string, signal?: AbortSignal) =>
  PlayerProfileSchema.parse(await read("player-profile", id, signal));
export const requestPlayerHome = async (id: string, signal?: AbortSignal) =>
  PlayerHomeSchema.parse(await read("player-home", id, signal));
