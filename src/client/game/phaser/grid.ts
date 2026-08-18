import { TILE_SIZE } from "./config";
import type { TilePosition } from "./types";

export const calculateGameplayTilePosition = (
  containerColumns: number,
  gameplayColumns: number
): TilePosition => ({
  column: Math.max(0, Math.floor((containerColumns - gameplayColumns) / 2)),
  row: 0,
  posX:
    Math.max(0, Math.floor((containerColumns - gameplayColumns) / 2)) *
    TILE_SIZE,
  posY: 0
});

export const translateTilePosition = (
  origin: TilePosition,
  localPosition: Omit<TilePosition, "posX" | "posY">
): TilePosition => ({
  column: origin.column + localPosition.column,
  row: origin.row + localPosition.row,
  posX: origin.posX + (localPosition.column ?? 0),
  posY: origin.posY + (localPosition.row ?? 0)
});
