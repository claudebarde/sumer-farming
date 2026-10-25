type Position = { column: number; row: number };

export const porterPathLength = (path: readonly Position[]): number =>
  path.slice(1).reduce((sum, p, i) => sum + Math.abs(p.column - path[i]!.column) + Math.abs(p.row - path[i]!.row), 0);

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
