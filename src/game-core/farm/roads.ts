import { INITIAL_FARM_CONFIG } from "../../game-data/initialFarm";
import { isProgressionSignpost } from "../../game-data/progression";
import type { BuildingCoordinate } from "./buildings";
import { roadIsComplete, type FarmRoad } from "../../game-data/roads";

export type RoadCoordinate = BuildingCoordinate & FarmRoad;
export const roadKey = ({ column, row }: RoadCoordinate) => `${column}:${row}`;
export const roadNeighbors = ({ column, row }: RoadCoordinate): readonly RoadCoordinate[] => [
  { column, row: row + 1 }, { column: column - 1, row },
  { column: column + 1, row }, { column, row: row - 1 }
];
export const isRoad = (target: RoadCoordinate, roads: readonly RoadCoordinate[]) =>
  target.row === INITIAL_FARM_CONFIG.roadRow || roads.some(r => roadKey(r) === roadKey(target) && roadIsComplete(r, Date.now()));

// Include roads under construction: their connections are already reserved.
export const isRoadIntersection = (target: RoadCoordinate, roads: readonly RoadCoordinate[]): boolean => {
  const hasRoad = (position: RoadCoordinate) => position.row === INITIAL_FARM_CONFIG.roadRow ||
    roads.some(road => roadKey(road) === roadKey(position));
  return hasRoad(target) && roadNeighbors(target).filter(hasRoad).length >= 3;
};

export const validateRoadPlacement = (target: RoadCoordinate, roads: readonly RoadCoordinate[], occupied: ReadonlySet<string>): string | null => {
  const b = INITIAL_FARM_CONFIG.worldBounds;
  if (target.column < b.minimumColumn || target.column > b.maximumColumn || target.row < b.minimumRow || target.row > b.maximumRow)
    return "Build roads inside the farm map.";
  if (target.row === INITIAL_FARM_CONFIG.riverRow) return "Roads cannot be built on the river.";
  if (target.row === INITIAL_FARM_CONFIG.roadRow || roads.some(r => roadKey(r) === roadKey(target))) return "There is already a road here.";
  if (isProgressionSignpost(target) || occupied.has(roadKey(target))) return "Choose an empty tile for the road.";
  if (!roadNeighbors(target).some(p => isRoad(p, roads))) return "Connect the road to the main road or an existing branch.";
  return null;
};

// A permanent, exclusive loading point prevents workshops competing for output space.
export const findLoadingTile = (footprint: readonly RoadCoordinate[], roads: readonly RoadCoordinate[], reserved: readonly RoadCoordinate[], occupied: ReadonlySet<string>): RoadCoordinate | null => {
  const blocked = new Set([...footprint, ...reserved, INITIAL_FARM_CONFIG.farmerSpawn].map(roadKey));
  return footprint.flatMap(roadNeighbors).find(p => isRoad(p, roads) && !blocked.has(roadKey(p)) && !occupied.has(roadKey(p))) ?? null;
};
