import { INITIAL_FARM_CONFIG } from "../../game-data/initialFarm";
import type { BuildingCoordinate } from "./buildings";
import { roadIsComplete, type FarmRoad } from "../../game-data/roads";

export type RoadCoordinate = BuildingCoordinate & FarmRoad;
export const roadKey = ({ column, row }: RoadCoordinate) => `${column}:${row}`;
export const roadNeighbors = ({ column, row }: RoadCoordinate): readonly RoadCoordinate[] => [
  { column, row: row + 1 }, { column: column - 1, row },
  { column: column + 1, row }, { column, row: row - 1 }
];
export const isRoad = (target: RoadCoordinate, roads: readonly RoadCoordinate[], now = Date.now()) =>
  target.row === INITIAL_FARM_CONFIG.roadRow || roads.some(r => roadKey(r) === roadKey(target) && roadIsComplete(r, now));

/** Check the entire remaining network, including reserved unfinished branches. */
export const roadRemovalReason = (target: RoadCoordinate, roads: readonly FarmRoad[], loadingTiles: readonly BuildingCoordinate[], now: number): string | null => {
  if (target.row === INITIAL_FARM_CONFIG.roadRow) return "The main road cannot be destroyed.";
  const road = roads.find(r => roadKey(r) === roadKey(target));
  if (!road || !roadIsComplete(road, now)) return "Choose a completed road tile.";
  const remaining = roads.filter(r => roadKey(r) !== roadKey(target) && !r.removing);
  const available = new Map(remaining.map(r => [roadKey(r), r]));
  const queue = remaining.filter(r => Math.abs(r.row - INITIAL_FARM_CONFIG.roadRow) <= 1);
  const connected = new Set(queue.map(roadKey));
  for (let i = 0; i < queue.length; i++) for (const neighbor of roadNeighbors(queue[i]!)) {
    const key = roadKey(neighbor), next = available.get(key);
    if (next && !connected.has(key)) { connected.add(key); queue.push(next); }
  }
  const isolated = remaining.filter(r => !connected.has(roadKey(r))).length;
  if (isolated) return `Removing this road would disconnect ${isolated} road ${isolated === 1 ? "tile" : "tiles"} from the main road. Build another connection first.`;
  if (loadingTiles.some(tile => tile.row !== INITIAL_FARM_CONFIG.roadRow && !connected.has(roadKey(tile))))
    return "This road provides loading access to a building. It cannot be destroyed while the building needs it.";
  return null;
};

// Include roads under construction: their connections are already reserved.
export const isRoadIntersection = (target: RoadCoordinate, roads: readonly RoadCoordinate[]): boolean => {
  const hasRoad = (position: RoadCoordinate) => position.row === INITIAL_FARM_CONFIG.roadRow ||
    roads.some(road => roadKey(road) === roadKey(position));
  return hasRoad(target) && roadNeighbors(target).filter(hasRoad).length >= 3;
};

export const validateRoadPlacement = (target: RoadCoordinate, roads: readonly RoadCoordinate[], occupied: ReadonlySet<string>, now = Date.now()): string | null => {
  const b = INITIAL_FARM_CONFIG.worldBounds;
  if (target.column < b.minimumColumn || target.column > b.maximumColumn || target.row < b.minimumRow || target.row > b.maximumRow)
    return "Build roads inside the farm map.";
  if (target.row === INITIAL_FARM_CONFIG.riverRow) return "Roads cannot be built on the river.";
  if (target.row === INITIAL_FARM_CONFIG.roadRow || roads.some(r => roadKey(r) === roadKey(target))) return "There is already a road here.";
  if (occupied.has(roadKey(target))) return "Choose an empty tile for the road.";
  if (!roadNeighbors(target).some(p => isRoad(p, roads, now))) return "Connect the road to the main road or an existing branch.";
  return null;
};

export const connectedRoadKeys = (roads: readonly RoadCoordinate[], now: number): ReadonlySet<string> => {
  // Only completed branches connected to the main road provide building access.
  // Do not accept isolated roads from old saves or links through unfinished roads.
  const completed = roads.filter(r => roadIsComplete(r, now));
  const available = new Map(completed.map(r => [roadKey(r), r]));
  const connected = new Set<string>();
  const queue = completed.filter(r => Math.abs(r.row - INITIAL_FARM_CONFIG.roadRow) <= 1);
  for (const road of queue) connected.add(roadKey(road));
  for (let index = 0; index < queue.length; index++) {
    for (const neighbor of roadNeighbors(queue[index]!)) {
      const key = roadKey(neighbor);
      const road = available.get(key);
      if (road && !connected.has(key)) {
        connected.add(key);
        queue.push(road);
      }
    }
  }
  return connected;
};

// A permanent, exclusive loading point prevents workshops competing for output space.
export const breweryLoadingCorner = (origin: BuildingCoordinate, road: BuildingCoordinate): "B" | "C" => {
  const distance = (column: number, row: number) => (road.column - column) ** 2 + (road.row - row) ** 2;
  return distance(origin.column, origin.row + 1) <= distance(origin.column + 1, origin.row) ? "B" : "C";
};

export const findLoadingTile = (footprint: readonly RoadCoordinate[], roads: readonly RoadCoordinate[], reserved: readonly RoadCoordinate[], occupied: ReadonlySet<string>, options: { building?: string; now?: number } = {}): RoadCoordinate | null => {
  const connected = connectedRoadKeys(roads, options.now ?? Date.now());
  const blocked = new Set([...footprint, ...reserved, INITIAL_FARM_CONFIG.farmerSpawn].map(roadKey));
  const candidates = footprint.flatMap(roadNeighbors).filter(p =>
    (p.row === INITIAL_FARM_CONFIG.roadRow || connected.has(roadKey(p))) &&
    !blocked.has(roadKey(p)) && !occupied.has(roadKey(p)));
  // Prefer the detailed original brewery whenever a usable B-side access exists.
  const origin = footprint[0];
  return (options.building === "brewery" && origin
    ? candidates.find(p => breweryLoadingCorner(origin, p) === "B") : undefined) ?? candidates[0] ?? null;
};
