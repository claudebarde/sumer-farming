import type { FarmSnapshot } from "../../../schemas/farm";
import type { ProductionState } from "../../../game-data/production";
import { BREAD_RECIPE } from "../../../game-data/production";
import { activeBuildingUpgrade } from "../../../game-data/buildingUpgrades";
import { estateResourceCapacity } from "../../../game-data/storage";
import { porterReserved } from "../../../game-data/porter";
import { plantingBlocker } from "./isometricPlanting";
import { isoPoint } from "./isometricProjection";
import { roadsideOutputPlacement } from "./buildingOutputPlacement";
import { breweryOutputPlacement } from "./isometricBrewing";
import { productionOutputFits } from "../../../game-core/farm/productionOutputCapacity";

export type BakingJob = ProductionState["baking"][string];
export const breadStorageBlocker = (snapshot: FarmSnapshot, id: string, now: number): string | null => {
  const oven = snapshot.buildings.find(b => b.id === id && (b.type === "breadOven" || b.type === "brewery"));
  const pending = snapshot.farm.production.pending[id];
  if (!oven || !pending?.quantity) return "No finished goods to store";
  if (!(oven.type === "brewery" ? breweryOutputPlacement(oven) : roadsideOutputPlacement(oven, snapshot.farm.roads, now)).pickup) return "No connected road for pickup";
  if (snapshot.farm.carriedItem) return "Empty your hands first";
  const busy = plantingBlocker(snapshot, now);
  if (busy) return busy;
  const room = Math.max(0, estateResourceCapacity(pending.itemKey, snapshot.buildings, now) -
    (snapshot.inventory.find(i => i.itemKey === pending.itemKey)?.quantity ?? 0) - porterReserved(snapshot.farm.production.porter, pending.itemKey));
  return room < pending.quantity ? `Not enough storage: ${room} spaces free, ${pending.quantity} needed. Use or sell stored goods first.` : null;
};
export const canStoreBread = (snapshot: FarmSnapshot, id: string, now: number) => breadStorageBlocker(snapshot, id, now) === null;
export const canBakeBread = (snapshot: FarmSnapshot, id: string, now: number) => {
  const oven = snapshot.buildings.find(b => b.id === id && b.type === "breadOven");
  return !!oven && Date.parse(oven.completesAt) <= now && (snapshot.farm.progression?.level ?? 1) >= 6 &&
    productionOutputFits(snapshot.farm, id, BREAD_RECIPE.output) &&
    !snapshot.farm.carriedItem && !plantingBlocker(snapshot, now) &&
    !activeBuildingUpgrade(snapshot.farm.production.buildingUpgrades, id, now) &&
    (snapshot.inventory.find(i => i.itemKey === "flour")?.quantity ?? 0) >= BREAD_RECIPE.flour;
};

export const bakingProgress = (job: BakingJob | undefined, now: number) => {
  if (!job || now < Date.parse(job.startedAt) || now >= Date.parse(job.completesAt)) return null;
  const elapsed = now - Date.parse(job.startedAt);
  return { elapsed, fraction: elapsed / Math.max(1, Date.parse(job.completesAt) - Date.parse(job.startedAt)) };
};

/** Keep the working oven clear, without blocking the surrounding road corridor. */
export const bakingDogArea = (snapshot: FarmSnapshot, now: number) => {
  const oven = snapshot.buildings.find(b => b.type === "breadOven" && bakingProgress(snapshot.farm.production.baking[b.id], now));
  if (!oven) return null;
  const job = snapshot.farm.production.baking[oven.id]!;
  return {
    anchor: job.preparation?.path.at(-1) ?? oven.loadingTile ?? { column: oven.column, row: oven.row + 2 },
    reserved: [0, 1].flatMap(row => [0, 1].map(column => ({ column: oven.column + column, row: oven.row + row }))),
  };
};
export const bakingJourneyPose = (job: BakingJob | undefined, now: number) => {
  const journey = job?.preparation;
  if (!job || !journey || now >= Date.parse(job.startedAt)) return null;
  const step = Math.max(0, Math.min(journey.path.length - 1, (now - journey.departedAt) / journey.stepDurationMs));
  const index = Math.floor(step), fraction = step - index;
  const from = journey.path[index]!, to = journey.path[index + 1] ?? from;
  return { position: { column: from.column + (to.column - from.column) * fraction, row: from.row + (to.row - from.row) * fraction },
    carrying: step >= journey.supplyIndex, distance: step * Math.hypot(48, 24), facingLeft: isoPoint(to).x < isoPoint(from).x };
};
