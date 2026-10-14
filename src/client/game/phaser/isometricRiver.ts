import { INITIAL_FARM_CONFIG as config } from "../../../game-data/initialFarm";

/** Approved two-row presentation. The playable north bank and saved terrain stay unchanged. */
export const ISOMETRIC_RIVER_ROWS = [config.riverRow, config.riverRow + 1] as const;
export const isIsometricRiverRow = (row: number): boolean =>
  ISOMETRIC_RIVER_ROWS.some(riverRow => riverRow === row);
