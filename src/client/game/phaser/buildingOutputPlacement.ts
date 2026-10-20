import { isoPoint, type IsoCell } from "./isometricProjection";

export { roadsideOutputPlacement } from "../../../game-core/farm/roadsideOutputPlacement";

type Coordinate = { readonly column: number; readonly row: number };

/** Display finished goods inside the bottom-left tile, never on the access road. */
export const buildingOutputTile = (
  building: Coordinate,
  footprint: { readonly rows: number }
): Coordinate => ({ column: building.column, row: building.row + footprint.rows - 1 });

export const isometricOutputPosition = (tile: IsoCell) => {
  const p = isoPoint(tile);
  return { x: p.x, y: p.y + 16 };
};
