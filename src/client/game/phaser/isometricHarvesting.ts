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

export const harvestingBlocker = (snapshot: FarmSnapshot, now: number) =>
  snapshot.farm.carriedItem ? "Empty your hands first" : plantingBlocker(snapshot, now);

export type HarvestPose = {
  readonly type: "walking" | "harvesting" | "idle" | "done";
  readonly position: IsoCell; readonly seeds: number; readonly elapsed: number;
  readonly distance: number; readonly facingLeft: boolean;
  readonly harvested: readonly IsoCell[];
};

/** Read-only projection of a saved harvest, including the final granary journey. */
export const isometricHarvestPose = (snapshot: FarmSnapshot, now: number): HarvestPose | null => {
  let batch = snapshot.farm.production.planting;
  if (batch?.mode !== "harvest") return null;
  let position = batch.lastHarvested ?? batch.travelPaths?.[0]?.[0] ?? INITIAL_FARM_CONFIG.farmerSpawn;
  let quantity = snapshot.farm.carriedItem?.itemKey === "barley" ? snapshot.farm.carriedItem.quantity : 0;
  const harvested: IsoCell[] = [];
  const pose = (type: HarvestPose["type"]): HarvestPose => ({ type, position, seeds: quantity, elapsed: 0, distance: 0, facingLeft: false, harvested });
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
      const granary = snapshot.buildings.find(b => b.id === phase.granaryId && b.type === "granary" && Date.parse(b.completesAt) <= end);
      const destination = phase.granaryId === null ? farmOrigin : granary;
      const facingLeft = destination && end - now <= 150 ? buildingFacingLeft(position, destination, moving.facingLeft) : moving.facingLeft;
      if (now < end) return { ...moving, facingLeft };
      if (granary) quantity -= Math.min(quantity, Math.max(0, granaryCapacityForLevel(snapshot.farm.progression?.level ?? 1) - granary.storedBarley));
      const farmQuantity = snapshot.inventory.find(item => item.itemKey === "barley")?.quantity ?? 0;
      if (phase.granaryId === null) quantity -= Math.min(quantity, Math.max(0, FARM_STORAGE_CAPACITY - farmQuantity));
      else {
        const fallback = harvestFarmDeliveryPlan({ buildings: snapshot.buildings.map(b => ({ ...b, completesAt: Date.parse(b.completesAt) })), roads: snapshot.farm.roads,
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
      harvested.push(position); quantity += CROP_DEFINITIONS.barley.harvestYield;
      batch = { ...batch, lastHarvested: position, phase: { type: "ready" }, travelStartedAt: new Date(at).toISOString(), nextStepAt: new Date(at + (batch.travelMs?.[0] ?? 0)).toISOString() };
    } else if (batch.phase.type === "ready") {
      const path = batch.travelPaths?.[0];
      if (!path?.length || !batch.nextStepAt || !batch.travelStartedAt) return pose("idle");
      at = Date.parse(batch.nextStepAt);
      const moving = travel(path, Date.parse(batch.travelStartedAt), at);
      if (now < at) return moving;
      if (!batch.stopRequested && batch.remaining.length) {
        batch = { ...batch, remaining: batch.remaining.slice(1), travelPaths: batch.travelPaths?.slice(1), travelMs: batch.travelMs?.slice(1),
          phase: { type: "harvesting", target: batch.remaining[0]!, completesAt: new Date(at + CROP_DEFINITIONS.barley.harvestDurationMs).toISOString() } };
        continue;
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
