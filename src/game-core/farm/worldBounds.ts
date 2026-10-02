import { INITIAL_FARM_CONFIG } from "../../game-data/initialFarm";
import type { FarmCoordinate } from "./irrigation";

export const isInsideFarmWorld = ({ column, row }: FarmCoordinate): boolean => {
  const bounds = INITIAL_FARM_CONFIG.worldBounds;
  return column >= bounds.minimumColumn && column <= bounds.maximumColumn &&
    row >= bounds.minimumRow && row <= bounds.maximumRow;
};

export const isGatherableRiverbank = (position: FarmCoordinate): boolean =>
  isInsideFarmWorld(position) && Math.abs(position.row - INITIAL_FARM_CONFIG.riverRow) === 1;
