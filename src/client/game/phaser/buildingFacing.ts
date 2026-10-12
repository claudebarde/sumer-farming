import { isoPoint, type IsoCell } from "./isometricProjection";

/** Face the building in screen space, not by map column or the last walking step.
 * Farm/granary footprints are square, so their centre shares the origin's screen X.
 * A vertically aligned building retains the previous direction (two-sided sprites).
 */
export const buildingFacingLeft = (position: IsoCell, building: IsoCell, previous = false): boolean => {
  const difference = isoPoint(building).x - isoPoint(position).x;
  return Math.abs(difference) < 0.001 ? previous : difference < 0;
};
