import type { FarmSnapshot } from "../../../schemas/farm";
import { validateBrewerySupply, type BrewerySupplyAction } from "../../../game-core/farm/brewerySupplies";
import { validateBrewing } from "../../../game-core/farm/brewing";
import { activeBuildingUpgrade } from "../../../game-data/buildingUpgrades";
import { plantingBlocker } from "./isometricPlanting";
import { breweryLoadingCorner } from "../../../game-core/farm/roads";
import type { IsoCell } from "./isometricProjection";

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
  return !!building && !snapshot.farm.carriedItem && !snapshot.farm.production.pending[building.id] &&
    !activeBuildingUpgrade(snapshot.farm.production.buildingUpgrades, building.id, now) &&
    !validateBrewing(action, building, now, snapshot.inventory.find(i => i.itemKey === "brewersGroats")?.quantity ?? 0);
};

export const activeBrewingPreparation = (snapshot: FarmSnapshot, now: number) =>
  Object.values(snapshot.farm.production.brewing ?? {}).find(job => now < Date.parse(job.startedAt));
