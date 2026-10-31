import { barleyHarvestYield } from "../../game-core/farm/barleyDecay";
import { eq, sql } from "drizzle-orm";
import { Data, Effect } from "effect";
import type { GameCommand } from "../../schemas/gameCommands";
import type { Database } from "../db/client";
import { farms, farmCrops } from "../db/schema";
import { readFarmSnapshot } from "./farmSnapshot";
import { advanceFarmLifecycle } from "./farmLifecycle";
import { assertFarmerAvailable, FarmerUnavailableError } from "./farmerAvailability";
import { fieldKey, orderPlantingFields, plantableFields, harvestableFields } from "../../game-core/farm/batchPlanting";
import { loadMarketItemStorage, removeFromMarketItemStorage, addToMarketItemStorage } from "./marketItemStorage";
import { INITIAL_FARM_CONFIG } from "../../game-data/initialFarm";
import { CROP_DEFINITIONS } from "../../game-data/crops";
import { BARLEY_CONSUMPTION_INTERVAL_MS, EXPOSED_BARLEY_LIFETIME_MS } from "../../game-data/household";
import type { BatchPlanting } from "../../game-data/batchPlanting";
import { harvestFieldLimit, lockedHarvestFieldLimit } from "../../game-core/farm/harvestCapacity";
import { plantingTravelMs, plantingTravelPath } from "../../game-core/farm/batchPlantingTravel";
import { planHarvestDelivery } from "./batchPlantingLifecycle";

export class BatchPlantingError extends Data.TaggedError("BatchPlantingError")<{ readonly message: string }> {}
export class BatchPlantingPersistenceError extends Data.TaggedError("BatchPlantingPersistenceError")<{ readonly cause: unknown }> {}

export const batchPlantingAction = (database: Database, input: Extract<GameCommand, { type: "start_batch_planting" | "start_batch_harvesting" | "advance_batch_planting" }> & { readonly playerId: string }) => Effect.tryPromise({
  try: () => database.transaction(async tx => {
    const fail = (message: string): never => { throw new BatchPlantingError({ message }); };
    const [loaded] = await tx.select().from(farms).where(eq(farms.playerId, input.playerId)).for("update");
    if (!loaded) return fail("The farm does not exist.");
    const now = new Date();
    const previousBatch = loaded.production.planting;
    const farm = await advanceFarmLifecycle(tx, loaded, now);
    // A timed queue may have advanced while an animation callback was in flight.
    // Return authoritative progress instead of replaying that obsolete step.
    if (input.type === "advance_batch_planting" && input.action !== "stop" &&
      previousBatch?.id === input.batchId &&
      (loaded.version !== input.expectedFarmVersion || farm.version !== loaded.version)) {
      return readFarmSnapshot(tx, farm, false);
    }
    if (loaded.version !== input.expectedFarmVersion) return fail("The farm changed. Please try again.");
    const snapshot = await readFarmSnapshot(tx, farm, false);
    let planting: BatchPlanting | null = farm.production.planting ?? null;
    let harvestUpdate: Partial<typeof farms.$inferInsert> = {};
    if (input.type !== "advance_batch_planting") {
      assertFarmerAvailable(farm);
      const harvesting = input.type === "start_batch_harvesting";
      const cropKey = input.type === "start_batch_planting" ? input.crop ?? "barley" : "barley";
      if (farm.level < CROP_DEFINITIONS[cropKey].unlockLevel) return fail(`Unlocks at level ${CROP_DEFINITIONS[cropKey].unlockLevel}`);
      const origin = input.farmerPosition && plantingTravelPath(snapshot, INITIAL_FARM_CONFIG.farmerSpawn, input.farmerPosition, now.getTime())
        ? input.farmerPosition : INITIAL_FARM_CONFIG.farmerSpawn;
      const pathTo = (from: typeof origin, to: typeof origin) => {
        const path = plantingTravelPath(snapshot, from, to, now.getTime());
        if (!path) return fail("The selected field or seed storage cannot be reached.");
        return [...path];
      };
      if (planting || (farm.carriedItemKey && (harvesting || cropKey === "sesame" || farm.carriedItemKey !== "barley")) || farm.gatheringItemKey ||
        snapshot.crops.some(c => Date.parse(c.plantedAt) > now.getTime() || c.harvestStartedAt !== null) ||
        snapshot.buildings.some(b => Date.parse(b.completesAt) > now.getTime()) ||
        snapshot.improvements.some(i => Date.parse(i.completesAt) > now.getTime() || i.destroyStartedAt !== null)) return fail("Finish the current task and empty your hands first.");
      const limit = harvestFieldLimit(farm.happiness);
      if (input.targets.length < 1 || input.targets.length > limit) return fail(`Select up to ${limit} fields to ${harvesting ? "harvest" : "plant"} at ${farm.happiness}% happiness.`);
      const eligible = new Set((harvesting ? harvestableFields : plantableFields)(snapshot, now.getTime()).map(fieldKey));
      if (new Set(input.targets.map(fieldKey)).size !== input.targets.length || input.targets.some(p => !eligible.has(fieldKey(p)))) return fail(harvesting ? "Select distinct ripe barley fields." : "Select distinct empty, irrigated arable fields.");
      if (harvesting) {
        const source = { type: "farm" as const, column: INITIAL_FARM_CONFIG.buildingBounds.minimumColumn, row: INITIAL_FARM_CONFIG.buildingBounds.minimumRow };
        planting = { id: crypto.randomUUID(), mode: "harvest", harvestFieldLimit: limit, total: input.targets.length, remaining: [...orderPlantingFields(input.targets, input.targets[0]!)], source, stopRequested: false, phase: { type: "ready" } };
        let position: { column: number; row: number } = origin;
        const travelPaths = planting.remaining.map(target => { const path = pathTo(position, target); position = target; return path; });
        position = origin;
        const travelMs = planting.remaining.map(target => {
          const duration = plantingTravelMs(snapshot, position, target, now.getTime());
          position = target;
          return duration;
        });
        planting = { ...planting, travelMs, travelPaths, travelStartedAt: now.toISOString(), nextStepAt: new Date(now.getTime() + (travelMs[0] ?? 0)).toISOString() };
      } else {
      const storage = await loadMarketItemStorage(tx, farm.id, cropKey, now);
      const carried = cropKey === "barley" ? Math.min(farm.carriedItemQuantity, input.targets.length) : 0;
      const stored = input.targets.length - carried;
      if (storage.storedQuantity < stored) return fail(`Not enough ${cropKey} for these fields.`);
      const granary = snapshot.buildings.find(b => Date.parse(b.completesAt) <= now.getTime() && (cropKey === "sesame"
        ? b.type === "warehouse" : (b.type === "granary" || b.type === "warehouse") && b.storedBarley > 0));
      if (cropKey === "sesame" && !granary) return fail("Build a warehouse to store sesame.");
      const source = granary ? { type: "granary" as const, column: granary.column, row: granary.row }
        : { type: "farm" as const, column: INITIAL_FARM_CONFIG.buildingBounds.minimumColumn, row: INITIAL_FARM_CONFIG.buildingBounds.minimumRow };
      if (stored > 0) await removeFromMarketItemStorage(tx, storage, stored, now);
      const excess = farm.carriedItemQuantity - carried;
      harvestUpdate = { carriedItemKey: excess > 0 ? "barley" : null, carriedItemQuantity: excess, carriedItemExpiresAt: excess > 0 ? farm.carriedItemExpiresAt : null };
      planting = { cropKey, decayEligible: cropKey === "barley" && farm.level >= 10, id: crypto.randomUUID(), total: input.targets.length, remaining: [...orderPlantingFields(input.targets, stored > 0 ? source : input.targets[0]!)], source, stopRequested: false,
        carriedSeeds: { quantity: carried, expiresAt: farm.carriedItemExpiresAt?.toISOString() ?? null },
        phase: { type: stored > 0 ? "collecting" : "ready" } };
      const collectionTile = granary ? [granary.loadingTile, { column: granary.column, row: granary.row + 2 },
        { column: granary.column - 1, row: granary.row }, { column: granary.column + 2, row: granary.row },
        { column: granary.column, row: granary.row - 1 }].find(p => p && plantingTravelPath(snapshot, origin, p, now.getTime()))
        : INITIAL_FARM_CONFIG.farmerSpawn;
      if (!collectionTile) return fail("The seed storage cannot be reached.");
      const collectionPath = stored > 0 ? pathTo(origin, collectionTile) : undefined;
      const collectionTravelMs = stored > 0 ? plantingTravelMs(snapshot, origin, collectionTile, now.getTime()) : undefined;
      let position = stored > 0 ? collectionTile : origin;
      const travelPaths = planting.remaining.map(target => { const path = pathTo(position, target); position = target; return path; });
      position = stored > 0 ? collectionTile : origin;
      const travelMs = planting.remaining.map(target => {
        const duration = plantingTravelMs(snapshot, position, target, now.getTime());
        position = target;
        return duration;
      });
      planting = { ...planting, travelMs, travelPaths, collectionPath, collectionTravelMs, travelStartedAt: now.toISOString(), nextStepAt: new Date(now.getTime() + (stored > 0
        ? Math.max(1000, collectionTravelMs!)
        : travelMs[0] ?? 0)).toISOString() };
      }
    } else {
      if (!planting && farm.production.lastHarvestDelivery?.batchId === input.batchId) return readFarmSnapshot(tx, farm, false);
      if (!planting && previousBatch?.id === input.batchId) return readFarmSnapshot(tx, farm, false);
      if (!planting || planting.id !== input.batchId) return fail("This field job is no longer active.");
      // Delivery is timestamp-owned; an early/duplicate arrival cannot deposit it.
      if (planting.phase.type === "delivering") return readFarmSnapshot(tx, farm, false);
      // Saved-route jobs are advanced only by the lifecycle clock, never an early animation callback.
      if (planting.travelPaths && ((planting.phase.type === "collecting" && input.action === "collect") ||
        (planting.phase.type === "ready" && input.action === (planting.mode === "harvest" ? "harvest" : "plant"))))
        return readFarmSnapshot(tx, farm, false);
      if (input.action === "stop") planting = { ...planting, stopRequested: true };
      else if (input.action === "collect") {
        if (planting.mode === "harvest" || planting.phase.type !== "collecting") return fail("The seeds have already been collected.");
        planting = { ...planting, phase: { type: "ready" }, nextStepAt: planting.nextStepAt ? new Date(now.getTime() + (planting.travelMs?.[0] ?? 0)).toISOString() : undefined };
      } else if (input.action === "plant") {
        if (planting.mode === "harvest" || planting.phase.type !== "ready" || planting.stopRequested) return fail("Finish the current planting step first.");
        const target = planting.remaining[0];
        if (!target || !plantableFields(snapshot, now.getTime()).some(p => fieldKey(p) === fieldKey(target))) return fail("The next field is no longer plantable. Stop the batch to return its seeds.");
        const plantedAt = new Date(now.getTime() + CROP_DEFINITIONS[planting.cropKey ?? "barley"].sowingDurationMs);
        await tx.insert(farmCrops).values({ farmId: farm.id, cropKey: planting.cropKey ?? "barley", decayEligible: planting.decayEligible ?? false, ...target,
          sowingStartedAt: now, plantedAt, growthCompletesAt: new Date(plantedAt.getTime() + CROP_DEFINITIONS[planting.cropKey ?? "barley"].growthDurationMs) });
        planting = { ...planting, travelMs: planting.travelMs?.slice(1), nextStepAt: planting.nextStepAt ? plantedAt.toISOString() : undefined, carriedSeeds: planting.carriedSeeds ? { ...planting.carriedSeeds, quantity: Math.max(0, planting.carriedSeeds.quantity - 1) } : undefined, remaining: planting.remaining.slice(1), phase: { type: "sowing", target, completesAt: plantedAt.toISOString() } };
      } else if (input.action === "harvest") {
        if (planting.mode !== "harvest" || planting.phase.type !== "ready" || planting.stopRequested) return fail("Finish the current harvesting step first.");
        const target = planting.remaining[0];
        const crop = snapshot.crops.find(c => target && fieldKey(c) === fieldKey(target));
        if (!crop || !target || !harvestableFields(snapshot, now.getTime()).some(p => fieldKey(p) === fieldKey(target))) return fail("The next field is no longer ready to harvest.");
        const completesAt = new Date(now.getTime() + CROP_DEFINITIONS.barley.harvestDurationMs);
        await tx.update(farmCrops).set({ harvestStartedAt: now, harvestCompletesAt: completesAt }).where(eq(farmCrops.id, crop.id));
        planting = { ...planting, travelMs: planting.travelMs?.slice(1), nextStepAt: completesAt.toISOString(), remaining: planting.remaining.slice(1), phase: { type: "harvesting", target, completesAt: completesAt.toISOString() } };
      } else {
        if ((planting.phase.type !== "sowing" && planting.phase.type !== "harvesting") || Date.parse(planting.phase.completesAt) > now.getTime()) return fail("This field is still being planted or harvested.");
        if (planting.phase.type === "harvesting") {
          const target = planting.phase.target;
          const crop = snapshot.crops.find(c => fieldKey(c) === fieldKey(target));
          if (!crop || crop.harvestCompletesAt === null || Date.parse(crop.harvestCompletesAt) > now.getTime()) return fail("This field is still being harvested.");
          const yieldQuantity = barleyHarvestYield(crop, now.getTime());
          const quantity = farm.carriedItemQuantity + yieldQuantity;
          if ((farm.carriedItemKey && farm.carriedItemKey !== "barley") || quantity > lockedHarvestFieldLimit(planting) * CROP_DEFINITIONS.barley.harvestYield) return fail("The farmer cannot carry more barley.");
          await tx.delete(farmCrops).where(eq(farmCrops.id, crop.id));
          harvestUpdate = { carriedItemKey: "barley", carriedItemQuantity: quantity,
            carriedItemExpiresAt: farm.carriedItemExpiresAt ?? new Date(now.getTime() + EXPOSED_BARLEY_LIFETIME_MS),
            progressionStats: { ...farm.progressionStats, harvestedBarley: farm.progressionStats.harvestedBarley + yieldQuantity, harvests: farm.progressionStats.harvests + 1 } };
        }
        planting = { ...planting, lastHarvested: planting.phase.type === "harvesting" ? planting.phase.target : planting.lastHarvested, phase: { type: "ready" } };
      }
      if (planting.phase.type !== "sowing" && planting.phase.type !== "harvesting" && (planting.stopRequested || planting.remaining.length === 0)) {
        if (planting.mode !== "harvest" && planting.remaining.length) {
          const storage = await loadMarketItemStorage(tx, farm.id, planting.cropKey ?? "barley", now);
          const carried = planting.carriedSeeds?.quantity ?? 0;
          const stored = planting.remaining.length - carried;
          if (storage.availableCapacity < stored) return fail("Make storage space before returning unused seeds.");
          if (stored > 0) await addToMarketItemStorage(tx, storage, stored, now);
          if (carried > 0) harvestUpdate = { carriedItemKey: "barley", carriedItemQuantity: farm.carriedItemQuantity + carried,
            carriedItemExpiresAt: planting.carriedSeeds?.expiresAt ? new Date(planting.carriedSeeds.expiresAt) : farm.carriedItemExpiresAt };
        }
        planting = planting.mode === "harvest" && (harvestUpdate.carriedItemQuantity ?? farm.carriedItemQuantity) > 0
          ? await planHarvestDelivery(tx, farm, planting, now.getTime()) : null;
      }
    }
    const [updated] = await tx.update(farms).set({
      ...harvestUpdate,
      production: { ...farm.production, planting },
      ...(input.type === "advance_batch_planting" && input.action === "plant" && planting?.cropKey !== "sesame" ? {
        cultivationStartedAt: farm.cultivationStartedAt ?? now,
        nextBarleyConsumptionAt: farm.nextBarleyConsumptionAt ?? new Date(now.getTime() + BARLEY_CONSUMPTION_INTERVAL_MS)
      } : {}),
      version: sql`${farms.version} + 1`, updatedAt: now
    }).where(eq(farms.id, farm.id)).returning();
    return readFarmSnapshot(tx, updated!, false);
  }),
  catch: cause => cause instanceof BatchPlantingError || cause instanceof FarmerUnavailableError ? cause : new BatchPlantingPersistenceError({ cause })
});
