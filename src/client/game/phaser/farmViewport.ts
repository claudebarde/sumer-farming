/** Decorative space only: never add these rows to the playable grid. */
export const FARM_TOP_SCENERY_ROWS = 1;
export const FARM_BOTTOM_SCENERY_ROWS = 3;

export const farmScrollContentHeight = (riverRow: number, tileSize: number): number =>
  (FARM_TOP_SCENERY_ROWS + riverRow + 1 + FARM_BOTTOM_SCENERY_ROWS) * tileSize;

export const isFarmSceneryRow = (row: number, riverRow: number): boolean =>
  row < 0 || row > riverRow;

export const farmWorldToCanvasY = (worldY: number, tileSize: number): number =>
  worldY + FARM_TOP_SCENERY_ROWS * tileSize;
