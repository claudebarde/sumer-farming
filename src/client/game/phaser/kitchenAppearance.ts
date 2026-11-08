import { isoPoint, type IsoCell } from "./isometricProjection";

// Ground-contact centre of the stove + table, measured within the full artwork.
// Do not centre on the pot or the transparent canvas's bottom edge.
const groundCentres = {
  "kitchen-horizontal": { x: 0.5, y: 0.67 },
  "kitchen-vertical": { x: 0.49, y: 0.67 },
} as const;

/** Use saved road access for the same orientation and registration as placement. */
export const kitchenAppearance = (tile: IsoCell, loading: IsoCell | null) => {
  const point = isoPoint(tile);
  const texture = loading && loading.column !== tile.column ? "kitchen-vertical" : "kitchen-horizontal";
  const centre = groundCentres[texture];
  return { x: point.x + (0.5 - centre.x) * 128,
    y: point.y + (0.86 - centre.y) * (128 * 2 / 3), texture } as const;
};
