import { millingJobs, type MillingState } from '../../game-data/millingJobs';
import type { ProductionState } from '../../game-data/production';
import type { ProductionJourney } from '../../game-data/productionJourney';
import type { InventoryItemKey } from '../../game-data/inventoryItems';

type State = MillingState & { production?: Partial<ProductionState> };

/** Physical display only. Never use these quantities to validate spending or capacity. */
export const productionIngredientsAwaitingPickup = (farm: State, storageId: string, now: number): Partial<Record<InventoryItemKey, number>> => {
  const result: Partial<Record<InventoryItemKey, number>> = {};
  const add = (journey: ProductionJourney | undefined, arrivedAt: string, item?: InventoryItemKey) => {
    if (!journey || now >= Date.parse(arrivedAt)) return;
    for (const stop of journey.supplyStops ?? []) {
      const key = stop.itemKey ?? item;
      if (key && (stop.buildingId ?? 'farm') === storageId && now < journey.departedAt + stop.index * journey.stepDurationMs) {
        result[key] = (result[key] ?? 0) + stop.quantity;
      }
    }
  };
  for (const job of millingJobs(farm)) add(job.preparation, job.startedAt, job.recipe === 'oil' ? 'sesame' : 'barley');
  for (const job of Object.values(farm.production?.baking ?? {})) add(job.preparation, job.startedAt, 'flour');
  for (const job of Object.values(farm.production?.brewing ?? {})) add(job.preparation, job.arrivedAt, 'brewersGroats');
  const cooking = farm.production?.cooking;
  if (cooking) add(cooking.preparation, cooking.startedAt);
  const planting = farm.production?.planting;
  if (planting && planting.mode !== 'harvest' && planting.phase.type === 'collecting') {
    const item = planting.cropKey ?? 'barley';
    for (const stop of planting.seedPickups ?? []) {
      if (stop.storageId === storageId && now < stop.pickupAt) result[item] = (result[item] ?? 0) + stop.quantity;
    }
  }
  return result;
};
