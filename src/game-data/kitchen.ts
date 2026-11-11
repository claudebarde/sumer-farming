import { FurniturePlacementSchema } from "../schemas/homeFurniture";
import { z } from "zod";
import { ProductionJourneySchema } from "./productionJourney";

export const MEAL_KEYS = ["barleyCakes", "dateCakes", "sesameCakes", "porridge"] as const;
export const MealKeySchema = z.enum(MEAL_KEYS);
export type MealKey = z.infer<typeof MealKeySchema>;
export const COOKING_MS = 30_000;
export const MEALS = {
  barleyCakes: { name: "Oil-fried barley cakes", ingredients: { flour: 1, oil: 1 }, benefit: "Harvest barley and sesame 20% faster", durationMs: 20 * 60_000 },
  dateCakes: { name: "Date cakes", ingredients: { flour: 1, dates: 1 }, benefit: "Plant 2 extra fields per selection", durationMs: 20 * 60_000 },
  sesameCakes: { name: "Sesame cakes", ingredients: { flour: 1, sesame: 1, oil: 1 }, benefit: "Farmer milling and beer preparation 15% faster", durationMs: 20 * 60_000 },
  porridge: { name: "Date and sesame porridge", ingredients: { brewersGroats: 1, dates: 1, sesame: 1 }, benefit: "Hunger progresses 50% slower", durationMs: 60 * 60_000 }
} as const;
export const InteriorPositionSchema = z.object({ x: z.number().finite().min(0).max(1536), y: z.number().finite().min(0).max(1024) });
const CookingBaseSchema = z.object({ id: z.uuid(), buildingId: z.uuid(), meal: MealKeySchema,
  startedAt: z.iso.datetime(), completesAt: z.iso.datetime() });
export const CookingSchema = z.union([
  CookingBaseSchema.extend({ preparation: ProductionJourneySchema, interior: z.undefined().optional() }),
  CookingBaseSchema.extend({ preparation: z.undefined().optional(), interior: z.object({
    farmApproach: z.object({ departedAt: z.number(), path: z.array(z.object({ column: z.int(), row: z.int() })).min(1) }).optional(),
    kitchen: FurniturePlacementSchema, departedAt: z.number(), path: z.array(InteriorPositionSchema).min(2)
  }) })
]);
export const MealBenefitSchema = z.object({ meal: MealKeySchema, startedAt: z.number(), expiresAt: z.number() });
export type MealBenefit = z.infer<typeof MealBenefitSchema>;
export type Cooking = z.infer<typeof CookingSchema>;
export const activeMeal = (benefit: MealBenefit | null | undefined, now: number): MealKey | null =>
  benefit && now >= benefit.startedAt && now < benefit.expiresAt ? benefit.meal : null;
/** Faster means more work per second; travel and unattended production are unchanged. */
export const harvestMealMultiplier = (benefit: MealBenefit | null | undefined, now: number) => activeMeal(benefit, now) === "barleyCakes" ? 1 / 1.2 : 1;
export const productionMealMultiplier = (benefit: MealBenefit | null | undefined, now: number) => activeMeal(benefit, now) === "sesameCakes" ? 1 / 1.15 : 1;
export const plantingMealBonus = (benefit: MealBenefit | null | undefined, now: number) => activeMeal(benefit, now) === "dateCakes" ? 2 : 0;

/** Translate the next ration deadline when replacing a food effect. The normal
 * ration interval exceeds the one-hour benefit, so at most one ration is affected.
 * Revoking only the unelapsed portion preserves all hunger credit already earned. */
export const mealRationDeadline = (deadline: number | null, previous: MealBenefit | null | undefined, next: MealBenefit, now: number): number | null => {
  if (deadline === null || deadline <= now) return deadline;
  let result = deadline;
  if (activeMeal(previous, now) === "porridge") result -= Math.max(0, Math.min(result, previous!.expiresAt) - now) * 0.5;
  if (next.meal === "porridge") result += Math.min(result - now, (next.expiresAt - now) * 0.5);
  return result;
};
