import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { Effect } from "effect";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createDatabase } from "../../src/server/db/client";
import { farms, players, farmInventory, farmImprovements, farmBuildings, farmCrops } from "../../src/server/db/schema";
import { advanceBatchPlanting } from "../../src/server/services/batchPlantingLifecycle";
import { CROP_DEFINITIONS } from "../../src/game-data/crops";
import { batchPlantingAction } from "../../src/server/services/batchPlanting";
import { togglePlantingField, orderPlantingFields, availablePlantingBarley, batchPlantingCarriedBarley } from "../../src/game-core/farm/batchPlanting";
import { assertFarmerAvailable } from "../../src/server/services/farmerAvailability";

const client = new Client({ connectionString: process.env.TEST_DATABASE_URL ?? "postgres://sumer:sumer_dev@localhost:5432/sumer_farming" });
const db = createDatabase(client);
const ids = new Set<string>();
beforeAll(() => client.connect());
afterEach(async () => { if (ids.size) await db.delete(players).where(inArray(players.id, [...ids])); ids.clear(); });
afterAll(() => client.end());
const targets = [{ column: 4, row: 8 }, { column: 6, row: 8 }];
const fixture = async (barley = 3) => {
  const playerId = randomUUID(); ids.add(playerId);
  await db.insert(players).values({ id: playerId, displayName: "Batch planting test" });
  const [farm] = await db.insert(farms).values({ playerId }).returning();
  await db.insert(farmInventory).values({ farmId: farm!.id, itemKey: "barley", quantity: barley });
  await db.insert(farmImprovements).values([8, 9].map(row => ({ farmId: farm!.id, type: "irrigation" as const, column: 5, row, startedAt: new Date(0), completesAt: new Date(1000) })));
  const start = (fields = targets, version = 1) => batchPlantingAction(db, { type: "start_batch_planting", playerId, targets: fields, expectedFarmVersion: version });
  const advance = async (action: "collect" | "plant" | "finish" | "stop") => {
    const [current] = await db.select().from(farms).where(eq(farms.id, farm!.id));
    return Effect.runPromise(batchPlantingAction(db, { type: "advance_batch_planting", playerId, action, batchId: current!.production.planting!.id, expectedFarmVersion: current!.version }));
  };
  const finishTimer = async () => {
    const [current] = await db.select().from(farms).where(eq(farms.id, farm!.id));
    const job = current!.production.planting!;
    if (job.phase.type !== "sowing") throw new Error("Expected sowing");
    await db.update(farms).set({ production: { ...current!.production, planting: { ...job, phase: { ...job.phase, completesAt: new Date(Date.now() - 1).toISOString() } } } }).where(eq(farms.id, farm!.id));
  };
  return { start, advance, finishTimer, farmId: farm!.id };
};

const catchUp = (farmId: string, now: number) => db.transaction(async tx => {
  const [farm] = await tx.select().from(farms).where(eq(farms.id, farmId)).for("update");
  return advanceBatchPlanting(tx, farm!, new Date(now));
});

describe("batch barley planting", () => {
  it("returns caught-up progress to a delayed animation callback without planting twice", async () => {
    const f = await fixture();
    const started = await Effect.runPromise(f.start());
    const batch = started.farm.production.planting!;
    await db.update(farms).set({ production: { ...started.farm.production, planting: {
      ...batch, nextStepAt: new Date(Date.now() - 60000).toISOString()
    } } }).where(eq(farms.id, f.farmId));
    const caughtUp = await f.advance("collect");
    expect(caughtUp.farm.production.planting).toBeNull();
    expect(caughtUp.crops).toHaveLength(2);
    expect(caughtUp.inventory[0]?.quantity).toBe(1);
    expect(caughtUp.crops.every(c => Date.parse(c.plantedAt) < Date.now() - 20000)).toBe(true);
  });
  it("finishes an unattended queue from collection, retaining each field's real growth timestamps", async () => {
    const f = await fixture();
    const start = await Effect.runPromise(f.start());
    const batch = start.farm.production.planting!;
    const firstStart = Date.parse(batch.nextStepAt!) + batch.travelMs![0]!;
    const firstEnd = firstStart + CROP_DEFINITIONS.barley.sowingDurationMs;
    const secondStart = firstEnd + batch.travelMs![1]!;
    const returnAt = secondStart + 60000;
    const completed = await catchUp(f.farmId, returnAt);
    expect(completed.production.planting).toBeNull();
    const crops = await db.select().from(farmCrops).where(eq(farmCrops.farmId, f.farmId));
    expect(crops).toHaveLength(2);
    for (const [index, target] of batch.remaining.entries()) {
      const crop = crops.find(c => c.column === target.column && c.row === target.row)!;
      expect(crop.sowingStartedAt.getTime()).toBe(index === 0 ? firstStart : secondStart);
      expect(crop.plantedAt.getTime()).toBe(crop.sowingStartedAt.getTime() + 10000);
      expect(crop.growthCompletesAt.getTime()).toBe(crop.plantedAt.getTime() + CROP_DEFINITIONS.barley.growthDurationMs);
    }
    expect((await catchUp(f.farmId, returnAt + 60000)).version).toBe(completed.version);
    expect(await db.select().from(farmCrops).where(eq(farmCrops.farmId, f.farmId))).toHaveLength(2);
  });
  it("resumes partway through the next field without restarting its ten-second timer", async () => {
    const f = await fixture();
    await Effect.runPromise(f.start()); await f.advance("collect");
    const first = await f.advance("plant");
    const batch = first.farm.production.planting!;
    if (batch.phase.type !== "sowing") throw new Error("Expected sowing");
    const nextStart = Date.parse(batch.phase.completesAt) + batch.travelMs![0]!;
    const resumed = await catchUp(f.farmId, nextStart + 5000);
    expect(resumed.production.planting?.remaining).toHaveLength(0);
    expect(resumed.production.planting?.phase).toMatchObject({ type: "sowing", completesAt: new Date(nextStart + 10000).toISOString() });
    expect((await catchUp(f.farmId, nextStart + 9999)).production.planting).not.toBeNull();
    expect((await catchUp(f.farmId, nextStart + 10000)).production.planting).toBeNull();
  });
  it("honors stop after this field even if the tab remains suspended", async () => {
    const f = await fixture();
    await Effect.runPromise(f.start()); await f.advance("collect"); await f.advance("plant");
    const stopped = await f.advance("stop");
    const phase = stopped.farm.production.planting!.phase;
    if (phase.type !== "sowing") throw new Error("Expected sowing");
    const completed = await catchUp(f.farmId, Date.parse(phase.completesAt) + 60000);
    expect(completed.production.planting).toBeNull();
    expect(await db.select().from(farmCrops).where(eq(farmCrops.farmId, f.farmId))).toHaveLength(1);
    const inventory = await db.select().from(farmInventory).where(eq(farmInventory.farmId, f.farmId));
    expect(inventory[0]?.quantity).toBe(2);
  });
  it("catches up saved queues created before server travel deadlines existed", async () => {
    const f = await fixture();
    await Effect.runPromise(f.start()); await f.advance("collect");
    const started = await f.advance("plant");
    const batch = started.farm.production.planting!;
    if (batch.phase.type !== "sowing") throw new Error("Expected sowing");
    await db.update(farms).set({ production: { ...started.farm.production, planting: { ...batch, nextStepAt: undefined, travelMs: undefined } } }).where(eq(farms.id, f.farmId));
    const completed = await catchUp(f.farmId, Date.parse(batch.phase.completesAt) + 60000);
    expect(completed.production.planting).toBeNull();
    expect(await db.select().from(farmCrops).where(eq(farmCrops.farmId, f.farmId))).toHaveLength(2);
  });
  it("replants carried barley without visiting storage and retains excess barley", async () => {
    const f = await fixture(0);
    const expiresAt = new Date(Date.now() + 86400000);
    await db.update(farms).set({ carriedItemKey: "barley", carriedItemQuantity: 8, carriedItemExpiresAt: expiresAt }).where(eq(farms.id, f.farmId));
    const started = await Effect.runPromise(f.start());
    expect(started.farm.production.planting?.phase.type).toBe("ready");
    expect(started.farm.carriedItem?.quantity).toBe(6);
    expect(batchPlantingCarriedBarley(started, Date.now())).toBe(8);
    await expect(Effect.runPromise(f.start())).rejects.toThrow(/changed/);
    await f.advance("plant"); await f.finishTimer(); await f.advance("finish");
    await f.advance("plant"); await f.finishTimer();
    const done = await f.advance("finish");
    expect(done.farm.carriedItem?.quantity).toBe(6);
    expect(done.farm.carriedItem?.expiresAt).toBe(expiresAt.toISOString());
    expect(done.farm.production.planting).toBeNull();
  });
  it("collects only the shortfall, uses carried seeds first, and refunds stored seeds", async () => {
    const f = await fixture(3);
    await db.update(farms).set({ carriedItemKey: "barley", carriedItemQuantity: 1, carriedItemExpiresAt: new Date(Date.now() + 86400000) }).where(eq(farms.id, f.farmId));
    const started = await Effect.runPromise(f.start());
    expect(started.inventory[0]?.quantity).toBe(2);
    expect(started.farm.production.planting?.carriedSeeds?.quantity).toBe(1);
    expect(batchPlantingCarriedBarley(started, Date.now())).toBe(1);
    const collected = await f.advance("collect");
    expect(batchPlantingCarriedBarley(collected, Date.now())).toBe(2);
    await f.advance("plant"); await f.advance("stop"); await f.finishTimer();
    const done = await f.advance("finish");
    expect(done.inventory[0]?.quantity).toBe(3);
    expect(done.farm.carriedItem).toBeNull();
  });
  it("returns unused carried seeds to hands even when storage is full", async () => {
    const f = await fixture(3);
    const expiresAt = new Date(Date.now() + 86400000);
    await db.update(farms).set({ carriedItemKey: "barley", carriedItemQuantity: 8, carriedItemExpiresAt: expiresAt }).where(eq(farms.id, f.farmId));
    await Effect.runPromise(f.start());
    const stopped = await f.advance("stop");
    expect(stopped.farm.carriedItem?.quantity).toBe(8);
    expect(stopped.farm.carriedItem?.expiresAt).toBe(expiresAt.toISOString());
    expect(availablePlantingBarley(stopped, Date.now())).toBe(11);
    expect(availablePlantingBarley(stopped, expiresAt.getTime())).toBe(3);
  });
  it("rejects non-barley carried items and expired seeds", async () => {
    const f = await fixture(0);
    await db.update(farms).set({ carriedItemKey: "clay", carriedItemQuantity: 1 }).where(eq(farms.id, f.farmId));
    await expect(Effect.runPromise(f.start())).rejects.toThrow(/empty your hands/);
    await db.update(farms).set({ carriedItemKey: "barley", carriedItemQuantity: 8, carriedItemExpiresAt: new Date(0) }).where(eq(farms.id, f.farmId));
    await expect(Effect.runPromise(f.start())).rejects.toThrow(/Not enough/);
  });
  it("caps selection at seed supply and supports deselection and separated fields", () => {
    expect(togglePlantingField([targets[0]!], targets[1]!, targets, 1)).toEqual([targets[0]]);
    expect(togglePlantingField([targets[0]!], targets[0]!, targets, 1)).toEqual([]);
    expect(orderPlantingFields(targets, targets[1]!)).toEqual([...targets].reverse());
  });
  it("reserves seeds once, persists collection, rejects stale retries, and refunds on stop", async () => {
    const f = await fixture();
    const started = await Effect.runPromise(f.start());
    expect(started.inventory.find(i => i.itemKey === "barley")?.quantity).toBe(1);
    expect(started.farm.production.planting?.phase.type).toBe("collecting");
    expect(() => assertFarmerAvailable({ ...started.farm, carriedItemKey: null })).toThrow(/planting/);
    await expect(Effect.runPromise(Effect.flip(f.start()))).resolves.toMatchObject({ _tag: "BatchPlantingError", message: expect.stringMatching(/changed/) });
    expect((await f.advance("collect")).farm.production.planting?.phase.type).toBe("ready");
    const stopped = await f.advance("stop");
    expect(stopped.farm.production.planting).toBeNull();
    expect(stopped.inventory.find(i => i.itemKey === "barley")?.quantity).toBe(3);
  });
  it("plants sequentially with a ten-second sow and independent growth; stop finishes current field", async () => {
    const f = await fixture();
    await Effect.runPromise(f.start()); await f.advance("collect");
    const first = await f.advance("plant");
    expect(first.crops).toHaveLength(1);
    expect(Date.parse(first.crops[0]!.plantedAt) - Date.parse(first.crops[0]!.sowingStartedAt)).toBe(10000);
    await expect(f.advance("finish")).rejects.toThrow(/still being planted/);
    const stopped = await f.advance("stop");
    expect(stopped.farm.production.planting?.stopRequested).toBe(true);
    await f.finishTimer();
    const done = await f.advance("finish");
    expect(done.farm.production.planting).toBeNull();
    expect(done.inventory.find(i => i.itemKey === "barley")?.quantity).toBe(2);
    expect(done.crops).toHaveLength(1);
  });
  it("rejects duplicates, unirrigated fields and insufficient seeds without reserving any", async () => {
    const f = await fixture(1);
    for (const fields of [targets, [targets[0]!, targets[0]!], [{ column: 0, row: 0 }]]) {
      await expect(Effect.runPromise(Effect.flip(f.start(fields)))).resolves.toMatchObject({ _tag: "BatchPlantingError" });
    }
    const valid = await Effect.runPromise(f.start([targets[0]!]));
    expect(valid.inventory.find(i => i.itemKey === "barley")?.quantity ?? 0).toBe(0);
  });
  it("prefers a stocked granary and completes every selected field exactly once", async () => {
    const f = await fixture(1);
    await db.insert(farmBuildings).values({ farmId: f.farmId, type: "granary", column: 5, row: 3, storedBarley: 1, startedAt: new Date(0), completesAt: new Date(1000) });
    const start = await Effect.runPromise(f.start());
    expect(start.farm.production.planting?.source.type).toBe("granary");
    await f.advance("collect");
    await expect(f.advance("collect")).rejects.toThrow(/already been collected/);
    await f.advance("plant"); await f.finishTimer(); await f.advance("finish");
    await f.advance("plant"); await f.finishTimer();
    const complete = await f.advance("finish");
    expect(complete.farm.production.planting).toBeNull();
    expect(complete.crops).toHaveLength(2);
    expect(complete.inventory.find(i => i.itemKey === "barley")?.quantity ?? 0).toBe(0);
    expect(complete.buildings[0]!.storedBarley).toBe(0);
  });
});
