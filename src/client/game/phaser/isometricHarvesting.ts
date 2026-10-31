import { barleyHarvestYield, barleyHasExpired } from "../../../game-core/farm/barleyDecay";
import type { FarmSnapshot } from "../../../schemas/farm";
import { CROP_DEFINITIONS } from "../../../game-data/crops";
import { INITIAL_FARM_CONFIG } from "../../../game-data/initialFarm";
import { FARM_STORAGE_CAPACITY, granaryCapacityForLevel } from "../../../game-data/storage";
import { harvestDeliveryPlan, harvestFarmDeliveryPlan } from "../../../game-core/farm/harvestDelivery";
import { farmOrigin } from "./isometricFarm";
import { positionAlongPorterPath } from "./porterPresentation";
import { isoPoint, type IsoCell } from "./isometricProjection";
import { plantingBlocker } from "./isometricPlanting";
import { buildingFacingLeft } from "./buildingFacing";

/** Selection display only; accepted jobs keep their original total and capacity. */
export const harvestSelectionMaximum = (capacity: number, ripeFields: number) =>
  Math.min(capacity, ripeFields);

export const harvestingBlocker = (snapshot: FarmSnapshot, now: number) =>
  snapshot.farm.carriedItem ? "Empty your hands first" : plantingBlocker(snapshot, now);

/** Same work-only meter as sowing, sampled from the saved harvest animation timeline. */
export const harvestingProgress = (snapshot: FarmSnapshot, now: number) => {
  const batch = snapshot.farm.production.planting;
  if (batch?.mode !== "harvest") return { completed: 0, totalMs: 0, percentage: 0 };
  const pose = isometricHarvestPose(snapshot, now);
  const alreadyCompleted = batch.total - batch.remaining.length - (batch.phase.type === "harvesting" ? 1 : 0);
  const completed = Math.max(0, Math.min(batch.total, alreadyCompleted + (pose?.harvested.length ?? 0)));
  const perField = CROP_DEFINITIONS.barley.harvestDurationMs;
  const totalMs = perField * batch.total;
  const elapsedMs = completed * perField + (pose?.type === "harvesting" ? Math.min(perField, pose.elapsed) : 0);
  return { completed, totalMs, percentage: Math.floor(Math.max(0, Math.min(100, elapsedMs / totalMs * 100))) };
};

export type HarvestGain = { readonly cell: IsoCell; readonly at: number; readonly quantity: number };

export type HarvestPose = {
  readonly type: "walking" | "harvesting" | "idle" | "done";
  readonly position: IsoCell; readonly seeds: number; readonly elapsed: number;
  readonly distance: number; readonly facingLeft: boolean;
  readonly harvested: readonly IsoCell[];
  readonly gains: readonly HarvestGain[];
};

/** Read-only projection of a saved harvest, including the final granary journey. */
export const isometricHarvestPose = (snapshot: FarmSnapshot, now: number): HarvestPose | null => {
  let batch = snapshot.farm.production.planting;
  if (batch?.mode !== "harvest") return null;
  let position = batch.lastHarvested ?? batch.travelPaths?.[0]?.[0] ?? INITIAL_FARM_CONFIG.farmerSpawn;
  let quantity = snapshot.farm.carriedItem?.itemKey === "barley" ? snapshot.farm.carriedItem.quantity : 0;
  let buildings = snapshot.buildings.map(b => ({ ...b, completesAt: Date.parse(b.completesAt) }));
  const harvested: IsoCell[] = [];
  const gains: HarvestGain[] = [];
  const pose = (type: HarvestPose["type"]): HarvestPose => ({ type, position, seeds: quantity, elapsed: 0, distance: 0, facingLeft: false, harvested, gains });
  const travel = (path: readonly IsoCell[], start: number, end: number): HarvestPose => {
    const fraction = end <= start ? 1 : Math.max(0, Math.min(1, (now - start) / (end - start)));
    position = positionAlongPorterPath(path, fraction);
    const previous = isoPoint(positionAlongPorterPath(path, Math.max(0, fraction - 0.001)));
    const distance = path.slice(1).reduce((sum, p, i) => {
      const a = isoPoint(path[i]!), b = isoPoint(p); return sum + Math.hypot(b.x - a.x, b.y - a.y);
    }, 0) * fraction;
    return { ...pose(path.length > 1 && now < end ? "walking" : "idle"), distance, facingLeft: isoPoint(position).x < previous.x };
  };
  for (let step = 0; step < 150; step++) {
    if (batch.phase.type === "delivering") {
      const phase = batch.phase, end = Date.parse(phase.completesAt);
      const moving = travel(phase.path, Date.parse(phase.startedAt), end);
      const granary = buildings.find(b => b.id === phase.granaryId && (b.type === "granary" || b.type === "warehouse") && b.completesAt <= end);
      const destination = phase.granaryId === null ? farmOrigin : granary;
      const facingLeft = destination && end - now <= 150 ? buildingFacingLeft(position, destination, moving.facingLeft) : moving.facingLeft;
      if (now < end) return { ...moving, facingLeft };
      if (granary) {
        const deposited = Math.min(quantity, Math.max(0, (granary.type === "warehouse" ? 20 : granaryCapacityForLevel(snapshot.farm.progression?.level ?? 1)) - granary.storedBarley));
        quantity -= deposited;
        buildings = buildings.map(b => b.id === granary.id ? { ...b, storedBarley: b.storedBarley + deposited } : b);
      }
      const farmQuantity = snapshot.inventory.find(item => item.itemKey === "barley")?.quantity ?? 0;
      if (phase.granaryId === null) quantity -= Math.min(quantity, Math.max(0, FARM_STORAGE_CAPACITY - farmQuantity));
      else {
        const fallback = harvestFarmDeliveryPlan({ buildings, roads: snapshot.farm.roads,
          from: phase.path.at(-1)!, at: end, happiness: snapshot.farm.household.happiness, hungry: snapshot.farm.household.hungrySince !== null,
          level: snapshot.farm.progression?.level ?? 1, quantity, farmQuantity });
        if (fallback) { batch = { ...batch, phase: fallback }; continue; }
      }
      return { ...pose("done"), facingLeft };
    }
    let at: number;
    if (batch.phase.type === "harvesting") {
      position = batch.phase.target;
      at = Date.parse(batch.phase.completesAt);
      if (now < at) return { ...pose("harvesting"), elapsed: Math.max(0, now - at + CROP_DEFINITIONS.barley.harvestDurationMs) };
      const crop = snapshot.crops.find(c => c.column === position.column && c.row === position.row);
      harvested.push(position);
      const gained = crop ? barleyHarvestYield(crop, at - CROP_DEFINITIONS.barley.harvestDurationMs) : 0;
      if (gained > 0) gains.push({ cell: position, at, quantity: gained });
      quantity += gained;
      batch = { ...batch, lastHarvested: position, phase: { type: "ready" }, travelStartedAt: new Date(at).toISOString(), nextStepAt: new Date(at + (batch.travelMs?.[0] ?? 0)).toISOString() };
    } else if (batch.phase.type === "ready") {
      const path = batch.travelPaths?.[0];
      if (!path?.length || !batch.nextStepAt || !batch.travelStartedAt) return pose("idle");
      at = Date.parse(batch.nextStepAt);
      const moving = travel(path, Date.parse(batch.travelStartedAt), at);
      if (now < at) return moving;
      if (!batch.stopRequested && batch.remaining.length) {
        const target: IsoCell = batch.remaining[0]!;
        const crop = snapshot.crops.find(c => c.column === target.column && c.row === target.row);
        if (!crop || barleyHasExpired(crop, at)) {
          harvested.push(target);
          batch = { ...batch, lastHarvested: batch.lastHarvested ? target : undefined, remaining: batch.remaining.slice(1), travelPaths: batch.travelPaths?.slice(1), travelMs: batch.travelMs?.slice(1),
            travelStartedAt: new Date(at).toISOString(), nextStepAt: new Date(at + (batch.travelMs?.[1] ?? 0)).toISOString() };
          if (batch.remaining.length) continue;
        } else {
          batch = { ...batch, remaining: batch.remaining.slice(1), travelPaths: batch.travelPaths?.slice(1), travelMs: batch.travelMs?.slice(1),
            phase: { type: "harvesting", target: batch.remaining[0]!, completesAt: new Date(at + CROP_DEFINITIONS.barley.harvestDurationMs).toISOString() } };
          continue;
        }
      }
    } else return pose("idle");
    if (batch.stopRequested || !batch.remaining.length) {
      if (!batch.lastHarvested || quantity === 0) return pose("done");
      const phase = harvestDeliveryPlan({ buildings: snapshot.buildings.map(b => ({ ...b, completesAt: Date.parse(b.completesAt) })), roads: snapshot.farm.roads,
        from: batch.lastHarvested, at, happiness: snapshot.farm.household.happiness, hungry: snapshot.farm.household.hungrySince !== null, level: snapshot.farm.progression?.level ?? 1 });
      if (!phase) return pose("done");
      batch = { ...batch, phase };
    }
  }
  return pose("idle");
};
