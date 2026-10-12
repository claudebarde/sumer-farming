import type { FarmSnapshot } from "../../../schemas/farm";
import { INITIAL_FARM_CONFIG } from "../../../game-data/initialFarm";
import { isClearableScenery } from "../../../game-data/farmObjects";
import { isConnectedToIrrigationSource, validateIrrigationLocation } from "../../../game-core/farm/irrigation";
import { isRoadIntersection } from "../../../game-core/farm/roads";
import { buildingAt, presentCanals, sameCell } from "./isometricFarm";
import { plantingBlocker } from "./isometricPlanting";
import type { IsoCell } from "./isometricProjection";
import { ROAD_CONNECTIONS } from "./isometricRoads";

/** Same NW/NE/SE/SW texture masks as roads; river edges act as canal connections. */
export const canalConnectionMask = (cell: IsoCell, canals: FarmSnapshot["improvements"], now: number): number =>
  ROAD_CONNECTIONS.reduce((mask, offset) => {
    const next = { column: cell.column + offset.column, row: cell.row + offset.row };
    const connected = next.row === INITIAL_FARM_CONFIG.riverRow || canals.some(c => sameCell(c, next) &&
      Date.parse(c.completesAt) <= now && (!c.destroyCompletesAt || Date.parse(c.destroyCompletesAt) > now));
    return connected ? mask | offset.bit : mask;
  }, 0);

/** Read-only placement preview; the existing server command remains authoritative. */
export const irrigationBuildBlocker = (snapshot: FarmSnapshot, cell: IsoCell, now: number): string | null => {
  if (cell.row > INITIAL_FARM_CONFIG.riverRow || validateIrrigationLocation(cell).type !== "valid") return "Cannot build here";
  if (buildingAt(snapshot, cell) || snapshot.buildings.some(b => b.loadingTile && sameCell(b.loadingTile, cell)) ||
    snapshot.farm.roads.some(r => sameCell(r, cell)) || isRoadIntersection(cell, snapshot.farm.roads) ||
    presentCanals(snapshot, now).some(c => sameCell(c, cell)) || snapshot.crops.some(c => sameCell(c, cell)) ||
    snapshot.groundItems.some(i => sameCell(i, cell)) || snapshot.objects.some(o => sameCell(o, cell) && !isClearableScenery(o.type))) return "Tile occupied";
  const completed = presentCanals(snapshot, now).filter(c => Date.parse(c.completesAt) <= now && c.destroyCompletesAt === null);
  if (!isConnectedToIrrigationSource(cell, completed)) return "Connect to the river or a completed canal";
  if (snapshot.farm.carriedItem) return "Empty your hands first";
  return plantingBlocker(snapshot, now);
};
