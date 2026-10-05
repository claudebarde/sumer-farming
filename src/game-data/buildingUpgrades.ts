import { z } from "zod";
import type { FarmBuildingType } from "./buildings";

export const BUILDING_UPGRADE_UNLOCK_LEVEL = 8;
export type UpgradeDefinition = Readonly<{ estateLevel: number; cost: number; durationMs: number; productionTimeMultiplier: number }>;
export const BUILDING_UPGRADES: Readonly<Partial<Record<FarmBuildingType, Readonly<Record<number, UpgradeDefinition>>>>> = {
  mill: {
    2: { estateLevel: 8, cost: 100, durationMs: 5 * 60_000, productionTimeMultiplier: 0.85 },
    3: { estateLevel: 10, cost: 200, durationMs: 10 * 60_000, productionTimeMultiplier: 0.7 }
  },
  breadOven: {
    2: { estateLevel: 9, cost: 100, durationMs: 5 * 60_000, productionTimeMultiplier: 0.85 },
    3: { estateLevel: 11, cost: 200, durationMs: 10 * 60_000, productionTimeMultiplier: 0.7 }
  },
  brewery: {
    2: { estateLevel: 9, cost: 100, durationMs: 5 * 60_000, productionTimeMultiplier: 0.85 },
    3: { estateLevel: 11, cost: 200, durationMs: 10 * 60_000, productionTimeMultiplier: 0.7 }
  }
};
export const BuildingUpgradeSchema = z.object({
  level: z.int().min(2), startedAt: z.iso.datetime(), completesAt: z.iso.datetime(), idempotencyKey: z.uuid()
});
// Completed entries also preserve payment identity across later upgrades and retries.
export const BuildingUpgradesSchema = z.record(z.string(), z.array(BuildingUpgradeSchema));
export type BuildingUpgrades = z.infer<typeof BuildingUpgradesSchema>;

export const activeBuildingUpgrade = (upgrades: BuildingUpgrades | undefined, id: string, now: number) =>
  upgrades?.[id]?.find(upgrade => Date.parse(upgrade.completesAt) > now);
export const buildingLevel = (upgrades: BuildingUpgrades | undefined, id: string, now: number): number =>
  (upgrades?.[id] ?? []).reduce((level, upgrade) => Date.parse(upgrade.completesAt) <= now ? Math.max(level, upgrade.level) : level, 1);
export const buildingProductionMultiplier = (type: FarmBuildingType, level: number): number =>
  BUILDING_UPGRADES[type]?.[level]?.productionTimeMultiplier ?? 1;
