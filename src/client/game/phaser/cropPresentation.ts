import type { FarmSnapshot } from "../../../schemas/farm";
import { CROP_DEFINITIONS } from "../../../game-data/crops";

type Crop = FarmSnapshot["crops"][number];
export const cropSprite = (crop: Crop, now: number) => {
  const planted = Date.parse(crop.plantedAt);
  const ready = Date.parse(crop.growthCompletesAt);
  const definition = CROP_DEFINITIONS[crop.cropKey];
  if (now < planted) return null;
  if (definition.kind === "perennial") {
    if (now < planted + definition.growthDurationMs) return definition.sprites.young;
    const harvesting = crop.harvestCompletesAt && now >= Date.parse(crop.harvestCompletesAt);
    return now >= ready && !harvesting ? definition.sprites.ready : definition.sprites.growing;
  }
  return now >= ready ? definition.sprites.ready : now >= planted + (ready - planted) / 3 ? definition.sprites.growing : definition.sprites.young;
};
export const nextCropTransition = (crop: Crop, now: number): number | null => {
  const planted = Date.parse(crop.plantedAt);
  const ready = Date.parse(crop.growthCompletesAt);
  const definition = CROP_DEFINITIONS[crop.cropKey];
  const middle = definition.kind === "perennial" ? planted + definition.growthDurationMs : planted + (ready - planted) / 3;
  return [planted, middle, ready, ...(crop.harvestCompletesAt ? [Date.parse(crop.harvestCompletesAt)] : [])].filter(t => t > now).sort((a,b) => a-b)[0] ?? null;
};
