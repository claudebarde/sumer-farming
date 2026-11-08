import type { FarmSnapshot } from "../../schemas/farm";
import { farmerProductionJob } from "./farmerProduction";
import { productionIsPreparing } from "../../game-data/productionPreparation";
import { improvementWorkActive } from "../../game-data/farmImprovements";
import { isFarmerSleeping, sleepRemaining } from "../../game-data/farmerSleep";
export const farmerSleepBlocker = (snapshot: FarmSnapshot, now: number): string | null => {
  const f = snapshot.farm, p = f.production;
  if (isFarmerSleeping(f.sleep, now)) return null;
  if (f.carriedItem || p.delivery || f.millGoods.delivery || p.materialDelivery) return "Empty the farmer’s hands first.";
  if (f.gathering || f.fishing || p.planting || farmerProductionJob(f, now) || productionIsPreparing(f.milling, now) || productionIsPreparing(p.donkeyMilling, now) ||
    (p.materialGathering && !p.materialGathering.settled) || (p.cropWork && !p.cropWork.settled) ||
    f.roads.some(r => (r.completesAt ?? 0) > now) || snapshot.buildings.some(b => Date.parse(b.completesAt) > now) ||
    snapshot.improvements.some(i => improvementWorkActive(i, now)) || snapshot.crops.some(c => Date.parse(c.plantedAt) > now || c.harvestStartedAt !== null)) return "The farmer is busy.";
  return sleepRemaining(f.sleep, now) < 1000 ? "No sleep time available yet." : null;
};
