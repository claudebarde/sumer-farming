import { INITIAL_FARM_CONFIG as config } from "../../game-data/initialFarm";

type Cell = { readonly column: number; readonly row: number };
/** Terrain eligibility only; callers must also reject occupied cells. */
export const isItemDropGround = (cell: Cell, itemKey: string): boolean => {
  if (itemKey !== "reed" && itemKey !== "clay") return isArableGround(cell);
  const { column, row } = cell, b = config.worldBounds;
  return Number.isInteger(column) && Number.isInteger(row) &&
    column >= b.minimumColumn && column <= b.maximumColumn &&
    row >= b.minimumRow && row <= b.maximumRow &&
    row !== config.roadRow && row !== config.riverRow && row !== config.riverRow + 1 &&
    !isFixedBuildingGround(cell);
};
export const isArableGround = ({ column, row }: Cell): boolean => {
  const b = config.plotBounds;
  return column >= b.minimumColumn && column <= b.maximumColumn && row >= b.minimumRow && row <= b.maximumRow;
};
export const isBuildingGround = ({ column, row }: Cell): boolean =>
  column >= config.worldBounds.minimumColumn && column <= config.worldBounds.maximumColumn &&
  row >= config.worldBounds.minimumRow && row < config.roadRow;

/** Permanent farmhouse and market footprints, independent of cultivated land. */
export const isFixedBuildingGround = ({ column, row }: Cell): boolean => {
  const home = config.buildingBounds;
  return (column >= home.minimumColumn && column <= home.maximumColumn && row >= home.minimumRow && row <= home.maximumRow) ||
    (column >= config.worldBounds.maximumColumn - 1 && column <= config.worldBounds.maximumColumn && row >= config.roadRow - 2 && row < config.roadRow);
};
export const sceneryPositions = (reeds: boolean): readonly Cell[] => {
  const b = config.worldBounds;
  return Array.from({ length: (b.maximumColumn - b.minimumColumn + 1) * config.riverRow }, (_, i) => ({
    column: b.minimumColumn + i % (b.maximumColumn - b.minimumColumn + 1),
    row: Math.floor(i / (b.maximumColumn - b.minimumColumn + 1)),
  })).filter(p => p.row !== config.roadRow && !isArableGround(p) && !isFixedBuildingGround(p) &&
    !(p.column === 0 && p.row === 4) && (!reeds || p.row === config.riverRow - 1));
};
