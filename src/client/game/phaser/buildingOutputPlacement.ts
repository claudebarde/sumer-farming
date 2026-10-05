type Coordinate = { readonly column: number; readonly row: number };

/** Display finished goods inside the bottom-left tile, never on the access road. */
export const buildingOutputTile = (
  building: Coordinate,
  footprint: { readonly rows: number }
): Coordinate => ({ column: building.column, row: building.row + footprint.rows - 1 });
