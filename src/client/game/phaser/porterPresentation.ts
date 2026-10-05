type Position = { column: number; row: number };

export const porterPathLength = (path: readonly Position[]): number =>
  path.slice(1).reduce((sum, p, i) => sum + Math.abs(p.column - path[i]!.column) + Math.abs(p.row - path[i]!.row), 0);

/** Interpolate the farmer's tile offsets when entering or leaving a road. */
export const porterRoadOffset = (position: Position, getRoadOffset: (tile: Position) => number): number => {
  const column = Math.floor(position.column);
  const row = Math.floor(position.row);
  const x = position.column - column;
  const y = position.row - row;
  const top = getRoadOffset({ column, row }) * (1 - x) + getRoadOffset({ column: column + 1, row }) * x;
  const bottom = getRoadOffset({ column, row: row + 1 }) * (1 - x) + getRoadOffset({ column: column + 1, row: row + 1 }) * x;
  return top * (1 - y) + bottom * y;
};

/** Join the idle market position to a saved road route without changing job deadlines. */
export const porterApproach = (market: Position, path: readonly Position[]) => {
  const start = path[0];
  if (!start) return [...path];
  const points: Position[] = [market];
  // Reach the main road before joining the persisted approach.
  if (market.row !== start.row) points.push({ column: market.column, row: start.row });
  points.push(start, ...path.slice(1));
  return points;
};

export const positionAlongPorterPath = (path: readonly Position[], fraction: number): Position => {
  const lengths = path.slice(1).map((p, i) => Math.abs(p.column - path[i]!.column) + Math.abs(p.row - path[i]!.row));
  let distance = lengths.reduce((sum, n) => sum + n, 0) * Math.min(1, Math.max(0, fraction));
  for (let i = 0; i < lengths.length; i++) {
    const length = lengths[i]!;
    if (length > 0 && distance <= length) {
      const from = path[i]!; const to = path[i + 1]!;
      return { column: from.column + (to.column - from.column) * distance / length, row: from.row + (to.row - from.row) * distance / length };
    }
    distance -= length;
  }
  return path[path.length - 1]!;
};
