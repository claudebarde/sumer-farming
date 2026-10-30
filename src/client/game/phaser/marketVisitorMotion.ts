import type { MarketPosition } from "../../../schemas/marketPresence";
import { isMarketRoad, marketRoadPath } from "./isometricMarketLayout";

const distance = (a: MarketPosition, b: MarketPosition) => Math.abs(a.column - b.column) + Math.abs(a.row - b.row);
const anchors = (p: MarketPosition) => [
  { column: Math.floor(p.column), row: Math.floor(p.row) },
  { column: Math.ceil(p.column), row: Math.ceil(p.row) }
].filter(isMarketRoad);

/** Interpolation must follow roads around corners rather than cross through stalls. */
export const marketVisitorPath = (from: MarketPosition, to: MarketPosition): readonly MarketPosition[] => {
  if (!isMarketRoad(from) || !isMarketRoad(to) || distance(from, to) < 0.001) return [];
  if ((from.row === to.row || from.column === to.column) &&
    isMarketRoad({ column: (from.column + to.column) / 2, row: (from.row + to.row) / 2 })) return [to];
  const routes = anchors(from).flatMap(start => anchors(to).map(end => {
    const path = [start, ...marketRoadPath(start, end), to];
    return { path, length: path.reduce((sum, p, i) => sum + distance(i ? path[i - 1]! : from, p), 0) };
  }));
  return routes.sort((a, b) => a.length - b.length)[0]?.path ?? [];
};

export const advanceMarketVisitor = (from: MarketPosition, path: readonly MarketPosition[], budget: number) => {
  let position = from, remaining = path, travelled = 0, flipX: boolean | null = null;
  while (remaining.length) {
    const next = remaining[0]!, length = distance(position, next);
    if (length < 0.001) { position = next; remaining = remaining.slice(1); continue; }
    if (budget <= 0) break;
    const step = Math.min(length, budget);
    const dc = next.column - position.column, dr = next.row - position.row;
    flipX = dc - dr < 0;
    position = step === length ? next : { column: position.column + dc * step / length, row: position.row + dr * step / length };
    travelled += step; budget -= step;
    if (step === length) remaining = remaining.slice(1);
  }
  return { position, path: remaining, travelled, flipX };
};
