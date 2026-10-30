const DAY = 24 * 60 * 60 * 1000;
export const BARLEY_WITHERING_MS = DAY;
export const BARLEY_CLEARING_MS = 2 * DAY;

type Crop = Readonly<{
  cropKey: string;
  decayEligible?: boolean;
  growthCompletesAt: string | Date;
  harvestStartedAt: string | Date | null;
}>;
const time = (value: string | Date) => typeof value === "string" ? Date.parse(value) : value.getTime();

/** Freeze yield when actual harvesting starts, not when selecting or completing it. */
export const barleyHarvestYield = (crop: Crop, now: number): number => {
  if (crop.cropKey !== "barley" || !crop.decayEligible) return 2;
  const age = (crop.harvestStartedAt === null ? now : time(crop.harvestStartedAt)) - time(crop.growthCompletesAt);
  return age >= BARLEY_CLEARING_MS ? 0 : age >= BARLEY_WITHERING_MS ? 1 : 2;
};

export const barleyHasExpired = (crop: Crop, now: number) =>
  crop.cropKey === "barley" && crop.decayEligible === true && crop.harvestStartedAt === null && barleyHarvestYield(crop, now) === 0;
