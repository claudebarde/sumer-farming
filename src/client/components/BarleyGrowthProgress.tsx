import type { FarmSnapshot } from "../../schemas/farm";
import CropGrowthProgress from "./CropGrowthProgress";

export default function BarleyGrowthProgress({ crop, now }: { crop: FarmSnapshot["crops"][number]; now: number }) {
  const start = Date.parse(crop.plantedAt), end = Date.parse(crop.growthCompletesAt);
  if (crop.cropKey !== "barley" || crop.harvestCompletesAt || now < start || now >= end) return null;
  return <>
    <p>The barley is growing. Harvest it once it is ripe.</p>
    <CropGrowthProgress percentage={(now - start) / Math.max(1, end - start) * 100}
      remainingMs={end - now} label="Barley growth" />
  </>;
}
