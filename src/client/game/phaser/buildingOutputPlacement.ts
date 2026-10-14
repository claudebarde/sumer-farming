import { isoPoint } from "./isometricProjection";

type Coordinate = { readonly column: number; readonly row: number };

/** Display finished goods inside the bottom-left tile, never on the access road. */
export const buildingOutputTile = (
  building: Coordinate,
  footprint: { readonly rows: number }
): Coordinate => ({ column: building.column, row: building.row + footprint.rows - 1 });

/** Mill bags sit low in the lower-left tile, independent of road/loading access. */
export const isometricMillOutputPosition = (building: Coordinate) => {
  const point = isoPoint(buildingOutputTile(building, { rows: 2 }));
  return { x: point.x, y: point.y + 16 };
};
