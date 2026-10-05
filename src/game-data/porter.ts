import { z } from "zod";
import { WORKER_MOVE_DURATION_PER_TILE } from "./movement";

export const PORTER_COST = 20;
export const PORTER_HIRE_MS = 24 * 60 * 60_000;
export const PORTER_STEP_MS = WORKER_MOVE_DURATION_PER_TILE;
export const PorterItemSchema = z.enum(["flour", "brewersGroats", "bread", "beer"]);
const Position = z.object({ column: z.number(), row: z.number() });
export const PorterSchema = z.object({
  hiredAt: z.number(), expiresAt: z.number(), checkedAt: z.number(), position: Position,
  job: z.object({
    buildingId: z.string(), itemKey: PorterItemSchema, quantity: z.int().positive(),
    startedAt: z.number(), pickupAt: z.number(), completesAt: z.number(),
    path: z.array(Position), pickupIndex: z.int().nonnegative()
  }).nullable()
});
export type Porter = z.infer<typeof PorterSchema>;
export type PorterItem = z.infer<typeof PorterItemSchema>;
export const porterReserved = (porter: Porter | null | undefined, item: string): number => porter?.job?.itemKey === item ? porter.job.quantity : 0;
