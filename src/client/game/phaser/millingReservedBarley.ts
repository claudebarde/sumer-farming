import type { MillingState } from '../../../game-data/millingJobs';
import { productionIngredientsAwaitingPickup } from '../productionIngredientsAwaitingPickup';

/** Presentation only: reserved barley remains at its source until the saved pickup time. */
export const millingBarleyAwaitingPickup = (farm: MillingState, storageId: string, now: number): number =>
  productionIngredientsAwaitingPickup(farm, storageId, now).barley ?? 0;
