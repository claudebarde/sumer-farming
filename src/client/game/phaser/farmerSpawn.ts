type Coordinate = { readonly column: number; readonly row: number };

/** Search the plot from its centre outward, preferring adjacent free tiles. */
export const findCentralFarmerTile = (
  origin: Coordinate,
  size: number,
  isAvailable: (tile: Coordinate) => boolean
): Coordinate | null => {
  const centre = Math.floor(size / 2);
  const candidates = Array.from({ length: size * size }, (_, index) => ({
    column: origin.column + index % size,
    row: origin.row + Math.floor(index / size)
  }));
  const distance = (tile: Coordinate) =>
    Math.abs(tile.column - origin.column - centre) + Math.abs(tile.row - origin.row - centre);
  return candidates.sort((a, b) => distance(a) - distance(b)).find(isAvailable) ?? null;
};
