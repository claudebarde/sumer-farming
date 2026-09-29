import { MILL_RECIPES, type MillRecipe } from "../../game-data/milling";
import type { FarmSnapshot } from "../../schemas/farm";

export const millingBarleyAvailable = (snapshot: FarmSnapshot, now: number): number =>
  (snapshot.inventory.find(i => i.itemKey === "barley")?.quantity ?? 0) +
  snapshot.buildings.filter(b => b.type === "granary" && Date.parse(b.completesAt) <= now).reduce((sum, b) => sum + b.storedBarley, 0) +
  (snapshot.farm.carriedItem?.itemKey === "barley" && snapshot.farm.carriedItem.expiresAt !== null && Date.parse(snapshot.farm.carriedItem.expiresAt) > now ? snapshot.farm.carriedItem.quantity : 0);

export const millingUnavailableReason = (snapshot: FarmSnapshot, recipe: MillRecipe, now: number): string | null => {
  if (snapshot.farm.millGoods.delivery) return "Store the processed grain at the granary first.";
  if ((snapshot.farm.progression?.level ?? 1) < 5) return "The Mill unlocks at farm level 5.";
  if (snapshot.farm.milling) return "The farmer is already milling.";
  if (snapshot.farm.fishing || snapshot.farm.gathering ||
    snapshot.crops.some(c => Date.parse(c.plantedAt) > now || c.harvestStartedAt !== null) ||
    snapshot.buildings.some(b => Date.parse(b.completesAt) > now) ||
    snapshot.improvements.some(i => Date.parse(i.completesAt) > now || i.destroyStartedAt !== null)) return "Wait for the farmer to finish the current task.";
  if (snapshot.farm.carriedItem && snapshot.farm.carriedItem.itemKey !== "barley") return "Empty the farmer's hands or bring barley.";
  if (millingBarleyAvailable(snapshot, now) < MILL_RECIPES[recipe].barley) return "Bring barley or store it in the farm or a completed granary.";
  return null;
};

export const millSprite = (buildingId: string, job: FarmSnapshot["farm"]["milling"]) =>
  job?.buildingId === buildingId ? "millBusy" as const : "mill" as const;

// The collection trip is visual; inventory is committed only at the Mill.
export const millingCollectionSource = (snapshot: FarmSnapshot, now: number) => {
  const granary = snapshot.buildings.find(b => b.type === "granary" &&
    b.storedBarley > 0 && Date.parse(b.completesAt) <= now);
  if (granary) return { type: "granary" as const, column: granary.column, row: granary.row };
  return (snapshot.inventory.find(i => i.itemKey === "barley")?.quantity ?? 0) > 0
    ? { type: "farm" as const } : null;
};
