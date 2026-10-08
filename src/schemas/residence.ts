import { z } from "zod";
import { SUMER_CITIES } from "../game-data/sumer";

export const CitySchema = z.enum(SUMER_CITIES.map(city => city.id));
export const ResidenceCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("settle"), city: CitySchema })
]);
export type ResidenceCommand = z.infer<typeof ResidenceCommandSchema>;
export const ResidenceSchema = z.object({
  city: CitySchema, neighbourhoodId: z.uuid(), name: z.string(),
  private: z.boolean(), members: z.number().int().min(1).max(10), inviteCode: z.uuid().nullable()
});
export type Residence = z.infer<typeof ResidenceSchema>;
