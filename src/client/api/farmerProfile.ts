import { z } from "zod";
import { FarmerProfileSchema, NameFarmerCommandSchema } from "../../schemas/farmerProfile";
import { developmentPlayerHeaders, DEVELOPMENT_PLAYERS_CHANGED } from "./developmentPlayer";

export const saveFarmerName = async (name: string) => {
  const command = NameFarmerCommandSchema.parse({ type: "name_farmer", name });
  const response = await fetch("/api/farmer/profile", { method: "POST", headers: { ...developmentPlayerHeaders(), "Content-Type": "application/json" }, body: JSON.stringify(command) });
  const data: unknown = await response.json();
  if (!response.ok) {
    const error = z.object({ error: z.object({ message: z.string() }) }).safeParse(data);
    throw new Error(error.success ? error.data.error.message : "Your farmer's name could not be saved.");
  }
  const profile = z.object({ profile: FarmerProfileSchema }).parse(data).profile;
  if (import.meta.env.DEV) window.dispatchEvent(new Event(DEVELOPMENT_PLAYERS_CHANGED));
  return profile;
};
