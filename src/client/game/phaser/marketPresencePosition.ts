import type { RoadCoordinate } from "../../../game-core/farm/roads";
import type { MarketPosition } from "../../../schemas/marketPresence";
import { marketSceneLayout } from "./marketSceneLayout";

export const encodeMarketPosition = (tile: RoadCoordinate, columns: number): MarketPosition => {
  const { left } = marketSceneLayout(columns);
  return { column: tile.column < left ? Math.round(tile.column * 3 / left) - 3 : tile.column - left, row: tile.row };
};
export const decodeMarketPosition = (position: MarketPosition, columns: number): RoadCoordinate => {
  const { left } = marketSceneLayout(columns);
  return { column: position.column < 0 ? Math.round((position.column + 3) * left / 3) : position.column + left, row: position.row };
};
