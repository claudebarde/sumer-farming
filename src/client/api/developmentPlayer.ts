import { FarmSnapshotSchema } from "../../schemas/farm";
import { z } from "zod";

export const DEVELOPMENT_PLAYERS_CHANGED = "development-players-changed";
export const fetchDevelopmentPlayers = async (signal?: AbortSignal) => {
  const response = await fetch("/api/development/players", { headers: developmentPlayerHeaders(), signal });
  if (!response.ok) throw new Error("Test player names could not be loaded.");
  return z.object({ players: z.array(z.object({ key: z.string(), name: z.string() })) }).parse(await response.json()).players;
};

export const developmentPlayerHeaders = (): Record<string, string> =>
  import.meta.env.DEV
    ? { "x-development-player": new URLSearchParams(window.location.search).get("devPlayer") ?? "primary" }
    : {};

export const fetchDevelopmentFarm = async (signal?: AbortSignal) => {
  const response = await fetch("/api/development/farm", {
    method: "POST", headers: developmentPlayerHeaders(), signal
  });
  if (!response.ok) throw new Error("The development farm could not be loaded");
  return FarmSnapshotSchema.parse(await response.json());
};
