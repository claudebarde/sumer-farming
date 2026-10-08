import { and, eq, sql } from "drizzle-orm";
import type { DatabaseTransaction } from "../db/client";
import { farmCrops, farmBuildings, farms } from "../db/schema";
import { porterPath } from "../../game-core/farm/porter";
import { granaryCapacityForLevel } from "../../game-data/storage";
import type { BatchPlanting } from "../../game-data/batchPlanting";
import { lockedHarvestFieldLimit } from "../../game-core/farm/harvestCapacity";
import { CROP_DEFINITIONS } from "../../game-data/crops";
import { BARLEY_CONSUMPTION_INTERVAL_MS, EXPOSED_BARLEY_LIFETIME_MS } from "../../game-data/household";
import { addToMarketItemStorage, loadMarketItemStorage } from "./marketItemStorage";
import type { FarmCoordinate } from "../../game-core/farm/irrigation";
import { FARMER_MOVE_DURATION_PER_TILE } from "../../game-core/farm/batchPlantingTravel";
import { farmerMovementDurationMultiplier } from "../../game-core/farm/wellbeing";

export const planHarvestDelivery = async (tx: DatabaseTransaction, farm: typeof farms.$inferSelect, batch: BatchPlanting, at: number): Promise<BatchPlanting | null> => {
  if (!batch.lastHarvested) return null;
  const buildings = await tx.select().from(farmBuildings).where(eq(farmBuildings.farmId, farm.id));
  const mapped = buildings.map(b => ({ ...b, completesAt: b.completesAt.getTime() }));
  for (const granary of buildings.filter(b => b.type === "granary" && b.completesAt.getTime() <= at).sort((a, b) => a.id.localeCompare(b.id))) {
    const target = granary.loadingTile ?? { column: granary.column, row: granary.row + 2 };
    const path = porterPath(mapped, farm.roads, batch.lastHarvested, target, at);
    if (!path) continue;
    const duration = Math.ceil((path.length - 1) * FARMER_MOVE_DURATION_PER_TILE *
      farmerMovementDurationMultiplier(farm.happiness, farm.hungrySince !== null, farm.level));
    const completesAt = new Date(at + duration).toISOString();
    return { ...batch, remaining: [], nextStepAt: completesAt, phase: {
      type: "delivering", granaryId: granary.id, path: [...path], startedAt: new Date(at).toISOString(), completesAt
    } };
  }
  return null;
};

/** Caller holds the farm row lock; no browser callback is needed to advance time. */
export const advanceBatchPlanting = async (tx: DatabaseTransaction, farm: typeof farms.$inferSelect, now: Date) => {
  let batch: BatchPlanting | null = farm.production.planting ?? null;
  if (!batch) return farm;
  let changed = false;
  if (!batch.nextStepAt) {
    // Existing saved queues have no route timings. Preserve their work deadline,
    // and use tile-distance travel for the remaining legacy route.
    let position = batch.phase.type === "sowing" || batch.phase.type === "harvesting" ? batch.phase.target : batch.source;
    const travelMs = batch.remaining.map(target => {
      const duration = Math.ceil((Math.abs(position.column - target.column) + Math.abs(position.row - target.row)) *
        FARMER_MOVE_DURATION_PER_TILE * farmerMovementDurationMultiplier(farm.happiness, farm.hungrySince !== null, farm.level));
      position = target;
      return duration;
    });
    batch = { ...batch, travelMs, nextStepAt: new Date(farm.updatedAt.getTime() + (batch.phase.type === "collecting" ? 1000 : travelMs[0] ?? 0)).toISOString() };
    changed = true;
  }
  let cultivationStartedAt = farm.cultivationStartedAt;
  let nextBarleyConsumptionAt = farm.nextBarleyConsumptionAt;
  let carry: Partial<typeof farms.$inferInsert> = {};
  let carriedQuantity = farm.carriedItemQuantity;
  let carriedExpiresAt = farm.carriedItemExpiresAt;
  let progressionStats = farm.progressionStats;
  let lastHarvestDelivery = farm.production.lastHarvestDelivery;
  // At most 72 fields, each with a travel and work step.
  for (let step = 0; batch && step < 150; step++) {
    const deadline = Date.parse(batch.phase.type === "sowing" || batch.phase.type === "harvesting" || batch.phase.type === "delivering" ? batch.phase.completesAt : batch.nextStepAt!);
    if (deadline > now.getTime()) break;
    if (batch.phase.type === "delivering") {
      const phase = batch.phase;
      const [granary] = await tx.select().from(farmBuildings).where(and(eq(farmBuildings.id, phase.granaryId), eq(farmBuildings.farmId, farm.id)));
      const stored = granary?.type === "granary" && granary.completesAt.getTime() <= deadline
        ? Math.min(carriedQuantity, Math.max(0, granaryCapacityForLevel(farm.level) - granary.storedBarley)) : 0;
      if (stored > 0) await tx.update(farmBuildings).set({ storedBarley: granary!.storedBarley + stored }).where(eq(farmBuildings.id, phase.granaryId));
      carriedQuantity -= stored;
      carry = { carriedItemKey: carriedQuantity > 0 ? "barley" : null, carriedItemQuantity: carriedQuantity,
        carriedItemExpiresAt: carriedQuantity > 0 ? carriedExpiresAt : null };
      lastHarvestDelivery = { batchId: batch.id, target: phase.path.at(-1)!, completedAt: phase.completesAt, stored, remaining: carriedQuantity };
      batch = null; changed = true; break;
    } else if (batch.phase.type === "collecting") {
      batch = { ...batch, phase: { type: "ready" }, travelStartedAt: new Date(deadline).toISOString(), nextStepAt: new Date(deadline + (batch.travelMs?.[0] ?? 0)).toISOString() };
    } else if (batch.phase.type === "harvesting") {
      const target: FarmCoordinate = batch.phase.target;
      const [crop] = await tx.select().from(farmCrops).where(and(
        eq(farmCrops.farmId, farm.id), eq(farmCrops.column, target.column), eq(farmCrops.row, target.row)));
      if (!crop || crop.cropKey !== "barley" || !crop.harvestCompletesAt ||
        crop.harvestCompletesAt.getTime() > deadline ||
        (farm.carriedItemKey && farm.carriedItemKey !== "barley") ||
        carriedQuantity + CROP_DEFINITIONS.barley.harvestYield > lockedHarvestFieldLimit(batch) * CROP_DEFINITIONS.barley.harvestYield) break;
      await tx.delete(farmCrops).where(eq(farmCrops.id, crop.id));
      carriedQuantity += CROP_DEFINITIONS.barley.harvestYield;
      carriedExpiresAt ??= new Date(deadline + EXPOSED_BARLEY_LIFETIME_MS);
      carry = { carriedItemKey: "barley", carriedItemQuantity: carriedQuantity, carriedItemExpiresAt: carriedExpiresAt };
      progressionStats = { ...progressionStats,
        harvestedBarley: progressionStats.harvestedBarley + CROP_DEFINITIONS.barley.harvestYield,
        harvests: progressionStats.harvests + 1 };
      batch = { ...batch, lastHarvested: target, phase: { type: "ready" }, travelStartedAt: new Date(deadline).toISOString(), nextStepAt: new Date(deadline + (batch.travelMs?.[0] ?? 0)).toISOString() };
    } else if (batch.phase.type === "sowing") {
      batch = { ...batch, phase: { type: "ready" }, travelStartedAt: new Date(deadline).toISOString(), nextStepAt: new Date(deadline + (batch.travelMs?.[0] ?? 0)).toISOString() };
    } else if (batch.phase.type === "ready" && !batch.stopRequested && batch.remaining.length) {
      const target: FarmCoordinate = batch.remaining[0]!;
      if (batch.mode === "harvest") {
        const [crop] = await tx.select().from(farmCrops).where(and(
          eq(farmCrops.farmId, farm.id), eq(farmCrops.column, target.column), eq(farmCrops.row, target.row)));
        if (!crop || crop.cropKey !== "barley" || crop.growthCompletesAt.getTime() > deadline || crop.harvestStartedAt) break;
        const completesAt = new Date(deadline + CROP_DEFINITIONS.barley.harvestDurationMs);
        await tx.update(farmCrops).set({ harvestStartedAt: new Date(deadline), harvestCompletesAt: completesAt }).where(eq(farmCrops.id, crop.id));
        batch = { ...batch, remaining: batch.remaining.slice(1), travelMs: batch.travelMs?.slice(1), travelPaths: batch.travelPaths?.slice(1),
          phase: { type: "harvesting", target, completesAt: completesAt.toISOString() }, nextStepAt: completesAt.toISOString() };
      } else {
      const plantedAt = new Date(deadline + CROP_DEFINITIONS.barley.sowingDurationMs);
      const existing = await tx.select({ id: farmCrops.id }).from(farmCrops).where(and(
        eq(farmCrops.farmId, farm.id), eq(farmCrops.column, target.column), eq(farmCrops.row, target.row)));
      if (existing.length) break; // Never overwrite another crop or consume its seed.
      await tx.insert(farmCrops).values({ farmId: farm.id, cropKey: "barley", ...target,
        sowingStartedAt: new Date(deadline), plantedAt,
        growthCompletesAt: new Date(plantedAt.getTime() + CROP_DEFINITIONS.barley.growthDurationMs) });
      cultivationStartedAt ??= new Date(deadline);
      nextBarleyConsumptionAt ??= new Date(deadline + BARLEY_CONSUMPTION_INTERVAL_MS);
      batch = { ...batch, remaining: batch.remaining.slice(1), travelMs: batch.travelMs?.slice(1), travelPaths: batch.travelPaths?.slice(1),
        carriedSeeds: batch.carriedSeeds ? { ...batch.carriedSeeds, quantity: Math.max(0, batch.carriedSeeds.quantity - 1) } : undefined,
        phase: { type: "sowing", target, completesAt: plantedAt.toISOString() }, nextStepAt: plantedAt.toISOString() };
      }
    } else break;
    changed = true;
    if (batch.phase.type === "ready" && (batch.stopRequested || !batch.remaining.length)) {
      if (batch.mode !== "harvest") {
      const carried = batch.carriedSeeds?.quantity ?? 0;
      const stored = batch.remaining.length - carried;
      if (stored > 0) {
        const storage = await loadMarketItemStorage(tx, farm.id, "barley", now);
        if (storage.availableCapacity < stored) break;
        await addToMarketItemStorage(tx, storage, stored, now);
      }
      if (carried > 0) carry = { carriedItemKey: "barley", carriedItemQuantity: farm.carriedItemQuantity + carried,
        carriedItemExpiresAt: batch.carriedSeeds?.expiresAt ? new Date(batch.carriedSeeds.expiresAt) : farm.carriedItemExpiresAt };
      }
      batch = batch.mode === "harvest" && carriedQuantity > 0 ? await planHarvestDelivery(tx, farm, batch, deadline) : null;
    }
  }
  if (!changed) return farm;
  const [updated] = await tx.update(farms).set({ ...carry, progressionStats, cultivationStartedAt, nextBarleyConsumptionAt,
    production: { ...farm.production, planting: batch, lastHarvestDelivery }, version: sql`${farms.version} + 1`, updatedAt: now })
    .where(eq(farms.id, farm.id)).returning();
  return updated!;
};
