import type { FarmSnapshot } from "../../schemas/farm";
import { INITIAL_FARM_CONFIG } from "../../game-data/initialFarm";
import { getBuildingFootprint } from "./buildings";
import { validateCultivation } from "./cultivation";
import type { FarmCoordinate } from "./irrigation";

export const fieldKey = (p: FarmCoordinate) => `${p.column}:${p.row}`;

export const harvestableFields = (snapshot: FarmSnapshot, now: number): readonly FarmCoordinate[] =>
  snapshot.crops.filter(c => c.cropKey === "barley" && Date.parse(c.growthCompletesAt) <= now && c.harvestStartedAt === null)
    .map(({ column, row }) => ({ column, row }));

export const plantableFields = (snapshot: FarmSnapshot, now: number): readonly FarmCoordinate[] => {
  const { plotBounds: plot, buildingBounds: home } = INITIAL_FARM_CONFIG;
  const homeTiles = Array.from({ length: (home.maximumColumn - home.minimumColumn + 1) * (home.maximumRow - home.minimumRow + 1) }, (_, i) => ({
    column: home.minimumColumn + i % (home.maximumColumn - home.minimumColumn + 1),
    row: home.minimumRow + Math.floor(i / (home.maximumColumn - home.minimumColumn + 1))
  }));
  const occupiedCoordinates = [...homeTiles, ...snapshot.farm.roads, ...snapshot.objects,
    ...snapshot.groundItems, ...snapshot.crops, ...snapshot.improvements,
    ...snapshot.buildings.flatMap(b => getBuildingFootprint(b.type, b))];
  const activeCanals = snapshot.improvements.filter(i => i.type === "irrigation" && Date.parse(i.completesAt) <= now && i.destroyCompletesAt === null);
  const fields: FarmCoordinate[] = [];
  for (let row = plot.minimumRow; row <= plot.maximumRow; row++) {
    for (let column = plot.minimumColumn; column <= plot.maximumColumn; column++) {
      const target = { column, row };
      if (validateCultivation({ target, crop: "barley", carriedItem: "barley", occupiedCoordinates, activeCanals }).type === "valid") fields.push(target);
    }
  }
  return fields;
};

export const carriedPlantingBarley = (snapshot: FarmSnapshot, now: number): number => {
  const item = snapshot.farm.carriedItem;
  return item?.itemKey === "barley" && (item.expiresAt === null || Date.parse(item.expiresAt) > now) ? item.quantity : 0;
};

export const availablePlantingBarley = (snapshot: FarmSnapshot, now: number): number =>
  carriedPlantingBarley(snapshot, now) + storedPlantingBarley(snapshot, now);

export const batchPlantingCarriedBarley = (snapshot: FarmSnapshot, now: number): number => {
  const batch = snapshot.farm.production.planting;
  return carriedPlantingBarley(snapshot, now) + (batch && batch.mode !== "harvest"
    ? batch.phase.type === "collecting" ? batch.carriedSeeds?.quantity ?? 0 : batch.remaining.length
    : 0);
};

export const storedPlantingBarley = (snapshot: FarmSnapshot, now: number): number =>
  (snapshot.inventory.find(i => i.itemKey === "barley")?.quantity ?? 0) +
  snapshot.buildings.filter(b => b.type === "granary" && Date.parse(b.completesAt) <= now).reduce((sum, b) => sum + b.storedBarley, 0);

export const togglePlantingField = (selected: readonly FarmCoordinate[], target: FarmCoordinate, available: readonly FarmCoordinate[], barley: number): readonly FarmCoordinate[] =>
  selected.some(p => fieldKey(p) === fieldKey(target))
    ? selected.filter(p => fieldKey(p) !== fieldKey(target))
    : selected.length < barley && available.some(p => fieldKey(p) === fieldKey(target)) ? [...selected, target] : selected;

/** A deterministic nearest-next walk; fields do not have to be adjacent. */
export const orderPlantingFields = (fields: readonly FarmCoordinate[], start: FarmCoordinate): readonly FarmCoordinate[] => {
  const remaining = [...fields];
  const result: FarmCoordinate[] = [];
  let current = start;
  while (remaining.length) {
    remaining.sort((a, b) => (Math.abs(a.column - current.column) + Math.abs(a.row - current.row)) - (Math.abs(b.column - current.column) + Math.abs(b.row - current.row)));
    current = remaining.shift()!;
    result.push(current);
  }
  return result;
};
