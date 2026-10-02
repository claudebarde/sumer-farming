import { z } from "zod";

export const MillRecipeSchema = z.enum(["flour", "brewersGroats"]);
export type MillRecipe = z.infer<typeof MillRecipeSchema>;
export const MillWorkerSchema = z.enum(["farmer", "donkey"]);
export type MillWorker = z.infer<typeof MillWorkerSchema>;
// Temporary balance values; both paths count equally toward processing progress.
export const MILL_RECIPES = {
  flour: { label: "Flour", barley: 2, output: 1, durationMs: 5 * 60_000 },
  brewersGroats: { label: "Brewer's Groats", barley: 2, output: 1, durationMs: 5 * 60_000 }
} as const;
export const millRecipe = (recipe: MillRecipe, worker: MillWorker = "farmer") => {
  const base = MILL_RECIPES[recipe];
  const multiplier = worker === "donkey" ? 3 : 1;
  return { ...base, barley: base.barley * multiplier, output: base.output * multiplier, durationMs: base.durationMs * multiplier };
};
export const MillingJobSchema = z.object({
  worker: MillWorkerSchema.optional(),
  buildingId: z.uuid(), recipe: MillRecipeSchema,
  startedAt: z.iso.datetime(), completesAt: z.iso.datetime(),
  barley: z.int().positive(), output: z.int().positive()
});
export type MillingJob = z.infer<typeof MillingJobSchema>;
export const MillBagsSchema = z.object({ flour: z.int().nonnegative(), brewersGroats: z.int().nonnegative() });
export const MillGoodsSchema = z.object({
  pending: z.record(z.string(), MillBagsSchema),
  delivery: z.object({ millId: z.uuid(), bags: MillBagsSchema }).nullable()
});
export type MillGoods = z.infer<typeof MillGoodsSchema>;
export const emptyMillGoods = (): MillGoods => ({ pending: {}, delivery: null });
export const LEVEL_6_PROCESSED_BARLEY = 4;
export const LEVEL_6_PROCESSED_GOODS_OFFERING = 2;
