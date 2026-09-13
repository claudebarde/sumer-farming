import { z } from "zod";

export const farmImprovementTypes = ["irrigation"] as const;

export const FarmImprovementTypeSchema = z.enum(farmImprovementTypes);

export type FarmImprovementType = z.infer<typeof FarmImprovementTypeSchema>;

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
