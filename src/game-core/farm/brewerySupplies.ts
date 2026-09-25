import { BREWERY_WATER_CAPACITY, BREWERY_EMPTY_JAR_CAPACITY, BEER_RECIPE } from "../../game-data/brewing";
import { INITIAL_FARM_CONFIG } from "../../game-data/initialFarm";
import { getBuildingFootprint, type BuildingCoordinate } from "./buildings";
import type { FarmBuildingType } from "../../game-data/buildings";

export type BrewerySupplyAction = "collect_water" | "pour_water" | "deliver" | "stock_jars" | "start_brewing" | "collect_beer" | "give_beer";
export const brewerySupplyErrors = {
  brewery_unavailable: "A completed brewery is required.",
  no_empty_jars: "Buy empty beer jars from the NPC market first.",
  jar_transfer_hands_full: "Empty your hands before transferring jars.",
  hands_not_empty: "Empty your hands before collecting water.",
  not_at_river: "Collect water from the river.",
  not_carrying_water: "The farmer is not carrying water.",
  invalid_pour_target: "Pour water onto ground, an irrigation canal, or the river.",
  wrong_supply: "Bring barley or water to the brewery.",
  brewery_full: "The brewery has no space for this delivery.",
  outside_world: "That tile is outside the farm world."
} as const;
export type BrewerySupplyRule = keyof typeof brewerySupplyErrors;
type Building = BuildingCoordinate & {
  readonly id: string; readonly type: FarmBuildingType; readonly completesAt: string;
  readonly brewingBarley: number; readonly brewingWater: number;
  readonly emptyBeerJars: number;
};

export const validateBrewerySupply = (context: {
  readonly action: BrewerySupplyAction;
  readonly target: BuildingCoordinate;
  readonly now: number;
  readonly carriedItem: { readonly itemKey: string; readonly quantity: number } | null;
  readonly buildings: readonly Building[];
  readonly crops: readonly BuildingCoordinate[];
  readonly groundItems: readonly BuildingCoordinate[];
  readonly objects: readonly BuildingCoordinate[];
  readonly inventory?: readonly { readonly itemKey: string; readonly quantity: number }[];
}): BrewerySupplyRule | null => {
  const { target, carriedItem, buildings, now } = context;
  const { worldBounds, buildingBounds, riverRow } = INITIAL_FARM_CONFIG;
  const same = (tile: BuildingCoordinate): boolean => tile.column === target.column && tile.row === target.row;
  if (target.column < worldBounds.minimumColumn || target.column > worldBounds.maximumColumn ||
      target.row < worldBounds.minimumRow || target.row > worldBounds.maximumRow) return "outside_world";
  if (context.action === "collect_water") {
    if (!buildings.some(building => building.type === "brewery" && Date.parse(building.completesAt) <= now)) return "brewery_unavailable";
    if (carriedItem !== null) return "hands_not_empty";
    return target.row === riverRow ? null : "not_at_river";
  }
  if (context.action === "pour_water") {
    if (carriedItem?.itemKey !== "water") return "not_carrying_water";
    const onFarm = target.column >= buildingBounds.minimumColumn && target.column <= buildingBounds.maximumColumn &&
      target.row >= buildingBounds.minimumRow && target.row <= buildingBounds.maximumRow;
    if (onFarm || buildings.some(building => getBuildingFootprint(building.type, building).some(same)) ||
        [...context.crops, ...context.groundItems, ...context.objects].some(same)) return "invalid_pour_target";
    return null;
  }
  const brewery = buildings.find(building => building.type === "brewery" && same(building));
  if (brewery === undefined || Date.parse(brewery.completesAt) > now) return "brewery_unavailable";
  if (context.action === "start_brewing" || context.action === "collect_beer" || context.action === "give_beer") return null;
  if (context.action === "stock_jars") {
    if (carriedItem !== null) return "jar_transfer_hands_full";
    if (brewery.emptyBeerJars >= BREWERY_EMPTY_JAR_CAPACITY) return "brewery_full";
    return (context.inventory?.find(item => item.itemKey === "emptyBeerJar")?.quantity ?? 0) > 0 ? null : "no_empty_jars";
  }
  if (carriedItem === null || (carriedItem.itemKey !== "barley" && carriedItem.itemKey !== "water")) return "wrong_supply";
  const space = carriedItem.itemKey === "water" ? BREWERY_WATER_CAPACITY - brewery.brewingWater : BEER_RECIPE.barley - brewery.brewingBarley;
  return carriedItem.quantity > space ? "brewery_full" : null;
};
