import type { BatchPlanting } from "../../../game-data/batchPlanting";
import { positionAlongPorterPath } from "./porterPresentation";

/** Presentation samples the same saved leg/deadline that advances the server job. */
export const batchTravelPresentation = (batch: BatchPlanting, now: number) => {
  const path = batch.phase.type === "collecting" ? batch.collectionPath
    : batch.phase.type === "ready" ? batch.travelPaths?.[0] : undefined;
  if (!path?.length || !batch.travelStartedAt || !batch.nextStepAt) return null;
  const start = Date.parse(batch.travelStartedAt);
  const end = Date.parse(batch.nextStepAt);
  return positionAlongPorterPath(path, end <= start ? 1 : (now - start) / (end - start));
};
