import { INITIAL_FARM_CONFIG } from "../../game-data/initialFarm";
import type { FarmBuildingType } from "../../game-data/buildings";
import { getBuildingFootprint, type BuildingCoordinate } from "./buildings";

const key = ({ column, row }: BuildingCoordinate): string => `${column}:${row}`;
const neighbors = ({ column, row }: BuildingCoordinate): readonly BuildingCoordinate[] => [
  { column: column - 1, row }, { column: column + 1, row },
  { column, row: row - 1 }, { column, row: row + 1 }
];

// Match movement: only buildings and the river block walking, not crops/items.
// Includes construction sites immediately, regardless of their completion time.
export const preservesBuildingAccess = (context: {
  readonly buildings: readonly (BuildingCoordinate & { readonly type: FarmBuildingType })[];
  readonly columnBounds?: { readonly minimumColumn: number; readonly maximumColumn: number };
}): boolean => {
  const bounds = context.columnBounds ?? INITIAL_FARM_CONFIG.worldBounds;
  const { buildingBounds, riverRow } = INITIAL_FARM_CONFIG;
  const farmFootprint = Array.from(
    { length: (buildingBounds.maximumColumn - buildingBounds.minimumColumn + 1) *
      (buildingBounds.maximumRow - buildingBounds.minimumRow + 1) },
    (_, index) => ({
      column: buildingBounds.minimumColumn + index % (buildingBounds.maximumColumn - buildingBounds.minimumColumn + 1),
      row: buildingBounds.minimumRow + Math.floor(index / (buildingBounds.maximumColumn - buildingBounds.minimumColumn + 1))
    })
  );
  const footprints = [farmFootprint, ...context.buildings.map(building => getBuildingFootprint(building.type, building))];
  const blocked = new Set(footprints.flat().map(key));
  const inside = ({ column, row }: BuildingCoordinate): boolean =>
    column >= bounds.minimumColumn && column <= bounds.maximumColumn && row >= 0 && row < riverRow;
  const start = { column: bounds.minimumColumn, row: riverRow - 1 };
  if (!inside(start) || blocked.has(key(start))) return false;
  const queue: BuildingCoordinate[] = [start];
  const reached = new Set([key(start)]);
  for (let index = 0; index < queue.length; index++) {
    for (const next of neighbors(queue[index]!)) {
      if (inside(next) && !blocked.has(key(next)) && !reached.has(key(next))) {
        reached.add(key(next));
        queue.push(next);
      }
    }
  }
  for (let row = 0; row < riverRow; row++) {
    for (let column = bounds.minimumColumn; column <= bounds.maximumColumn; column++) {
      const coordinate = key({ column, row });
      if (!blocked.has(coordinate) && !reached.has(coordinate)) return false;
    }
  }
  return footprints.every(footprint => footprint.some(tile =>
    neighbors(tile).some(neighbor => reached.has(key(neighbor)))
  ));
};
