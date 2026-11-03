import { INITIAL_FARM_CONFIG as config } from "./initialFarm";

export const marketLoop = { left: 0, right: 13, top: config.roadRow, bottom: 11 } as const;
export const marketLastRow = 13;
export const marketLastColumn = 15;

/** Enter along the front road, leaving already-present farmers in place. */
export const marketEntryPosition = (requested: { column: number; row: number }, occupied: readonly { column: number; row: number }[]) => {
  if (requested.column !== 0 || requested.row !== marketLoop.top) return requested;
  return Array.from({ length: marketLastColumn + 1 }, (_, column) => ({ column, row: marketLoop.top }))
    .find(tile => occupied.every(other => Math.hypot(tile.column - other.column, tile.row - other.row) >= 1)) ?? requested;
};
/** Shared server/client road geometry, including fractional walking positions. */
export const isMarketRoad = ({ column, row }: { readonly column: number; readonly row: number }): boolean =>
  (row === marketLoop.top && column >= config.worldBounds.minimumColumn && column <= marketLastColumn) ||
  (row === marketLoop.bottom && column >= marketLoop.left && column <= marketLoop.right) ||
  ((column === marketLoop.left || column === marketLoop.right) && row >= marketLoop.top && row <= marketLoop.bottom);
