export type InteriorPoint = Readonly<{ x: number; y: number }>;
const polygon = (points: readonly (readonly [number, number])[]): readonly InteriorPoint[] => points.map(([x, y]) => ({ x, y }));
// Coordinates registered to the approved 1536 × 1024 architectural artwork.
// Rooms connect ONLY through narrow doorway corridors; exterior walls are excluded.
export const INTERIOR_FLOORS = [
  polygon([[330,665],[750,480],[1195,680],[745,925],[650,915]]),
  polygon([[670,890],[745,890],[755,965],[650,965]]),
  polygon([[180,435],[595,235],[725,300],[725,345],[330,535]]),
  polygon([[561,400],[573,400],[573,575],[561,580]]),
  polygon([[815,390],[945,320],[1345,525],[1235,580],[1030,500],[945,480]]),
  polygon([[930,450],[942,450],[942,590],[930,590]])
] as const;
export const INTERIOR_ENTRY: InteriorPoint = { x: 705, y: 940 };
export const containsPoint = (p: InteriorPoint, vertices: readonly InteriorPoint[]): boolean => {
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const a = vertices[i]!, b = vertices[j]!;
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
};
export type InteriorObstacle = InteriorPoint & { readonly rx: number; readonly ry: number };
export const insideObstacle = (p: InteriorPoint, o: InteriorObstacle, padding = 0) =>
  ((p.x - o.x) / (o.rx + padding)) ** 2 + ((p.y - o.y) / (o.ry + padding)) ** 2 <= 1;
export const interiorWalkable = (point: InteriorPoint, obstacles: readonly InteriorObstacle[] = []) =>
  INTERIOR_FLOORS.some(area => containsPoint(point, area)) && !obstacles.some(o => insideObstacle(point, o, 12));
export const distance = (a: InteriorPoint, b: InteriorPoint) => Math.hypot(a.x - b.x, a.y - b.y);
export const interiorSegmentClear = (a: InteriorPoint, b: InteriorPoint, obstacles: readonly InteriorObstacle[] = []) => {
  const steps = Math.max(1, Math.ceil(distance(a, b) / 3));
  return Array.from({ length: steps + 1 }, (_, i) => ({ x: a.x + (b.x - a.x) * i / steps, y: a.y + (b.y - a.y) * i / steps })).every(p => interiorWalkable(p, obstacles));
};
const STEP = 8;
const nodes: InteriorPoint[] = [];
for (let y = 228; y < 972; y += STEP) for (let x = 168; x < 1368; x += STEP) {
  if (interiorWalkable({ x, y })) nodes.push({ x, y });
}
const key = (p: InteriorPoint) => `${p.x},${p.y}`;
const index = new Map(nodes.map(p => [key(p), p]));
const nearest = (p: InteriorPoint, obstacles: readonly InteriorObstacle[]) => nodes.filter(n => distance(n, p) < 24 && interiorSegmentClear(p, n, obstacles)).sort((a, b) => distance(a, p) - distance(b, p))[0];
/** A* through walkable floors, then visibility smoothing without cutting wall corners. */
export const interiorPath = (start: InteriorPoint, end: InteriorPoint, obstacles: readonly InteriorObstacle[] = []): readonly InteriorPoint[] => {
  if (!interiorWalkable(start, obstacles) || !interiorWalkable(end, obstacles)) return [];
  if (interiorSegmentClear(start, end, obstacles)) return [end];
  const first = nearest(start, obstacles), last = nearest(end, obstacles);
  if (!first || !last) return [];
  const open = new Set([key(first)]), scores = new Map([[key(first), 0]]), previous = new Map<string, string>();
  while (open.size) {
    const current = [...open].sort((a, b) => (scores.get(a)! + distance(index.get(a)!, last)) - (scores.get(b)! + distance(index.get(b)!, last)))[0]!;
    if (current === key(last)) {
      const path = [end, last]; let k = current;
      while (previous.has(k)) { k = previous.get(k)!; path.push(index.get(k)!); }
      path.push(start); path.reverse();
      const result: InteriorPoint[] = []; let from = 0;
      while (from < path.length - 1) {
        let to = path.length - 1;
        while (to > from + 1 && !interiorSegmentClear(path[from]!, path[to]!, obstacles)) to--;
        result.push(path[to]!); from = to;
      }
      return result;
    }
    open.delete(current);
    const p = index.get(current)!;
    for (const dx of [-STEP, 0, STEP]) for (const dy of [-STEP, 0, STEP]) {
      if (!dx && !dy) continue;
      const next = index.get(key({ x: p.x + dx, y: p.y + dy }));
      if (!next || !interiorSegmentClear(p, next, obstacles)) continue;
      const cost = scores.get(current)! + distance(p, next), nk = key(next);
      if (cost >= (scores.get(nk) ?? Infinity)) continue;
      scores.set(nk, cost); previous.set(nk, current); open.add(nk);
    }
  }
  return [];
};
