import { z } from "zod";
import { HomeAppearanceSchema } from "./homeAppearance";

export { HomeVisibilitySchema, type HomeVisibility } from "./homeAppearance";
export const PlayerHomeQuerySchema = z.object({ playerId: z.string().uuid() });
export const PlayerProfileSchema = z.object({
  playerId: z.string().uuid(),
  name: z.string(),
  level: z.number().int().positive(),
  neighbourhood: z.string(),
  zigguratPatron: z.boolean(),
  canVisit: z.boolean(),
  unavailableReason: z.string().nullable(),
});
export type PlayerProfile = z.infer<typeof PlayerProfileSchema>;
export const PlayerHomeSchema = z.object({
  profile: PlayerProfileSchema,
  appearance: HomeAppearanceSchema.pick({ furniture: true, wallTablet: true }),
});
export type PlayerHome = z.infer<typeof PlayerHomeSchema>;
