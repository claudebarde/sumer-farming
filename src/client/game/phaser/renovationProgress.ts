import { activeBuildingUpgrade, type BuildingUpgrades } from "../../../game-data/buildingUpgrades";

/** Presentation of saved server timestamps; never starts or completes an upgrade. */
export const renovationProgress = (upgrades: BuildingUpgrades | undefined, id: string, now: number) => {
  const upgrade = activeBuildingUpgrade(upgrades, id, now);
  if (!upgrade) return null;
  const start = Date.parse(upgrade.startedAt), end = Date.parse(upgrade.completesAt);
  if (now < start) return null;
  return { fraction: Math.max(0, Math.min(1, (now - start) / Math.max(1, end - start))) };
};
