import { currentCropWork } from "../../../game-data/cropWork";
import type { FarmSnapshot } from "../../../schemas/farm";
import { farmerProductionJob } from "../../../game-core/farm/farmerProduction";
import { isometricPlantingPose } from "./isometricPlanting";
import type { InventoryItemKey } from "../../../game-data/inventoryItems";
export type FarmerActivityItem = "barley" | "sesame" | "flour" | "brewersGroats" | "reed" | "clay" | "fish" | "road" | "canal" | "bread" | "beer" | "dates" | "stool" | "pickaxe" | "water";
export type FarmerActivity = { readonly label: string; readonly item?: FarmerActivityItem; readonly quantity?: number };
const activity = (label: string, item?: FarmerActivityItem, quantity?: number): FarmerActivity => ({ label, item, quantity });
const carriedIcons: Partial<Record<InventoryItemKey, FarmerActivityItem>> = {
  barley: "barley", flour: "flour", brewersGroats: "brewersGroats", reed: "reed", clay: "clay",
  fish: "fish", bread: "bread", beer: "beer", dates: "dates", sesame: "sesame", water: "water",
};

export const farmerActivity = (snapshot: FarmSnapshot, now: number, walking = false): FarmerActivity => {
  const farm = snapshot.farm;
  const batch = farm.production.planting;
  const cropWork = currentCropWork(farm.production, now);
  if (cropWork && !cropWork.settled) return activity(now < cropWork.workStartsAt ? "Walking"
    : now < cropWork.workEndsAt ? cropWork.action === "plant" ? "Planting" : cropWork.action === "tend" ? "Tending" : "Harvesting" : "Storing", cropWork.cropKey === "sesame" ? "sesame" : "dates");
  if (batch) {
    if (batch.phase.type === "delivering") return activity("Storing", "barley");
    if (batch.mode === "harvest") return activity(batch.phase.type === "harvesting" ? "Harvesting" : "Walking", "barley");
    const pose = isometricPlantingPose(batch, now);
    return activity(pose?.type === "sowing" ? "Sowing" : batch.phase.type === "collecting" ? "Collecting" : "Walking", batch.cropKey ?? "barley");
  }
  if (farm.millGoods.delivery) return activity("Storing", "flour");
  if (farm.production.delivery) return activity("Storing", farm.production.delivery.itemKey);
  const job = farmerProductionJob(farm, now);
  if (job?.type === "milling") return farm.milling && Date.parse(farm.milling.startedAt) > now ? activity("Collecting", "barley") : activity("Milling", "flour");
  if (job?.type === "baking") return activity("Baking", "bread");
  if (job?.type === "brewing") return activity("Brewing", "beer");
  if (farm.fishing) return activity("Fishing", "fish");
  if (farm.gathering) return activity("Collecting", farm.gathering.itemKey);
  if (snapshot.buildings.some(b => Date.parse(b.completesAt) > now)) return activity("Building", "pickaxe");
  if (farm.roads.some(r => (r.completesAt ?? 0) > now)) return activity("Building", "road");
  if (snapshot.improvements.some(i => i.destroyCompletesAt && Date.parse(i.destroyCompletesAt) > now)) return activity("Destroying", "canal");
  if (snapshot.improvements.some(i => Date.parse(i.completesAt) > now)) return activity("Building", "canal");
  if (snapshot.crops.some(c => c.harvestStartedAt !== null)) return activity("Harvesting", "barley");
  if (walking) return farm.carriedItem?.itemKey === "water" && farm.carriedItem.quantity > 0
    ? activity("Walking", "water", farm.carriedItem.quantity) : activity("Walking");
  const carried = farm.carriedItem;
  return carried && carried.quantity > 0 ? activity("Carrying", carriedIcons[carried.itemKey], carried.quantity) : activity("Idle", "stool");
};
