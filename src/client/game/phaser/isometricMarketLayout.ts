import { isMarketRoad, marketLoop } from "../../../game-data/marketLayout";
export { isMarketRoad, marketLoop, marketLastRow } from "../../../game-data/marketLayout";
import type { IsoCell } from "./isometricProjection";
import { ROAD_CONNECTIONS } from "./isometricRoads";

// Reserved footprints within the shared road loop.
export const futureMarketStandOrigins = [{ column: 2, row: 8 }, { column: 5, row: 8 }] as const;

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
