import type { IsoCell } from "./isometricProjection";
export { isoPoint, isoCell, ISO_WIDTH, ISO_HEIGHT, type IsoCell } from "./isometricProjection";
export const isoBuilding = ({ column, row }: IsoCell) => column >= 4 && column <= 5 && row >= 2 && row <= 3;
export const isoField = ({ column, row }: IsoCell) => column >= 5 && column <= 8 && row >= 5 && row <= 6;
export const ISO_BARLEY_STAGES = ["sown", "growing", "growing", "ripe", "sown", "growing", "ripe", "ripe"] as const;
export const isoBarleyStage = (cell: IsoCell) => isoField(cell)
  ? ISO_BARLEY_STAGES[(cell.row - 5) * 4 + cell.column - 5]
  : undefined;
// Fixed art-review layout: non-field ground above the river, away from roads.
export const ISO_SCENERY = [
  { column: 1, row: 2, sprite: "bush01" },
  { column: 1, row: 6, sprite: "bush02" },
  { column: 8, row: 1, sprite: "bush01" },
  { column: 7, row: 3, sprite: "bush02" },
  { column: 2, row: 0, sprite: "rocks01" },
  { column: 0, row: 5, sprite: "rocks02" },
  { column: 7, row: 0, sprite: "rocks02" },
  { column: 4, row: 7, sprite: "rocks01" }
] as const;
export const isoSceneryAt = (cell: IsoCell) => ISO_SCENERY.find(item => item.column === cell.column && item.row === cell.row);
export const isoWalkable = (cell: IsoCell) => cell.column >= 0 && cell.column < 10 && cell.row >= 0 && cell.row < 8 && !(cell.column === 9 && cell.row >= 5) && !isoBuilding(cell) && !isoSceneryAt(cell);
const key = (cell: IsoCell) => `${cell.column}:${cell.row}`;
/** Sandbox-only cardinal pathfinding. No live farm state or commands. */
export const isoPath = (start: IsoCell, target: IsoCell): readonly IsoCell[] => {
  if (!isoWalkable(target)) return [];
  const queue: { cell: IsoCell; path: IsoCell[] }[] = [{ cell: start, path: [] }];
  const seen = new Set([key(start)]);
  for (let i = 0; i < queue.length; i++) {
    const { cell, path } = queue[i]!;
    if (key(cell) === key(target)) return path;
    for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]] as const) {
      const next = { column: cell.column + dx, row: cell.row + dy };
      if (!isoWalkable(next) || seen.has(key(next))) continue;
      seen.add(key(next)); queue.push({ cell: next, path: [...path, next] });
    }
  }
  return [];
};
