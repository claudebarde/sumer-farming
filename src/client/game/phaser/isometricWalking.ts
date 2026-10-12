import type { FarmSnapshot } from "../../../schemas/farm";
import { INITIAL_FARM_CONFIG } from "../../../game-data/initialFarm";
import { buildingAt, farmOrigin, insideWorld, presentCanals, sameCell } from "./isometricFarm";
import { footprintContains, type IsoCell } from "./isometricProjection";
import { isMarketTile } from "./isometricMarket";

/** Preview routing only; never authorizes an economic action. */
export const previewWalkable = (snapshot: FarmSnapshot, cell: IsoCell, now: number): boolean => {
  if (!insideWorld(cell) || cell.row >= INITIAL_FARM_CONFIG.riverRow ||
    footprintContains(farmOrigin, 2, 2, cell) || isMarketTile(cell) || buildingAt(snapshot, cell) ||
    snapshot.objects.some(o => sameCell(o, cell))) return false;
  const road = cell.row === INITIAL_FARM_CONFIG.roadRow || snapshot.farm.roads.some(r => sameCell(r, cell) && (!r.completesAt || r.completesAt <= now));
  if (snapshot.farm.roads.some(r => sameCell(r, cell) && r.completesAt && r.completesAt > now)) return false;
  return !presentCanals(snapshot, now).some(c => sameCell(c, cell)) || road;
};

export const previewWalkPath = (snapshot: FarmSnapshot, start: IsoCell, target: IsoCell, now: number, avoid?: IsoCell): readonly IsoCell[] => {
  if (!previewWalkable(snapshot, target, now)) return [];
  const key = (cell: IsoCell) => `${cell.column}:${cell.row}`;
  const queue: { cell: IsoCell; path: readonly IsoCell[] }[] = [{ cell: start, path: [] }];
  const seen = new Set([key(start)]);
  for (let i = 0; i < queue.length; i++) {
    const { cell, path } = queue[i]!;
    if (sameCell(cell, target)) return path;
    for (const [dc, dr] of [[1, 0], [0, 1], [-1, 0], [0, -1]] as const) {
      const next = { column: cell.column + dc, row: cell.row + dr };
      if (seen.has(key(next)) || (avoid && sameCell(next, avoid)) || !previewWalkable(snapshot, next, now)) continue;
      seen.add(key(next)); queue.push({ cell: next, path: [...path, next] });
    }
  }
  return [];
};
