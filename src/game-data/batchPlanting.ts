import { z } from "zod";

export const FieldCoordinateSchema = z.object({ column: z.int(), row: z.int() });
export const MAX_BATCH_HARVEST_FIELDS = 8;
export const LEGACY_BATCH_HARVEST_FIELDS = 4;
// Kept in the original planting JSON slot for backwards-compatible saved jobs.
export const BatchPlantingSchema = z.object({
  mode: z.enum(["plant", "harvest"]).optional(),
  id: z.uuid(),
  total: z.int().positive(),
  // Captured by the server at start; later happiness changes never shrink a job.
  harvestFieldLimit: z.union([z.literal(4), z.literal(6), z.literal(8)]).optional(),
  remaining: z.array(FieldCoordinateSchema),
  carriedSeeds: z.object({ quantity: z.int().nonnegative(), expiresAt: z.iso.datetime().nullable() }).optional(),
  // Server deadlines keep the queue progressing when rendering is suspended.
  nextStepAt: z.iso.datetime().optional(),
  travelMs: z.array(z.number().nonnegative()).optional(),
  travelPaths: z.array(z.array(FieldCoordinateSchema).min(1)).optional(),
  collectionPath: z.array(FieldCoordinateSchema).min(1).optional(),
  // Walking time only; any remaining collection phase is a stationary pause.
  collectionTravelMs: z.number().nonnegative().optional(),
  travelStartedAt: z.iso.datetime().optional(),
  lastHarvested: FieldCoordinateSchema.optional(),
  source: FieldCoordinateSchema.extend({ type: z.enum(["farm", "granary"]) }),
  stopRequested: z.boolean(),
  phase: z.discriminatedUnion("type", [
    // Null identifies a farm-house fallback leg; existing granary saves remain valid.
    z.object({ type: z.literal("delivering"), granaryId: z.uuid().nullable(), path: z.array(FieldCoordinateSchema).min(1),
      startedAt: z.iso.datetime(), completesAt: z.iso.datetime() }),
    z.object({ type: z.literal("collecting") }),
    z.object({ type: z.literal("ready") }),
    z.object({ type: z.literal("sowing"), target: FieldCoordinateSchema, completesAt: z.iso.datetime() }),
    z.object({ type: z.literal("harvesting"), target: FieldCoordinateSchema, completesAt: z.iso.datetime() })
  ])
});
export type BatchPlanting = z.infer<typeof BatchPlantingSchema>;
