import type { FarmSnapshot } from "../../../schemas/farm";
import { INITIAL_FARM_CONFIG as config } from "../../../game-data/initialFarm";
import { isClearableScenery } from "../../../game-data/farmObjects";
import { roadIsComplete, type FarmRoad } from "../../../game-data/roads";
import { getBuildingFootprint } from "../../../game-core/farm/buildings";
import { roadKey, validateRoadPlacement } from "../../../game-core/farm/roads";
import { farmOrigin, presentCanals, sameCell } from "./isometricFarm";
import { plantingBlocker } from "./isometricPlanting";
import type { IsoCell } from "./isometricProjection";

// Clockwise screen-edge connections: NW, NE, SE, SW.
export const ROAD_CONNECTIONS = [{ column: -1, row: 0, bit: 1 }, { column: 0, row: -1, bit: 2 },
  { column: 1, row: 0, bit: 4 }, { column: 0, row: 1, bit: 8 }] as const;
export const roadConnectionMask = (cell: IsoCell, roads: readonly FarmRoad[], now: number): number =>
  ROAD_CONNECTIONS.reduce((mask, offset) => {
    const next = { column: cell.column + offset.column, row: cell.row + offset.row };
    return next.row === config.roadRow || roads.some(r => sameCell(r, next) && roadIsComplete(r, now)) ? mask | offset.bit : mask;
  }, 0);

export const roadBuildBlocker = (snapshot: FarmSnapshot, cell: IsoCell, now: number): string | null => {
  if (cell.row >= config.riverRow) return "Build roads above the river";
  const occupied = new Set([
    ...snapshot.crops, ...snapshot.groundItems, ...snapshot.objects.filter(o => !isClearableScenery(o.type)),
    ...presentCanals(snapshot, now), ...snapshot.buildings.flatMap(b => getBuildingFootprint(b.type, b)),
    ...getBuildingFootprint("granary", farmOrigin),
  ].map(roadKey));
  const reason = validateRoadPlacement(cell, snapshot.farm.roads, occupied, now);
  if (reason) return reason;
  if (snapshot.farm.carriedItem) return "Empty your hands first";
  return plantingBlocker(snapshot, now);
};
