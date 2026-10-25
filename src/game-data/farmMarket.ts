import { INITIAL_FARM_CONFIG as config } from "./initialFarm";

/** Fixed farm-scene market, shared by rendering and server-owned journey planning. */
export const FARM_MARKET_ORIGIN = { column: config.worldBounds.maximumColumn - 1, row: config.roadRow - 2 } as const;
export const FARM_MARKET_ENTRANCE = { column: FARM_MARKET_ORIGIN.column, row: config.roadRow } as const;
export const FARM_MARKET_FOOTPRINT = [
  FARM_MARKET_ORIGIN,
  { column: FARM_MARKET_ORIGIN.column + 1, row: FARM_MARKET_ORIGIN.row },
  { column: FARM_MARKET_ORIGIN.column, row: FARM_MARKET_ORIGIN.row + 1 },
  { column: FARM_MARKET_ORIGIN.column + 1, row: FARM_MARKET_ORIGIN.row + 1 },
] as const;
export const isFarmMarketTile = (cell: { readonly column: number; readonly row: number }) =>
  cell.column >= FARM_MARKET_ORIGIN.column && cell.column < FARM_MARKET_ORIGIN.column + 2 &&
  cell.row >= FARM_MARKET_ORIGIN.row && cell.row < FARM_MARKET_ORIGIN.row + 2;
