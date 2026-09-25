import { z } from "zod";

export const NpcRequestsSchema = z.object({
  serverNow: z.iso.datetime(),
  cycle: z.int().nonnegative(),
  open: z.boolean(),
  closesAt: z.iso.datetime(),
  nextOpensAt: z.iso.datetime(),
  stock: z.object({ barley: z.int().nonnegative(), beer: z.int().nonnegative() }),
  requests: z.array(z.object({
    slot: z.int().min(0).max(2), customer: z.string(), description: z.string(),
    barley: z.int().nonnegative(), beer: z.int().nonnegative(), reward: z.int().positive(),
    completed: z.boolean()
  }))
});
export type NpcRequests = z.infer<typeof NpcRequestsSchema>;
