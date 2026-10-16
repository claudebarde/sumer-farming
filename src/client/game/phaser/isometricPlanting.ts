import type { BatchPlanting } from "../../../game-data/batchPlanting";
import type { FarmSnapshot } from "../../../schemas/farm";
import { INITIAL_FARM_CONFIG } from "../../../game-data/initialFarm";
import { CROP_DEFINITIONS } from "../../../game-data/crops";
import { farmerProductionJob } from "../../../game-core/farm/farmerProduction";
import { improvementWorkActive } from "../../../game-data/farmImprovements";
import { productionIsPreparing } from "../../../game-data/productionPreparation";
import { positionAlongPorterPath } from "./porterPresentation";
import { isoPoint, type IsoCell } from "./isometricProjection";
import { buildingFacingLeft } from "./buildingFacing";
import { WORKER_MOVE_DURATION_PER_TILE } from "../../../game-data/movement";

export type PlantingPose = { readonly type: "walking" | "sowing" | "idle" | "done"; readonly position: IsoCell; readonly seeds: number; readonly elapsed: number; readonly distance: number; readonly facingLeft: boolean; readonly completedFields: number };

export const plantingBlocker = (snapshot: FarmSnapshot, now: number): string | null => {
  const farm = snapshot.farm;
  if (farm.carriedItem && farm.carriedItem.itemKey !== "barley") return "Empty your hands first";
  if (farm.production.planting || farmerProductionJob(farm, now) || productionIsPreparing(farm.milling, now) || farm.fishing || farm.gathering ||
    farm.production.materialDelivery || farm.production.delivery || farm.millGoods.delivery ||
    (farm.production.cropWork && !farm.production.cropWork.settled) ||
    farm.roads.some(r => r.completesAt && r.completesAt > now) ||
    snapshot.buildings.some(b => Date.parse(b.completesAt) > now) ||
    snapshot.improvements.some(i => improvementWorkActive(i, now)) ||
    snapshot.crops.some(c => Date.parse(c.plantedAt) > now || c.harvestStartedAt !== null)) return "Farmer busy";
  return null;
};

/** Sample the persisted schedule, including phases elapsed since the last read.
 * Visual prediction only: never inserts crops, spends seeds or acknowledges work.
 */
export const isometricPlantingPose = (saved: BatchPlanting, now: number): PlantingPose | null => {
  if (saved.mode === "harvest") return null;
  let batch = saved;
  let position: IsoCell = batch.collectionPath?.[0] ?? batch.travelPaths?.[0]?.[0] ?? INITIAL_FARM_CONFIG.farmerSpawn;
  const pose = (type: PlantingPose["type"], seeds = batch.remaining.length): PlantingPose => ({ type, position, seeds, elapsed: 0, distance: 0, facingLeft: false,
    completedFields: Math.max(0, batch.total - batch.remaining.length - (batch.phase.type === "sowing" && type !== "done" ? 1 : 0)) });
  for (let step = 0; step < 150; step++) {
    if (batch.phase.type === "sowing") {
      position = batch.phase.target;
      const end = Date.parse(batch.phase.completesAt);
      if (now < end) return { ...pose("sowing"), elapsed: Math.max(0, now - (end - CROP_DEFINITIONS.barley.sowingDurationMs)) };
      if (batch.stopRequested || !batch.remaining.length) return pose("done", 0);
      batch = { ...batch, phase: { type: "ready" }, travelStartedAt: new Date(end).toISOString(), nextStepAt: new Date(end + (batch.travelMs?.[0] ?? 0)).toISOString() };
      continue;
    }
    if (batch.phase.type !== "ready" && batch.phase.type !== "collecting") return null;
    const collecting = batch.phase.type === "collecting";
    const path = collecting ? batch.collectionPath : batch.travelPaths?.[0];
    if (!path?.length || !batch.nextStepAt || !batch.travelStartedAt) return pose("idle", 0);
    const start = Date.parse(batch.travelStartedAt), end = Date.parse(batch.nextStepAt);
    // Legacy saves lack collectionTravelMs: infer their pace from a saved field
    // journey, preserving any mood modifier instead of stretching a short walk.
    const timedLeg = batch.travelPaths?.findIndex((leg, i) => leg.length > 1 && (batch.travelMs?.[i] ?? 0) > 0) ?? -1;
    const stepMs = timedLeg >= 0 ? batch.travelMs![timedLeg]! / (batch.travelPaths![timedLeg]!.length - 1) : WORKER_MOVE_DURATION_PER_TILE;
    const travel = collecting ? Math.min(end - start, batch.collectionTravelMs ?? (path.length - 1) * stepMs) : end - start;
    const fraction = travel <= 0 ? 1 : Math.min(1, Math.max(0, (now - start) / travel));
    position = positionAlongPorterPath(path, fraction);
    if (now < end) {
      const previous = isoPoint(positionAlongPorterPath(path, Math.max(0, fraction - 0.001)));
      const current = isoPoint(position);
      const distance = path.slice(1).reduce((sum, cell, i) => {
        const a = isoPoint(path[i]!), b = isoPoint(cell); return sum + Math.hypot(b.x - a.x, b.y - a.y);
      }, 0) * fraction;
      const facingLeft = collecting && fraction === 1 ? buildingFacingLeft(position, batch.source, current.x < previous.x) : current.x < previous.x;
      return { ...pose(path.length > 1 && fraction < 1 ? "walking" : "idle", collecting ? batch.carriedSeeds?.quantity ?? 0 : batch.remaining.length), distance, facingLeft };
    }
    if (collecting) {
      batch = { ...batch, phase: { type: "ready" }, travelStartedAt: new Date(end).toISOString(), nextStepAt: new Date(end + (batch.travelMs?.[0] ?? 0)).toISOString() };
    } else {
      if (batch.stopRequested || !batch.remaining.length) return pose("done", 0);
      const target = batch.remaining[0]!;
      batch = { ...batch, remaining: batch.remaining.slice(1), travelPaths: batch.travelPaths?.slice(1), travelMs: batch.travelMs?.slice(1),
        phase: { type: "sowing", target, completesAt: new Date(end + CROP_DEFINITIONS.barley.sowingDurationMs).toISOString() } };
    }
  }
  return pose("idle", 0);
};

/** Work-only progress: seed collection and walking do not consume sowing time. */
export const sowingProgress = (batch: BatchPlanting, now: number) => {
  const pose = isometricPlantingPose(batch, now);
  const completed = pose?.completedFields ?? 0;
  const perField = CROP_DEFINITIONS.barley.sowingDurationMs;
  const totalMs = perField * batch.total;
  const elapsedMs = completed * perField + (pose?.type === "sowing" ? pose.elapsed : 0);
  return { completed, totalMs, percentage: Math.floor(Math.max(0, Math.min(100, elapsedMs / totalMs * 100))) };
};
