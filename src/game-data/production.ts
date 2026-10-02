import { z } from "zod";
import { BatchPlantingSchema } from "./batchPlanting";

export const BREAD_RECIPE = { flour: 2, output: 2, durationMs: 5 * 60_000 } as const;
export const ProductionStackSchema = z.object({ itemKey: z.enum(["beer", "bread"]), quantity: z.int().positive() });
export const ProductionStateSchema = z.object({
  planting: BatchPlantingSchema.nullable().optional(),
  pending: z.record(z.string(), ProductionStackSchema),
  delivery: ProductionStackSchema.extend({ buildingId: z.uuid() }).nullable(),
  baking: z.record(z.string(), z.object({ startedAt: z.iso.datetime(), completesAt: z.iso.datetime(), output: z.int().positive() }))
});
export type ProductionState = z.infer<typeof ProductionStateSchema>;
export const emptyProductionState = (): ProductionState => ({ pending: {}, delivery: null, baking: {} });
