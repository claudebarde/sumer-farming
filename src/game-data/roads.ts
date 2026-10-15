export const ROAD_CONSTRUCTION_DURATION_MS = 5_000;
// completesAt is the current road work deadline (construction or removal).
export type FarmRoad = { readonly column: number; readonly row: number; readonly completesAt?: number; readonly removing?: boolean; readonly approachPath?: readonly { column: number; row: number }[] };
export const roadIsComplete = (road: FarmRoad, now: number) => !road.removing && (road.completesAt ?? 0) <= now;
