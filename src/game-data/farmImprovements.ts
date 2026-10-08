import { z } from "zod";

export const farmImprovementTypes = ["irrigation"] as const;

export const FarmImprovementTypeSchema = z.enum(farmImprovementTypes);

export type FarmImprovementType = z.infer<typeof FarmImprovementTypeSchema>;

type ImprovementTiming = { readonly completesAt: string; readonly destroyCompletesAt: string | null };
export const improvementIsPresent = (improvement: ImprovementTiming, now: number): boolean =>
  improvement.destroyCompletesAt === null || Date.parse(improvement.destroyCompletesAt) > now;

export const improvementWorkActive = (improvement: ImprovementTiming, now: number): boolean =>
  improvementIsPresent(improvement, now) &&
  (Date.parse(improvement.completesAt) > now || improvement.destroyCompletesAt !== null);

export const FARM_IMPROVEMENT_DEFINITIONS = {
  irrigation: {
    constructionDurationMs: 5_000,
    destructionDurationMs: 5_000
  }
} as const satisfies Record<
  FarmImprovementType,
  {
    readonly constructionDurationMs: number;
    readonly destructionDurationMs: number;
  }
>;
