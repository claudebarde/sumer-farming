import { z } from "zod";

const extraGoods = {
  flour: z.int().nonnegative().optional(), brewersGroats: z.int().nonnegative().optional(),
  bread: z.int().nonnegative().optional(), dates: z.int().nonnegative().optional(),
  sesame: z.int().nonnegative().optional(), oil: z.int().nonnegative().optional(),
};

export const NpcRequestsSchema = z.object({
  serverNow: z.iso.datetime(),
  cycle: z.int().nonnegative(),
  open: z.boolean(),
  closesAt: z.iso.datetime(),
  nextOpensAt: z.iso.datetime(),
  stock: z.object({ ...extraGoods, barley: z.int().nonnegative(), beer: z.int().nonnegative() }),
  requests: z.array(z.object({
    ...extraGoods, slot: z.int().min(0).max(2), customer: z.string(), description: z.string(),
    barley: z.int().nonnegative(), beer: z.int().nonnegative(), reward: z.int().positive(),
    completed: z.boolean()
  }))
});
export type NpcRequests = z.infer<typeof NpcRequestsSchema>;
