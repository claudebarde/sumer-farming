import { INITIAL_FARM_CONFIG as config } from "./initialFarm";

export const marketLoop = { left: 0, right: 13, top: config.roadRow, bottom: 11 } as const;
export const marketLastRow = 13;
export const marketLastColumn = 15;
/** Shared server/client road geometry, including fractional walking positions. */
export const isMarketRoad = ({ column, row }: { readonly column: number; readonly row: number }): boolean =>
  (row === marketLoop.top && column >= config.worldBounds.minimumColumn && column <= marketLastColumn) ||
  (row === marketLoop.bottom && column >= marketLoop.left && column <= marketLoop.right) ||
  ((column === marketLoop.left || column === marketLoop.right) && row >= marketLoop.top && row <= marketLoop.bottom);
