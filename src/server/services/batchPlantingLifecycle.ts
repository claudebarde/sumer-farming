import { and, eq, sql } from "drizzle-orm";
import type { DatabaseTransaction } from "../db/client";
import { farmCrops, farms } from "../db/schema";
import { MAX_BATCH_HARVEST_FIELDS, type BatchPlanting } from "../../game-data/batchPlanting";
import { CROP_DEFINITIONS } from "../../game-data/crops";
import { BARLEY_CONSUMPTION_INTERVAL_MS, EXPOSED_BARLEY_LIFETIME_MS } from "../../game-data/household";
import { addToMarketItemStorage, loadMarketItemStorage } from "./marketItemStorage";
import type { FarmCoordinate } from "../../game-core/farm/irrigation";
import { FARMER_MOVE_DURATION_PER_TILE } from "../../game-core/farm/batchPlantingTravel";
import { farmerMovementDurationMultiplier } from "../../game-core/farm/wellbeing";

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
  // At most 72 fields, each with a travel and work step.
  for (let step = 0; batch && step < 150; step++) {
    const deadline = Date.parse(batch.phase.type === "sowing" || batch.phase.type === "harvesting" ? batch.phase.completesAt : batch.nextStepAt!);
    if (deadline > now.getTime()) break;
    if (batch.phase.type === "collecting") {
      batch = { ...batch, phase: { type: "ready" }, nextStepAt: new Date(deadline + (batch.travelMs?.[0] ?? 0)).toISOString() };
    } else if (batch.phase.type === "harvesting") {
      const target = batch.phase.target;
      const [crop] = await tx.select().from(farmCrops).where(and(
        eq(farmCrops.farmId, farm.id), eq(farmCrops.column, target.column), eq(farmCrops.row, target.row)));
      if (!crop || crop.cropKey !== "barley" || !crop.harvestCompletesAt ||
        crop.harvestCompletesAt.getTime() > deadline ||
        (farm.carriedItemKey && farm.carriedItemKey !== "barley") ||
        carriedQuantity + CROP_DEFINITIONS.barley.harvestYield > MAX_BATCH_HARVEST_FIELDS * CROP_DEFINITIONS.barley.harvestYield) break;
      await tx.delete(farmCrops).where(eq(farmCrops.id, crop.id));
      carriedQuantity += CROP_DEFINITIONS.barley.harvestYield;
      carriedExpiresAt ??= new Date(deadline + EXPOSED_BARLEY_LIFETIME_MS);
      carry = { carriedItemKey: "barley", carriedItemQuantity: carriedQuantity, carriedItemExpiresAt: carriedExpiresAt };
      progressionStats = { ...progressionStats,
        harvestedBarley: progressionStats.harvestedBarley + CROP_DEFINITIONS.barley.harvestYield,
        harvests: progressionStats.harvests + 1 };
      batch = { ...batch, phase: { type: "ready" }, nextStepAt: new Date(deadline + (batch.travelMs?.[0] ?? 0)).toISOString() };
    } else if (batch.phase.type === "sowing") {
      batch = { ...batch, phase: { type: "ready" }, nextStepAt: new Date(deadline + (batch.travelMs?.[0] ?? 0)).toISOString() };
    } else if (batch.phase.type === "ready" && !batch.stopRequested && batch.remaining.length) {
      const target: FarmCoordinate = batch.remaining[0]!;
      if (batch.mode === "harvest") {
        const [crop] = await tx.select().from(farmCrops).where(and(
          eq(farmCrops.farmId, farm.id), eq(farmCrops.column, target.column), eq(farmCrops.row, target.row)));
        if (!crop || crop.cropKey !== "barley" || crop.growthCompletesAt.getTime() > deadline || crop.harvestStartedAt) break;
        const completesAt = new Date(deadline + CROP_DEFINITIONS.barley.harvestDurationMs);
        await tx.update(farmCrops).set({ harvestStartedAt: new Date(deadline), harvestCompletesAt: completesAt }).where(eq(farmCrops.id, crop.id));
        batch = { ...batch, remaining: batch.remaining.slice(1), travelMs: batch.travelMs?.slice(1),
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
      batch = { ...batch, remaining: batch.remaining.slice(1), travelMs: batch.travelMs?.slice(1),
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
      batch = null;
    }
  }
  if (!changed) return farm;
  const [updated] = await tx.update(farms).set({ ...carry, progressionStats, cultivationStartedAt, nextBarleyConsumptionAt,
    production: { ...farm.production, planting: batch }, version: sql`${farms.version} + 1`, updatedAt: now })
    .where(eq(farms.id, farm.id)).returning();
  return updated!;
};
