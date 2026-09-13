import { INITIAL_FARM_CONFIG } from "../../game-data/initialFarm";
import type { FarmCoordinate } from "./irrigation";

export const isCardinallyAdjacentToFarmBuilding = (
  coordinate: FarmCoordinate
): boolean => {
  const bounds = INITIAL_FARM_CONFIG.buildingBounds;

  for (let row = bounds.minimumRow; row <= bounds.maximumRow; row += 1) {
    for (
      let column = bounds.minimumColumn;
      column <= bounds.maximumColumn;
      column += 1
    ) {
      if (
        Math.abs(coordinate.column - column) +
          Math.abs(coordinate.row - row) ===
        1
      ) {
        return true;
      }
    }
  }

  return false;
};
