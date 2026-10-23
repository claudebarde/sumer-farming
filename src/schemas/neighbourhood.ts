import { z } from "zod";

export const NeighbourhoodMemberSchema = z.object({
  slot: z.number().int().min(1).max(10),
  name: z.string(), level: z.number().int().positive(), isYou: z.boolean(),
});
export const NeighbourhoodSchema = z.object({
  members: z.array(NeighbourhoodMemberSchema).min(1).max(10),
}).refine(value => new Set(value.members.map(m => m.slot)).size === value.members.length &&
  value.members.filter(m => m.isYou).length === 1, "Invalid neighbourhood slots");
export type Neighbourhood = z.infer<typeof NeighbourhoodSchema>;
