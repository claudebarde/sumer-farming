import { INITIAL_FARM_CONFIG as config } from "../../../game-data/initialFarm";
import type { IsoCell } from "./isometricProjection";
import { ROAD_CONNECTIONS } from "./isometricRoads";

export const marketLoop = { left: 0, right: 9, top: config.roadRow, bottom: 11 } as const;
export const marketLastRow = 13;
// The interior is 8×5 tiles: two 2×2 stands, spacing and front-facing merchants.
export const futureMarketStandOrigins = [{ column: 2, row: 8 }, { column: 5, row: 8 }] as const;
export const isMarketRoad = ({ column, row }: IsoCell): boolean =>
  (row === marketLoop.top && column >= config.worldBounds.minimumColumn && column <= config.worldBounds.maximumColumn) ||
  (row === marketLoop.bottom && column >= marketLoop.left && column <= marketLoop.right) ||
  ((column === marketLoop.left || column === marketLoop.right) && row >= marketLoop.top && row <= marketLoop.bottom);

export const marketRoadMask = (cell: IsoCell): number => ROAD_CONNECTIONS.reduce((mask, offset) => {
  const next = { column: cell.column + offset.column, row: cell.row + offset.row };
  // Continue the main road naturally through the map edges.
  return isMarketRoad(next) || next.row === marketLoop.top ? mask | offset.bit : mask;
}, 0);

const key = (cell: IsoCell) => `${cell.column}:${cell.row}`;
/** Shortest orthogonal road route, excluding the starting tile. */
export const marketRoadPath = (start: IsoCell, target: IsoCell): readonly IsoCell[] => {
  if (!isMarketRoad(start) || !isMarketRoad(target)) return [];
  const queue = [{ cell: start, path: [] as IsoCell[] }], seen = new Set([key(start)]);
  for (let i = 0; i < queue.length; i++) {
    const { cell, path } = queue[i]!;
    if (key(cell) === key(target)) return path;
    for (const offset of ROAD_CONNECTIONS) {
      const next = { column: cell.column + offset.column, row: cell.row + offset.row };
      if (!isMarketRoad(next) || seen.has(key(next))) continue;
      seen.add(key(next)); queue.push({ cell: next, path: [...path, next] });
    }
  }
  return [];
};
