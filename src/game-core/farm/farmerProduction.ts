import type { ProductionState } from "../../game-data/production";
import { productionIsPreparing } from "../../game-data/productionPreparation";

/** Persisted jobs own the farmer until the server completes them. */
export const farmerProductionJob = (farm: {
  readonly milling?: { readonly buildingId: string; readonly worker?: "farmer" | "donkey"; readonly startedAt?: string } | null;
  readonly production?: { readonly baking?: ProductionState["baking"] };
}, now = Date.now()) => {
  if (farm.milling && (farm.milling.worker !== "donkey" || productionIsPreparing(farm.milling, now))) return { type: "milling" as const, buildingId: farm.milling.buildingId };
  const ovenId = Object.keys(farm.production?.baking ?? {})[0];
  return ovenId ? { type: "baking" as const, buildingId: ovenId } : null;
};

export const breadOvenSprite = (buildingId: string, production: ProductionState) =>
  production.baking[buildingId] ? "breadOvenBusy" as const : "breadOven" as const;
