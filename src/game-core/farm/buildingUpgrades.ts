import type { FarmSnapshot } from "../../schemas/farm";
import { activeBuildingUpgrade, buildingLevel, BUILDING_UPGRADES } from "../../game-data/buildingUpgrades";

export const buildingUpgradeUnavailableReason = (snapshot: FarmSnapshot, buildingId: string, now: number): string | null => {
  const building = snapshot.buildings.find(b => b.id === buildingId);
  if (!building || !BUILDING_UPGRADES[building.type]) return "This building cannot be upgraded yet.";
  if (Date.parse(building.completesAt) > now) return "Finish constructing this building first.";
  const upgrades = snapshot.farm.production.buildingUpgrades;
  if (Object.keys(upgrades ?? {}).some(id => activeBuildingUpgrade(upgrades, id, now))) return "Finish the current building upgrade first.";
  if (snapshot.farm.milling?.buildingId === buildingId) return "Finish milling before upgrading.";
  if (snapshot.farm.production.baking[buildingId]) return "Finish baking before upgrading.";
  if (building.beerReadyAt && Date.parse(building.beerReadyAt) > now) return "Finish brewing before upgrading.";
  const next = BUILDING_UPGRADES[building.type]?.[buildingLevel(upgrades, buildingId, now) + 1];
  if (!next) return "Maximum building level reached.";
  if ((snapshot.farm.progression?.level ?? 1) < next.estateLevel) return `Unlock at estate level ${next.estateLevel}`;
  if (snapshot.player.shekelBalance < next.cost) return "Not enough shekels.";
  return null;
};
