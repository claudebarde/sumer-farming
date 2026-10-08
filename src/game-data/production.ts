import { z } from "zod";
import { CropWorkSchema } from "./cropWork";
import { ProductionJourneySchema } from "./productionJourney";
import { BatchPlantingSchema } from "./batchPlanting";
import { PorterSchema } from "./porter";
import { BuildingUpgradesSchema } from "./buildingUpgrades";

export const BREAD_RECIPE = { flour: 2, output: 2, durationMs: 5 * 60_000 } as const;
export const ProductionStackSchema = z.object({ itemKey: z.enum(["beer", "bread"]), quantity: z.int().positive() });
export const ProductionStateSchema = z.object({
  cropWork: CropWorkSchema.nullable().optional(),
  cropYields: z.record(z.string(), z.int().nonnegative()).optional(),
  lastDatesAt: z.iso.datetime().nullable().optional(),
  lastHarvestDelivery: z.object({ batchId: z.uuid(), target: z.object({ column: z.int(), row: z.int() }),
    completedAt: z.iso.datetime(), stored: z.int().nonnegative(), remaining: z.int().nonnegative() }).optional(),
  buildingUpgrades: BuildingUpgradesSchema.optional(),
  porter: PorterSchema.nullable().optional(),
  materialDelivery: z.boolean().optional(),
  // One slot held from gathering start until the gathered material is delivered.
  materialReservation: z.enum(["reed", "clay"]).nullable().optional(),
  shrineBlessing: z.object({ buildingId: z.uuid(), startedAt: z.iso.datetime(), expiresAt: z.iso.datetime() }).nullable().optional(),
  planting: BatchPlantingSchema.nullable().optional(),
  pending: z.record(z.string(), ProductionStackSchema),
  delivery: ProductionStackSchema.extend({ buildingId: z.uuid() }).nullable(),
  baking: z.record(z.string(), z.object({ preparation: ProductionJourneySchema.optional(), startedAt: z.iso.datetime(), completesAt: z.iso.datetime(), output: z.int().positive() }))
});
export type ProductionState = z.infer<typeof ProductionStateSchema>;
export const emptyProductionState = (): ProductionState => ({ pending: {}, delivery: null, baking: {} });
