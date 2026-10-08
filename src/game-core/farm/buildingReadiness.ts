import { FARM_BUILDING_DEFINITIONS, type FarmBuildingType } from "../../game-data/buildings";
import type { FarmSnapshot } from "../../schemas/farm";

/** Buildings explicitly required to claim the next estate level. */
export const progressionBuilding = (level: number): FarmBuildingType | null =>
  ({ 2: "granary", 5: "mill", 8: "warehouse" } as const)[level as 2 | 5 | 8] ?? null;

export const readyProgressionBuilding = (snapshot: FarmSnapshot): FarmBuildingType | null => {
  const building = progressionBuilding(snapshot.farm.progression?.level ?? 1);
  if (!building || snapshot.farm.progression?.stats.buildingReadyAnnounced?.includes(building) ||
    snapshot.buildings.some(b => b.type === building)) return null;
  // These required buildings use reed/clay from estate inventory and ground stacks.
  // Carried goods are not accepted by construction until deposited.
  const available = [...snapshot.inventory, ...snapshot.groundItems];
  return Object.entries(FARM_BUILDING_DEFINITIONS[building].materials).every(([item, required]) =>
    available.filter(entry => entry.itemKey === item).reduce((sum, entry) => sum + entry.quantity, 0) >= required
  ) ? building : null;
};

export const buildingReadinessText = (building: FarmBuildingType) => ({
  title: `Ready to build a ${building === "breadOven" ? "bread oven" : building === "smallShrine" ? "small shrine" : building}!`,
  description: `You have ${Object.entries(FARM_BUILDING_DEFINITIONS[building].materials)
    .map(([item, quantity]) => `${quantity} ${item === "reed" ? "reeds" : item}`).join(" and ")}.`
});
