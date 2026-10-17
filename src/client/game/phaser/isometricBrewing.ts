import type { FarmSnapshot } from "../../../schemas/farm";
import { validateBrewerySupply, type BrewerySupplyAction } from "../../../game-core/farm/brewerySupplies";
import { validateBrewing } from "../../../game-core/farm/brewing";
import { activeBuildingUpgrade } from "../../../game-data/buildingUpgrades";
import { plantingBlocker } from "./isometricPlanting";
import { breweryLoadingCorner } from "../../../game-core/farm/roads";
import type { IsoCell } from "./isometricProjection";
import { INITIAL_FARM_CONFIG } from "../../../game-data/initialFarm";
import { productionOutputFits } from "../../../game-core/farm/productionOutputCapacity";
import { BEER_RECIPE } from "../../../game-data/brewing";

/** Find nearby safe ground for discarding water, even when standing over a crop. */
export const waterPourTarget = (snapshot: FarmSnapshot, position: IsoCell, now: number): IsoCell | null => {
  const bounds = INITIAL_FARM_CONFIG.worldBounds;
  const candidates: IsoCell[] = [];
  for (let row = bounds.minimumRow; row <= bounds.maximumRow; row++) {
    for (let column = bounds.minimumColumn; column <= bounds.maximumColumn; column++) {
      const target = { column, row };
      if (!validateBrewerySupply({ ...snapshot, target, action: "pour_water", now, carriedItem: snapshot.farm.carriedItem })) candidates.push(target);
    }
  }
  return candidates.sort((a, b) => (a.column - position.column) ** 2 + (a.row - position.row) ** 2
    - (b.column - position.column) ** 2 - (b.row - position.row) ** 2)[0] ?? null;
};

export const breweryOutputPlacement = (building: IsoCell & { loadingTile?: IsoCell | null }) => ({
  tile: building.loadingTile && breweryLoadingCorner(building, building.loadingTile) === "C"
    ? { column: building.column + 1, row: building.row } : { column: building.column, row: building.row + 1 },
  pickup: building.loadingTile ?? null,
});

export const canSupplyBrewery = (snapshot: FarmSnapshot, target: IsoCell, action: BrewerySupplyAction, now: number) => {
  if ((snapshot.farm.progression?.level ?? 1) < 6 || plantingBlocker({ ...snapshot, farm: { ...snapshot.farm, carriedItem: null } }, now)) return false;
  if (validateBrewerySupply({ ...snapshot, target, action, now, carriedItem: snapshot.farm.carriedItem })) return false;
  if (action !== "start_brewing") return true;
  const building = snapshot.buildings.find(b => b.type === "brewery" && b.column === target.column && b.row === target.row);
  return !!building && !snapshot.farm.carriedItem && productionOutputFits(snapshot.farm, building.id, BEER_RECIPE.output) &&
    !activeBuildingUpgrade(snapshot.farm.production.buildingUpgrades, building.id, now) &&
    !validateBrewing(action, building, now, snapshot.inventory.find(i => i.itemKey === "brewersGroats")?.quantity ?? 0);
};

export const activeBrewingPreparation = (snapshot: FarmSnapshot, now: number) =>
  Object.values(snapshot.farm.production.brewing ?? {}).find(job => now < Date.parse(job.startedAt));
