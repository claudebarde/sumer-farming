import { findRoadPreferredPath } from "../../../game-core/farm/roadPath";
import { roadIsComplete } from "../../../game-data/roads";
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
  const bounds = INITIAL_FARM_CONFIG.worldBounds;
  const local = (cell: IsoCell) => ({ column: cell.column - bounds.minimumColumn, row: cell.row - bounds.minimumRow });
  const key = (cell: IsoCell) => `${cell.column}:${cell.row}`;
  const blocked = new Set<string>();
  const roads = new Set(snapshot.farm.roads.filter(r => roadIsComplete(r, now)).map(r => key(local(r))));
  for (let column = bounds.minimumColumn; column <= bounds.maximumColumn; column++) {
    roads.add(key(local({ column, row: INITIAL_FARM_CONFIG.roadRow })));
    for (let row = bounds.minimumRow; row <= bounds.maximumRow; row++) {
      const cell = { column, row };
      if (!previewWalkable(snapshot, cell, now) || (avoid && sameCell(cell, avoid))) blocked.add(key(local(cell)));
    }
  }
  // Preserve the caller contract: omit the starting tile from the shared route.
  return findRoadPreferredPath(local(start), local(target), {
    columns: bounds.maximumColumn - bounds.minimumColumn + 1,
    rows: bounds.maximumRow - bounds.minimumRow + 1
  }, blocked, roads)?.slice(1).map(cell => ({
    column: cell.column + bounds.minimumColumn, row: cell.row + bounds.minimumRow
  })) ?? [];
};
