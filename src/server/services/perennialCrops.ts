import type { CropWork } from "../../game-data/cropWork";
import { harvestFieldLimit } from "../../game-core/farm/harvestCapacity";
import { fieldKey, orderPlantingFields } from "../../game-core/farm/batchPlanting";
import { loadMarketItemStorage } from "./marketItemStorage";
import { and, eq, sql } from "drizzle-orm";
import { Clock, Data, Effect } from "effect";
import type { GameCommand } from "../../schemas/gameCommands";
import { CROP_DEFINITIONS } from "../../game-data/crops";
import { perennialActionReason, planCropWork } from "../../game-core/farm/perennialCrops";
import { assertFarmerAvailable, FarmerUnavailableError } from "./farmerAvailability";
import { advanceFarmLifecycle } from "./farmLifecycle";
import { readFarmSnapshot } from "./farmSnapshot";
import { farmCrops, farms, players, shekelTransactions } from "../db/schema";
import type { Database } from "../db/client";
import { sesameActionReason } from "../../game-core/farm/sesame";
import { setStoredQuantity } from "./physicalStorage";
import { tendedPalmDeadline } from "../../game-data/datePalmCycle";

export class PerennialCropRuleError extends Data.TaggedError("PerennialCropRuleError")<{ readonly message: string }> {}
export class PerennialCropPersistenceError extends Data.TaggedError("PerennialCropPersistenceError")<{ readonly cause: unknown }> {}

export const tendPerennialCrop = (db: Database, input: Extract<GameCommand, { type: "tend_perennial_crop" | "work_sesame" }> & { playerId: string }) => Effect.gen(function* () {
  const now = new Date(yield* Clock.currentTimeMillis);
  const result = yield* Effect.tryPromise({ try: () => db.transaction(async tx => {
    const [record] = await tx.select().from(farms).where(eq(farms.playerId, input.playerId)).for("update");
    if (!record) return new PerennialCropRuleError({ message: "Farm not found." });
    const farm = await advanceFarmLifecycle(tx, record, now);
    if (farm.version !== input.expectedFarmVersion) return new PerennialCropRuleError({ message: "The farm changed. Please try again." });
    assertFarmerAvailable(farm);
    const snapshot = await readFarmSnapshot(tx, farm, false);
    if (farm.gatheringItemKey || snapshot.crops.some(c => c.harvestStartedAt || Date.parse(c.plantedAt) > now.getTime()) ||
        snapshot.buildings.some(b => Date.parse(b.completesAt) > now.getTime()) ||
        snapshot.improvements.some(i => Date.parse(i.completesAt) > now.getTime() || i.destroyStartedAt)) return new PerennialCropRuleError({ message: "The farmer is busy." });
    const reason = input.type === "work_sesame"
      ? sesameActionReason(snapshot, input.target, input.action, now.getTime())
      : perennialActionReason(snapshot, input.crop, input.target, input.action, now.getTime());
    if (reason) return new PerennialCropRuleError({ message: reason });
    const plan = planCropWork(snapshot, input.target, input.crop, input.action, now.getTime(), input.farmerPosition);
    if (!plan) return new PerennialCropRuleError({ message: "No accessible route to the crop or storage." });
    const definition = CROP_DEFINITIONS[input.crop];
    const id = crypto.randomUUID();
    let cropId: string;
    let quantity = 0;
    let palmCycles = farm.production.palmCycles;
    if (input.action === "plant") {
      if (input.crop === "sesame") {
        const stored = snapshot.inventory.find(item => item.itemKey === "sesame")?.quantity ?? 0;
        await setStoredQuantity(tx, farm.id, "sesame", stored - 1, now);
      } else {
        const definition = CROP_DEFINITIONS.datePalm;
        const [player] = await tx.select().from(players).where(eq(players.id, input.playerId)).for("update");
        if (!player || player.shekelBalance < definition.saplingCost) return new PerennialCropRuleError({ message: "Not enough shekels." });
        const balanceAfter = player.shekelBalance - definition.saplingCost;
        await tx.update(players).set({ shekelBalance: balanceAfter }).where(eq(players.id, player.id));
        await tx.insert(shekelTransactions).values({ playerId: player.id, idempotencyKey: id, type: "crop_planting", delta: -definition.saplingCost, balanceAfter });
      }
      const [crop] = await tx.insert(farmCrops).values({ farmId: farm.id, cropKey: input.crop, ...input.target,
        sowingStartedAt: new Date(plan.workStartsAt), plantedAt: new Date(plan.workEndsAt), growthCompletesAt: new Date(plan.workEndsAt + definition.growthDurationMs) }).returning();
      cropId = crop!.id;
    } else if (input.action === "tend") {
      const crop = snapshot.crops.find(c => c.column === input.target.column && c.row === input.target.row)!;
      cropId = crop.id;
      palmCycles = { ...palmCycles, [cropId]: { ...palmCycles![cropId]!, tendedAt: now.getTime() } };
      await tx.update(farmCrops).set({ growthCompletesAt: new Date(tendedPalmDeadline(Date.parse(crop.growthCompletesAt), now.getTime())) })
        .where(and(eq(farmCrops.id, cropId), eq(farmCrops.farmId, farm.id)));
    } else {
      const crop = snapshot.crops.find(c => c.column === input.target.column && c.row === input.target.row)!;
      cropId = crop.id;
      quantity = definition.harvestYield;
      await tx.update(farmCrops).set({ harvestStartedAt: new Date(plan.workStartsAt), harvestCompletesAt: new Date(plan.workEndsAt) })
        .where(and(eq(farmCrops.id, cropId), eq(farmCrops.farmId, farm.id)));
    }
    const [updated] = await tx.update(farms).set({ production: { ...farm.production,
      palmCycles,
      ...(input.action === "harvest" ? { cropYields: { ...farm.production.cropYields, [cropId]: definition.harvestYield } } : {}),
      cropWork: { ...plan, id, cropId, cropKey: input.crop, action: input.action, quantity, settled: false } },
      version: sql`${farms.version} + 1`, updatedAt: now }).where(eq(farms.id, farm.id)).returning();
    return readFarmSnapshot(tx, updated!, false);
  }), catch: cause => cause instanceof PerennialCropRuleError || cause instanceof FarmerUnavailableError ? cause : new PerennialCropPersistenceError({ cause }) });
  return result instanceof PerennialCropRuleError ? yield* Effect.fail(result) : result;
});

/** Reserve the entire selection and schedule every journey under the farm lock. */
export const startSesameHarvest = (db: Database, input: Extract<GameCommand, { type: "start_batch_harvesting" }> & { playerId: string }) => Effect.tryPromise({
  try: () => db.transaction(async tx => {
    const fail = (message: string): never => { throw new PerennialCropRuleError({ message }); };
    const now = new Date();
    const [record] = await tx.select().from(farms).where(eq(farms.playerId, input.playerId)).for("update");
    if (!record) return fail("Farm not found.");
    const farm = await advanceFarmLifecycle(tx, record, now);
    if (farm.version !== input.expectedFarmVersion) return fail("The farm changed. Please try again.");
    assertFarmerAvailable(farm);
    const snapshot = await readFarmSnapshot(tx, farm, false);
    const limit = harvestFieldLimit(farm.happiness);
    if (input.targets.length < 1 || input.targets.length > limit) return fail(`Select up to ${limit} fields.`);
    if (new Set(input.targets.map(fieldKey)).size !== input.targets.length) return fail("Select distinct ripe sesame fields.");
    if (farm.gatheringItemKey || snapshot.crops.some(c => c.harvestStartedAt || Date.parse(c.plantedAt) > now.getTime()) ||
      snapshot.buildings.some(b => Date.parse(b.completesAt) > now.getTime()) ||
      snapshot.improvements.some(i => Date.parse(i.completesAt) > now.getTime() || i.destroyStartedAt)) return fail("The farmer is busy.");
    for (const target of input.targets) {
      const reason = sesameActionReason(snapshot, target, "harvest", now.getTime());
      if (reason) return fail(reason);
    }
    const storage = await loadMarketItemStorage(tx, farm.id, "sesame", now);
    const quantity = CROP_DEFINITIONS.sesame.harvestYield;
    if (storage.availableCapacity < input.targets.length * quantity) return fail("Not enough warehouse space for these fields.");
    const batchId = crypto.randomUUID();
    const jobs: CropWork[] = [];
    let at = now.getTime(), position = input.farmerPosition;
    for (const target of orderPlantingFields(input.targets, input.targets[0]!)) {
      const plan = planCropWork(snapshot, target, "sesame", "harvest", at, position);
      if (!plan) return fail("No accessible route to the field or warehouse.");
      const crop = snapshot.crops.find(c => fieldKey(c) === fieldKey(target))!;
      jobs.push({ ...plan, id: crypto.randomUUID(), cropId: crop.id, cropKey: "sesame", action: "harvest", quantity, settled: false,
        batch: { id: batchId, index: jobs.length, total: input.targets.length } });
      at = plan.completesAt;
      position = plan.inbound.at(-1);
    }
    for (const job of jobs) await tx.update(farmCrops).set({ harvestStartedAt: new Date(job.workStartsAt), harvestCompletesAt: new Date(job.workEndsAt) })
      .where(and(eq(farmCrops.id, job.cropId), eq(farmCrops.farmId, farm.id)));
    const [updated] = await tx.update(farms).set({ production: { ...farm.production, cropWork: jobs[0], cropWorkQueue: jobs.slice(1) },
      version: sql`${farms.version} + 1`, updatedAt: now }).where(eq(farms.id, farm.id)).returning();
    return readFarmSnapshot(tx, updated!, false);
  }),
  catch: cause => cause instanceof PerennialCropRuleError || cause instanceof FarmerUnavailableError ? cause : new PerennialCropPersistenceError({ cause })
});
