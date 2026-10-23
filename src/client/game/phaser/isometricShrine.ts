import type { FarmSnapshot } from "../../../schemas/farm";
import { shrineBlessingActive } from "../../../game-data/shrine";
import { plantingBlocker } from "./isometricPlanting";

export const shrineOfferingBlocker = (snapshot: FarmSnapshot, buildingId: string, item: "bread" | "beer", now: number): string | null => {
  const shrine = snapshot.buildings.find(b => b.id === buildingId && b.type === "smallShrine");
  if (!shrine || Date.parse(shrine.completesAt) > now) return "Wait for shrine construction to finish.";
  if ((snapshot.farm.progression?.level ?? 1) < 8) return "Unlock at level 8.";
  if (shrineBlessingActive(snapshot.farm.production.shrineBlessing, now)) return "Wait until the current blessing expires.";
  if (snapshot.farm.carriedItem) return "Empty the farmer’s hands first.";
  const busy = plantingBlocker(snapshot, now);
  if (busy) return busy;
  if ((snapshot.inventory.find(i => i.itemKey === item)?.quantity ?? 0) < 2) return `Store 2 ${item} first.`;
  if (!shrine.loadingTile) return "The shrine needs road access.";
  return null;
};
