import { barleyHasExpired, barleyHarvestYield, BARLEY_WITHERING_MS, BARLEY_CLEARING_MS } from "../../../game-core/farm/barleyDecay";
import type { FarmSnapshot } from "../../../schemas/farm";
import { CROP_DEFINITIONS } from "../../../game-data/crops";

type Crop = FarmSnapshot["crops"][number];
export const cropStageLabel = (crop: Crop, now: number): string | null => {
  if (crop.cropKey === "datePalm") {
    if (now < Date.parse(crop.plantedAt) + CROP_DEFINITIONS.datePalm.growthDurationMs / 2) return "Sapling";
    const harvested = crop.harvestCompletesAt && now >= Date.parse(crop.harvestCompletesAt);
    return now >= Date.parse(crop.growthCompletesAt) && !harvested ? "Ripe" : "Growing";
  }
  if (barleyHasExpired(crop, now)) return null;
  if (crop.harvestCompletesAt && now >= Date.parse(crop.harvestCompletesAt)) return null;
  if (now < Date.parse(crop.plantedAt)) return "Seeds";
  const sprite = cropSprite(crop, now);
  if (sprite === "barleyWithering") return "Withering";
  if (sprite === "barleySeeded") return "Seeds";
  return now >= Date.parse(crop.growthCompletesAt) ? "Ripe" : "Growing";
};

export const cropSprite = (crop: Crop, now: number) => {
  const planted = Date.parse(crop.plantedAt);
  const ready = Date.parse(crop.growthCompletesAt);
  const definition = CROP_DEFINITIONS[crop.cropKey];
  if (now < planted || barleyHasExpired(crop, now)) return null;
  if (crop.cropKey === "sesame") {
    if (crop.harvestCompletesAt && now >= Date.parse(crop.harvestCompletesAt)) return null;
    return now >= ready ? "sesameRipe" : now >= planted + 35 * 60_000 ? "sesameFlowering"
      : now >= planted + 15 * 60_000 ? "sesameGrowing" : "sesameYoung";
  }
  if (crop.cropKey === "barley" && barleyHarvestYield(crop, now) === 1) return "barleyWithering";
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
  return [planted, ...(crop.cropKey === "sesame" ? [planted + 15 * 60_000, planted + 35 * 60_000] : [middle]), ready, ...(crop.cropKey === "barley" && crop.decayEligible && !crop.harvestStartedAt ? [ready + BARLEY_WITHERING_MS, ready + BARLEY_CLEARING_MS] : []), ...(crop.harvestCompletesAt ? [Date.parse(crop.harvestCompletesAt)] : [])].filter(t => t > now).sort((a,b) => a-b)[0] ?? null;
};
