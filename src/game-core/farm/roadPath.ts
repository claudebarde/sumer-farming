import { roadKey, roadNeighbors, type RoadCoordinate } from "./roads";

/** Minimize off-road steps first, then distance. Keep fields and legacy buildings reachable. */
export const findRoadPreferredPath = (
  start: RoadCoordinate, target: RoadCoordinate,
  bounds: { readonly columns: number; readonly rows: number },
  blocked: ReadonlySet<string>, roads: ReadonlySet<string>
): readonly RoadCoordinate[] | null => {
  if (blocked.has(roadKey(target))) return null;
  const offRoadCost = bounds.columns * bounds.rows + 1;
  const costs = new Map([[roadKey(start), 0]]);
  const previous = new Map<string, RoadCoordinate>();
  const queue = [start];
  while (queue.length) {
    queue.sort((a, b) => costs.get(roadKey(a))! - costs.get(roadKey(b))!);
    const current = queue.shift()!;
    if (roadKey(current) === roadKey(target)) {
      const path = [current];
      let cursor = current;
      while (previous.has(roadKey(cursor))) {
        cursor = previous.get(roadKey(cursor))!;
        path.push(cursor);
      }
      return path.reverse();
    }
    for (const next of roadNeighbors(current)) {
      const key = roadKey(next);
      if (next.column < 0 || next.column >= bounds.columns || next.row < 0 || next.row >= bounds.rows || blocked.has(key)) continue;
      const cost = costs.get(roadKey(current))! + (roads.has(key) ? 1 : offRoadCost);
      if (cost >= (costs.get(key) ?? Infinity)) continue;
      previous.set(key, current);
      costs.set(key, cost);
      if (!queue.some(p => roadKey(p) === key)) queue.push(next);
    }
  }
  return null;
};
