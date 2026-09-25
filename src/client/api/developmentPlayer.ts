import { FarmSnapshotSchema } from "../../schemas/farm";

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
