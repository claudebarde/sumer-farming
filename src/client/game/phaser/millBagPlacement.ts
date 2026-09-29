type Coordinate = { readonly column: number; readonly row: number };

/** Prefer the front of a 2×2 Mill, then the nearest free surrounding tile. */
export const findMillBagTile = (
  mill: Coordinate,
  bounds: { readonly columns: number; readonly rows: number },
  isFree: (position: Coordinate) => boolean
): Coordinate | null => {
  for (let distance = 1; distance <= Math.max(bounds.columns, bounds.rows); distance++) {
    const candidates: Coordinate[] = [];
    const offsets = [0, 1, ...Array.from({ length: distance * 2 + 2 }, (_, i) => i - distance).filter(i => i !== 0 && i !== 1)];
    for (const offset of offsets) {
      candidates.push(
        { column: mill.column + offset, row: mill.row + 1 + distance },
        { column: mill.column - distance, row: mill.row + offset },
        { column: mill.column + 1 + distance, row: mill.row + offset },
        { column: mill.column + offset, row: mill.row - distance }
      );
    }
    const available = candidates.find(p => p.column >= 0 && p.column < bounds.columns &&
      p.row >= 0 && p.row < bounds.rows && isFree(p));
    if (available) return available;
  }
  return null;
};
