import { FARM_BUILDING_DEFINITIONS, type FarmBuildingType } from "../../game-data/buildings";
import type { FarmSnapshot } from "../../schemas/farm";

/** Buildings explicitly required to claim the next estate level. */
export const progressionBuilding = (level: number): FarmBuildingType | null =>
  ({ 2: "granary", 5: "mill", 8: "warehouse" } as const)[level as 2 | 5 | 8] ?? null;

export const readyBuildings = (snapshot: {
  inventory: readonly { itemKey: string; quantity: number }[];
  groundItems: readonly { itemKey: string; quantity: number }[];
  buildings: readonly { type: FarmBuildingType }[];
}, level: number): readonly FarmBuildingType[] => {
  const unlocks = { granary: 2, mill: 5, brewery: 6, breadOven: 6, warehouse: 8, smallShrine: 8 } as const;
  const available = [...snapshot.inventory, ...snapshot.groundItems];
  return (Object.keys(unlocks) as FarmBuildingType[]).filter(building => level >= unlocks[building] &&
    !snapshot.buildings.some(b => b.type === building) &&
    Object.entries(FARM_BUILDING_DEFINITIONS[building].materials).every(([item, required]) =>
    available.filter(entry => entry.itemKey === item).reduce((sum, entry) => sum + entry.quantity, 0) >= required
  ));
};
export const readyProgressionBuilding = (snapshot: FarmSnapshot): FarmBuildingType | null =>
  readyBuildings(snapshot, snapshot.farm.progression?.level ?? 1)
    .toSorted((a, b) => Number(b === progressionBuilding(snapshot.farm.progression?.level ?? 1)) - Number(a === progressionBuilding(snapshot.farm.progression?.level ?? 1)))
    .find(building => !snapshot.farm.progression?.stats.buildingReadyAnnounced?.includes(building)) ?? null;

export const buildingReadinessText = (building: FarmBuildingType) => ({
  title: `Ready to build a ${building === "breadOven" ? "bread oven" : building === "smallShrine" ? "small shrine" : building}!`,
  description: `You have ${Object.entries(FARM_BUILDING_DEFINITIONS[building].materials)
    .map(([item, quantity]) => `${quantity} ${{ reed: "reeds", brewingVessels: "brewing jars", bakingTools: "baking tools" }[item] ?? item}`).join(" and ")}.`
});
