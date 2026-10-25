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
import { tendedPalmDeadline } from "../../game-data/datePalmCycle";

export class PerennialCropRuleError extends Data.TaggedError("PerennialCropRuleError")<{ readonly message: string }> {}
export class PerennialCropPersistenceError extends Data.TaggedError("PerennialCropPersistenceError")<{ readonly cause: unknown }> {}

export const tendPerennialCrop = (db: Database, input: Extract<GameCommand, { type: "tend_perennial_crop" }> & { playerId: string }) => Effect.gen(function* () {
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
    const reason = perennialActionReason(snapshot, input.crop, input.target, input.action, now.getTime());
    if (reason) return new PerennialCropRuleError({ message: reason });
    const plan = planCropWork(snapshot, input.target, input.crop, input.action, now.getTime(), input.farmerPosition);
    if (!plan) return new PerennialCropRuleError({ message: "No accessible route to the palm or storage." });
    const definition = CROP_DEFINITIONS[input.crop];
    const id = crypto.randomUUID();
    let cropId: string;
    let quantity = 0;
    let palmCycles = farm.production.palmCycles;
    if (input.action === "plant") {
      const [player] = await tx.select().from(players).where(eq(players.id, input.playerId)).for("update");
      if (!player || player.shekelBalance < definition.saplingCost) return new PerennialCropRuleError({ message: "Not enough shekels." });
      const balanceAfter = player.shekelBalance - definition.saplingCost;
      await tx.update(players).set({ shekelBalance: balanceAfter }).where(eq(players.id, player.id));
      await tx.insert(shekelTransactions).values({ playerId: player.id, idempotencyKey: id, type: "crop_planting", delta: -definition.saplingCost, balanceAfter });
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
