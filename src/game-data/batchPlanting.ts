import { z } from "zod";

export const FieldCoordinateSchema = z.object({ column: z.int(), row: z.int() });
export const MAX_BATCH_HARVEST_FIELDS = 4;
// Kept in the original planting JSON slot for backwards-compatible saved jobs.
export const BatchPlantingSchema = z.object({
  mode: z.enum(["plant", "harvest"]).optional(),
  id: z.uuid(),
  total: z.int().positive(),
  remaining: z.array(FieldCoordinateSchema),
  carriedSeeds: z.object({ quantity: z.int().nonnegative(), expiresAt: z.iso.datetime().nullable() }).optional(),
  // Server deadlines keep the queue progressing when rendering is suspended.
  nextStepAt: z.iso.datetime().optional(),
  travelMs: z.array(z.number().nonnegative()).optional(),
  source: FieldCoordinateSchema.extend({ type: z.enum(["farm", "granary"]) }),
  stopRequested: z.boolean(),
  phase: z.discriminatedUnion("type", [
    z.object({ type: z.literal("collecting") }),
    z.object({ type: z.literal("ready") }),
    z.object({ type: z.literal("sowing"), target: FieldCoordinateSchema, completesAt: z.iso.datetime() }),
    z.object({ type: z.literal("harvesting"), target: FieldCoordinateSchema, completesAt: z.iso.datetime() })
  ])
});
export type BatchPlanting = z.infer<typeof BatchPlantingSchema>;
