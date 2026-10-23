import { NeighbourhoodSchema } from "../../schemas/neighbourhood";
import { developmentPlayerHeaders } from "./developmentPlayer";

export const requestNeighbourhood = async (signal: AbortSignal) => {
  const response = await fetch("/api/neighbourhood", { headers: developmentPlayerHeaders(), signal, cache: "no-store" });
  if (!response.ok) throw new Error("Unable to load your neighbourhood. Please try again.");
  return NeighbourhoodSchema.parse(await response.json());
};
