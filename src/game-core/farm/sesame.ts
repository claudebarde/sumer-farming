import type { FarmSnapshot } from "../../schemas/farm";
import type { FarmCoordinate } from "./irrigation";
import { CROP_DEFINITIONS } from "../../game-data/crops";
import { estateResourceCapacity } from "../../game-data/storage";
import { plantableFields } from "./batchPlanting";
import { cropWorkActive } from "./perennialCrops";

export const sesameActionReason = (snapshot: FarmSnapshot, target: FarmCoordinate, action: "plant" | "harvest", now: number): string | null => {
  if ((snapshot.farm.progression?.level ?? 1) < 10) return "Unlocks at level 10";
  if (snapshot.farm.carriedItem) return "Empty your hands first";
  if (cropWorkActive(snapshot)) return "The farmer is busy";
  const stored = snapshot.inventory.find(item => item.itemKey === "sesame")?.quantity ?? 0;
  if (action === "plant") {
    if (!plantableFields(snapshot, now).some(cell => cell.column === target.column && cell.row === target.row)) return "Plant on empty irrigated arable ground";
    return stored >= 1 ? null : "Requires 1 basket of sesame";
  }
  const crop = snapshot.crops.find(c => c.cropKey === "sesame" && c.column === target.column && c.row === target.row);
  if (!crop) return "Sesame not found";
  if (crop.harvestStartedAt) return "Harvest already started";
  if (Date.parse(crop.growthCompletesAt) > now) return "Sesame is still growing";
  return estateResourceCapacity("sesame", snapshot.buildings, now) - stored >= CROP_DEFINITIONS.sesame.harvestYield
    ? null : "The warehouse needs space for 3 baskets of sesame";
};
