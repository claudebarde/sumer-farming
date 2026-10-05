import { LEGACY_BATCH_HARVEST_FIELDS, type BatchPlanting } from "../../game-data/batchPlanting";

export const harvestFieldLimit = (happiness: number): 4 | 6 | 8 =>
  happiness > 90 ? 8 : happiness > 50 ? 6 : 4;

/** Legacy jobs retain the four-field capacity they were accepted with. */
export const lockedHarvestFieldLimit = (batch: BatchPlanting): 4 | 6 | 8 =>
  batch.harvestFieldLimit ?? LEGACY_BATCH_HARVEST_FIELDS;
