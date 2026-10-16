import type { FarmSnapshot } from "../../../schemas/farm";
import { INITIAL_FARM_CONFIG } from "../../../game-data/initialFarm";
import { estateResourceCapacity } from "../../../game-data/storage";
import { plantingBlocker } from "./isometricPlanting";
import { buildingAt, farmOrigin, GROUND_ITEM_ORIGIN, insidePlot, presentCanals, sameCell } from "./isometricFarm";
import { footprintContains, type IsoCell } from "./isometricProjection";
import { pickupPath, pickupPose } from "./isometricPickup";

export const materialLabel = (key: string, quantity?: number) => key === "reed" && quantity !== 1 ? "reeds" : key;
/** Clay-only visual trial: equivalent to the approved ground-item origin at 64px. */
export const gatheringOffsetY = (itemKey: "reed" | "clay", walking: boolean) =>
  itemKey === "clay" && !walking ? (120 / 128 - GROUND_ITEM_ORIGIN.y) * 64 : 0;
export const materialCarry = (snapshot: FarmSnapshot) => {
  const carry = snapshot.farm.carriedItem;
  return carry && (carry.itemKey === "reed" || carry.itemKey === "clay") ? carry : null;
};
/** Carrying materials permits walking/dropping/storing, but not another job. */
export const transferBlocker = (snapshot: FarmSnapshot, now: number) => plantingBlocker({ ...snapshot,
    farm: { ...snapshot.farm, carriedItem: materialCarry(snapshot) || snapshot.farm.carriedItem?.itemKey === "fish" || snapshot.farm.carriedItem?.itemKey === "water" ? null : snapshot.farm.carriedItem,
    production: { ...snapshot.farm.production, materialDelivery: materialCarry(snapshot) ? false : snapshot.farm.production.materialDelivery } } }, now);

export const gatherableResource = (snapshot: FarmSnapshot, cell: IsoCell, now: number): "reed" | "clay" | null => {
  if (cell.row !== INITIAL_FARM_CONFIG.riverRow - 1 || snapshot.farm.carriedItem || plantingBlocker(snapshot, now)) return null;
  const object = snapshot.objects.find(o => sameCell(o, cell));
  const key = object?.type === "reeds" ? "reed" : "clay";
  if (key === "clay" && (insidePlot(cell) || object || buildingAt(snapshot, cell) || footprintContains(farmOrigin, 2, 2, cell) ||
    snapshot.crops.some(c => sameCell(c, cell)) || snapshot.groundItems.some(i => sameCell(i, cell)) ||
    presentCanals(snapshot, now).some(c => sameCell(c, cell)) || snapshot.farm.roads.some(r => sameCell(r, cell)))) return null;
  const stored = snapshot.inventory.find(i => i.itemKey === key)?.quantity ?? 0;
  if (stored >= estateResourceCapacity(key, snapshot.buildings, now)) return null;
  return key;
};

/** Prefer the upper-right bank approach to reeds; retain access when that route
 * is blocked. The final logical cell remains the source for subsequent routing. */
export const gatheringPath = (snapshot: FarmSnapshot, from: IsoCell, target: IsoCell, now: number) => {
  const reeds = snapshot.objects.some(object => object.type === "reeds" && sameCell(object, target));
  if (reeds && !sameCell(from, target)) {
    const approach = pickupPath(snapshot, from, { column: target.column, row: target.row - 1 }, now);
    if (approach) return [...approach, target];
  }
  return pickupPath({ ...snapshot, objects: snapshot.objects.filter(object =>
    object.type !== "reeds" || !sameCell(object, target)) }, from, target, now);
};
export const gatheringPose = (snapshot: FarmSnapshot, now: number, approach?: { path: readonly IsoCell[]; startedAt: number } | null) => {
  const job = snapshot.farm.gathering;
  if (!job) return null;
  const target = job.target;
  const path = approach?.path ?? [target];
  const pose = pickupPose(path, approach?.startedAt ?? Date.parse(job.startedAt), now);
  // +18px right / -9px up: close enough for the patch to cover the farmer's
  // lower-left side. Interpolate into this pose instead of snapping on arrival.
  const visualPath = job.itemKey === "reed" ? path.map((cell, index) => index === path.length - 1
    ? { column: target.column, row: target.row - 0.375 } : cell) : path;
  const visual = pickupPose(visualPath, approach?.startedAt ?? Date.parse(job.startedAt), now);
  return { ...pose, visualPosition: visual.position,
    facingLeft: job.itemKey === "reed" && !pose.walking ? true : visual.facingLeft,
    itemKey: job.itemKey, elapsed: Math.max(0, now - Date.parse(job.startedAt)) };
};
