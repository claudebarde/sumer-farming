import type { FarmSnapshot } from "../../../schemas/farm";
import { INITIAL_FARM_CONFIG } from "../../../game-data/initialFarm";
import { estateResourceCapacity } from "../../../game-data/storage";
import { plantingBlocker } from "./isometricPlanting";
import { buildingAt, farmOrigin, GROUND_ITEM_ORIGIN, presentCanals, sameCell } from "./isometricFarm";
import { footprintContains, type IsoCell } from "./isometricProjection";
import { pickupPath, pickupPose } from "./isometricPickup";

export const materialLabel = (key: string) => key === "reed" ? "reeds" : key;
/** Clay-only visual trial: equivalent to the approved ground-item origin at 64px. */
export const gatheringOffsetY = (itemKey: "reed" | "clay", walking: boolean) =>
  itemKey === "clay" && !walking ? (120 / 128 - GROUND_ITEM_ORIGIN.y) * 64 : 0;
export const materialCarry = (snapshot: FarmSnapshot) => {
  const carry = snapshot.farm.carriedItem;
  return carry && (carry.itemKey === "reed" || carry.itemKey === "clay") ? carry : null;
};
/** Carrying materials permits walking/dropping/storing, but not another job. */
export const transferBlocker = (snapshot: FarmSnapshot, now: number) => plantingBlocker({ ...snapshot,
  farm: { ...snapshot.farm, carriedItem: materialCarry(snapshot) ? null : snapshot.farm.carriedItem,
    production: { ...snapshot.farm.production, materialDelivery: materialCarry(snapshot) ? false : snapshot.farm.production.materialDelivery } } }, now);

export const gatherableResource = (snapshot: FarmSnapshot, cell: IsoCell, now: number): "reed" | "clay" | null => {
  if (cell.row !== INITIAL_FARM_CONFIG.riverRow - 1 || snapshot.farm.carriedItem || plantingBlocker(snapshot, now)) return null;
  const object = snapshot.objects.find(o => sameCell(o, cell));
  const key = object?.type === "reeds" ? "reed" : "clay";
  if (key === "clay" && (object || buildingAt(snapshot, cell) || footprintContains(farmOrigin, 2, 2, cell) ||
    snapshot.crops.some(c => sameCell(c, cell)) || snapshot.groundItems.some(i => sameCell(i, cell)) ||
    presentCanals(snapshot, now).some(c => sameCell(c, cell)) || snapshot.farm.roads.some(r => sameCell(r, cell)))) return null;
  const stored = snapshot.inventory.find(i => i.itemKey === key)?.quantity ?? 0;
  if (stored >= estateResourceCapacity(key, snapshot.buildings, now)) return null;
  return key;
};

/** Enter only the selected reed source; all other scenery remains an obstacle. */
export const gatheringPath = (snapshot: FarmSnapshot, from: IsoCell, target: IsoCell, now: number) =>
  pickupPath({ ...snapshot, objects: snapshot.objects.filter(object =>
    object.type !== "reeds" || !sameCell(object, target)) }, from, target, now);
export const gatheringPose = (snapshot: FarmSnapshot, now: number, approach?: { path: readonly IsoCell[]; startedAt: number } | null) => {
  const job = snapshot.farm.gathering;
  if (!job) return null;
  const target = job.target;
  const path = approach?.path ?? [target];
  const pose = pickupPose(path, approach?.startedAt ?? Date.parse(job.startedAt), now);
  return { ...pose, itemKey: job.itemKey, elapsed: Math.max(0, now - Date.parse(job.startedAt)) };
};
