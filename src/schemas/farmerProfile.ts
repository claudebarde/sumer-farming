import { z } from "zod";
import { FARMER_NAMES } from "../game-data/farmerNames";

export const FarmerNameSchema = z.enum(FARMER_NAMES);
// Versioned, typed sections allow future biography/personality fields without
// coupling identity to hunger, production jobs, or the player's account name.
export const FarmerProfileSchema = z.object({
  version: z.literal(1),
  identity: z.object({ name: FarmerNameSchema }).readonly()
}).readonly();
export type FarmerProfile = z.infer<typeof FarmerProfileSchema>;
export const NameFarmerCommandSchema = z.object({ type: z.literal("name_farmer"), name: FarmerNameSchema });
