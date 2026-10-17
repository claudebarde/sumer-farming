import type { FarmSnapshot } from "../../schemas/farm";

export const PRODUCTION_OUTPUT_CAPACITY = 6;
export const OUTPUT_FULL_MESSAGE = "Store finished goods to make room";

/** Flour and groats share the mill's pile; limits apply per producer. */
export const productionOutputQuantity = (farm: Pick<FarmSnapshot["farm"], "millGoods" | "production">, buildingId: string): number => {
  const bags = farm.millGoods.pending[buildingId];
  return bags ? bags.flour + bags.brewersGroats : farm.production.pending[buildingId]?.quantity ?? 0;
};

export const productionOutputFits = (farm: Pick<FarmSnapshot["farm"], "millGoods" | "production">, buildingId: string, batchOutput: number): boolean =>
  productionOutputQuantity(farm, buildingId) + batchOutput <= PRODUCTION_OUTPUT_CAPACITY;
