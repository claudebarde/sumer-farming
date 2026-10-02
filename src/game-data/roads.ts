export const ROAD_CONSTRUCTION_DURATION_MS = 5_000;
export type FarmRoad = { readonly column: number; readonly row: number; readonly completesAt?: number };
export const roadIsComplete = (road: FarmRoad, now: number) => (road.completesAt ?? 0) <= now;
