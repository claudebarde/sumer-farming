import { INITIAL_FARM_CONFIG } from "../../../game-data/initialFarm";

export const MERCHANT_CHARIOT_WIDTH_TILES = 3;

/** Keep the entire sprite beyond the arable plot's right boundary. */
export const merchantStopColumn = (farmColumn: number): number =>
  farmColumn + INITIAL_FARM_CONFIG.plotBounds.maximumColumn + 1 +
  MERCHANT_CHARIOT_WIDTH_TILES / 2;
