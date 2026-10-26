import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { Effect } from "effect";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createDatabase } from "../../src/server/db/client";
import { farms, players, farmCrops, farmBuildings, farmInventory } from "../../src/server/db/schema";
import { batchPlantingAction } from "../../src/server/services/batchPlanting";
import { depositCarriedItem } from "../../src/server/services/farmItemActions";
import { GameCommandSchema } from "../../src/schemas/gameCommands";
import { advanceBatchPlanting } from "../../src/server/services/batchPlantingLifecycle";
import { EXPOSED_BARLEY_LIFETIME_MS } from "../../src/game-data/household";

const client = new Client({ connectionString: process.env.TEST_DATABASE_URL ?? "postgres://sumer:sumer_dev@localhost:5432/sumer_farming" });
const db = createDatabase(client);
const ids = new Set<string>();
beforeAll(() => client.connect());
afterEach(async () => { if (ids.size) await db.delete(players).where(inArray(players.id, [...ids])); ids.clear(); });
afterAll(() => client.end());
const targets = [0, 1, 2, 3, 4].map(column => ({ column, row: 8 }));
const fixture = async () => {
  const playerId = randomUUID(); ids.add(playerId);
  await db.insert(players).values({ id: playerId, displayName: "Batch harvest test" });
  const [farm] = await db.insert(farms).values({ playerId, level: 4, happiness: 50, happinessCheckedAt: new Date() }).returning();
  await db.insert(farmCrops).values(targets.map(p => ({ ...p, farmId: farm!.id, cropKey: "barley" as const, sowingStartedAt: new Date(0), plantedAt: new Date(10000), growthCompletesAt: new Date(1810000) })));
  const read = async () => (await db.select().from(farms).where(eq(farms.id, farm!.id)))[0]!;
  const start = (fields = targets.slice(0, 4), version = 1) => batchPlantingAction(db, { type: "start_batch_harvesting", playerId, targets: fields, expectedFarmVersion: version });
  const command = async (action: "harvest" | "finish" | "stop" | "collect" | "plant") => {
    const current = await read();
    const batch = current.production.planting!;
    if (action === "harvest" && batch.phase.type === "ready" && Date.parse(batch.nextStepAt!) > Date.now())
      await db.update(farms).set({ production: { ...current.production, planting: { ...batch, nextStepAt: new Date(Date.now() - 1).toISOString() } } }).where(eq(farms.id, farm!.id));
    return { type: "advance_batch_planting" as const, playerId, action, batchId: current.production.planting!.id, expectedFarmVersion: current.version };
  };
  const advance = async (action: Parameters<typeof command>[0]) => Effect.runPromise(batchPlantingAction(db, await command(action)));
  const finishTimer = async () => {
    const current = await read(); const job = current.production.planting!;
    if (job.phase.type !== "harvesting") throw new Error("Expected harvesting");
    const target = job.phase.target;
    const end = new Date(Date.now() - 1), begin = new Date(end.getTime() - 10000);
    await db.update(farmCrops).set({ harvestStartedAt: begin, harvestCompletesAt: end }).where(eq(farmCrops.farmId, farm!.id));
    await db.update(farms).set({ production: { ...current.production, planting: { ...job, phase: { ...job.phase, completesAt: end.toISOString() } } } }).where(eq(farms.id, farm!.id));
    // Only the current crop is harvesting; leave all other fields untouched.
    const crops = await db.select().from(farmCrops).where(eq(farmCrops.farmId, farm!.id));
    for (const crop of crops.filter(c => c.column !== target.column || c.row !== target.row))
      await db.update(farmCrops).set({ harvestStartedAt: null, harvestCompletesAt: null }).where(eq(farmCrops.id, crop.id));
  };
  return { playerId, farmId: farm!.id, read, start, advance, command, finishTimer };
};
const catchUp = (farmId: string, now: number) => db.transaction(async tx => {
  const [farm] = await tx.select().from(farms).where(eq(farms.id, farmId)).for("update");
  return advanceBatchPlanting(tx, farm!, new Date(now));
});

describe("four-field batch harvesting", () => {
  it("settles harvest, granary and farm legs in one offline catch-up", async () => {
    const f = await fixture();
    const [granary] = await db.insert(farmBuildings).values({ farmId: f.farmId, type: "granary", column: 5, row: 3,
      loadingTile: { column: 5, row: 5 }, storedBarley: 14, startedAt: new Date(0), completesAt: new Date(1) }).returning();
    await Effect.runPromise(f.start());
    const done = await catchUp(f.farmId, Date.now() + 3600000);
    expect(done.production.planting).toBeNull();
    expect(done.carriedItemQuantity).toBe(2); // eight harvested, one in granary, five at home
    expect((await db.select().from(farmBuildings).where(eq(farmBuildings.id, granary!.id)))[0]?.storedBarley).toBe(15);
    expect((await db.select().from(farmInventory).where(eq(farmInventory.farmId, f.farmId)))[0]?.quantity).toBe(5);
    expect(done.production.lastHarvestDelivery?.target).toEqual({ column: 1, row: 5 });
  });
  it("rechecks farm capacity at arrival instead of overfilling it", async () => {
    const f = await fixture();
    await db.insert(farmBuildings).values({ farmId: f.farmId, type: "granary", column: 5, row: 3,
      loadingTile: { column: 5, row: 5 }, storedBarley: 15, startedAt: new Date(0), completesAt: new Date(1) });
    const started = await Effect.runPromise(f.start([targets[0]!]));
    const travelling = await catchUp(f.farmId, Date.parse(started.farm.production.planting!.nextStepAt!) + 10000);
    const phase = travelling.production.planting!.phase;
    if (phase.type !== "delivering") throw new Error("Expected delivery");
    const atGranary = await catchUp(f.farmId, Date.parse(phase.completesAt));
    const fallback = atGranary.production.planting!.phase;
    if (fallback.type !== "delivering") throw new Error("Expected farm fallback");
    await db.insert(farmInventory).values({ farmId: f.farmId, itemKey: "barley", quantity: 5 });
    const done = await catchUp(f.farmId, Date.parse(fallback.completesAt));
    expect(done.production.planting).toBeNull();
    expect(done.carriedItemQuantity).toBe(2);
    expect((await db.select().from(farmInventory).where(eq(farmInventory.farmId, f.farmId)))[0]?.quantity).toBe(5);
  });
  it.each([0, 4, 5])("delivers surplus to farm stock %i and catches up offline without duplicates", async (initial) => {
    const f = await fixture();
    await db.insert(farmInventory).values({ farmId: f.farmId, itemKey: "barley", quantity: initial });
    await db.insert(farmBuildings).values({ farmId: f.farmId, type: "granary", column: 5, row: 3,
      loadingTile: { column: 5, row: 5 }, storedBarley: 15, startedAt: new Date(0), completesAt: new Date(1) });
    const started = await Effect.runPromise(f.start([targets[0]!]));
    const travelling = await catchUp(f.farmId, Date.parse(started.farm.production.planting!.nextStepAt!) + 10000);
    const phase = travelling.production.planting!.phase;
    if (phase.type !== "delivering") throw new Error("Expected granary delivery");
    const atGranary = await catchUp(f.farmId, Date.parse(phase.completesAt));
    if (initial < 5) {
      expect(atGranary.production.planting?.phase).toMatchObject({ type: "delivering", granaryId: null });
      expect(atGranary.carriedItemQuantity).toBe(2);
      expect((await db.select().from(farmInventory).where(eq(farmInventory.farmId, f.farmId)))[0]?.quantity).toBe(initial);
    }
    const done = await catchUp(f.farmId, Date.parse(phase.completesAt) + 60000);
    const stored = Math.min(2, 5 - initial);
    expect(done.production.planting).toBeNull();
    expect(done.carriedItemQuantity).toBe(2 - stored);
    expect((await db.select().from(farmInventory).where(eq(farmInventory.farmId, f.farmId)))[0]?.quantity).toBe(initial + stored);
    if (initial < 5) expect(done.production.lastHarvestDelivery?.target).toEqual({ column: 1, row: 5 });
    const again = await catchUp(f.farmId, Date.parse(phase.completesAt) + 120000);
    expect(again.version).toBe(done.version);
    expect(again.carriedItemQuantity).toBe(done.carriedItemQuantity);
  });
  it.each([[0, 8, 0], [18, 20, 6], [20, 20, 8]])("automatically fills a granary with %i barley then delivers overflow to the warehouse", async (initial, stored, remaining) => {
    const f = await fixture();
    await db.insert(farmInventory).values({ farmId: f.farmId, itemKey: "barley", quantity: 5 });
    await db.update(farms).set({ level: 7 }).where(eq(farms.id, f.farmId));
    const [granary] = await db.insert(farmBuildings).values({ farmId: f.farmId, type: "granary", column: 5, row: 3,
      loadingTile: { column: 5, row: 5 }, storedBarley: initial, startedAt: new Date(0), completesAt: new Date(1) }).returning();
    const [warehouse] = await db.insert(farmBuildings).values({ farmId: f.farmId, type: "warehouse", column: 3, row: 3,
      loadingTile: { column: 3, row: 5 }, startedAt: new Date(0), completesAt: new Date(1) }).returning();
    const started = await Effect.runPromise(f.start());
    const batch = started.farm.production.planting!;
    const harvestEnd = Date.parse(batch.nextStepAt!) + 40_000 + batch.travelMs!.slice(1).reduce((sum, ms) => sum + ms, 0);
    const travelling = await catchUp(f.farmId, harvestEnd);
    const phase = travelling.production.planting!.phase;
    if (phase.type !== "delivering") throw new Error("Expected saved granary delivery");
    expect(phase.path[0]).toEqual({ column: 3, row: 8 });
    expect(phase.path.at(-1)).toEqual(granary!.loadingTile);
    expect(travelling.carriedItemQuantity).toBe(8);
    // An animation callback arriving early must not complete a timed delivery.
    const early = await f.advance("finish");
    expect(early.farm.carriedItem?.quantity).toBe(8);
    expect(early.farm.production.planting?.phase.type).toBe("delivering");
    const before = await catchUp(f.farmId, Date.parse(phase.completesAt) - 1);
    expect(before.carriedItemQuantity).toBe(8);
    expect((await db.select().from(farmBuildings).where(eq(farmBuildings.id, granary!.id)))[0]!.storedBarley).toBe(initial);
    const arrived = await catchUp(f.farmId, Date.parse(phase.completesAt));
    if (remaining) expect(arrived.production.planting?.phase).toMatchObject({ type: "delivering", granaryId: warehouse!.id });
    else expect(arrived.production.planting).toBeNull();
    expect(arrived.carriedItemQuantity).toBe(remaining);
    expect(arrived.carriedItemKey).toBe(remaining ? "barley" : null);
    expect(arrived.production.lastHarvestDelivery).toMatchObject({ target: granary!.loadingTile, stored: stored - initial, remaining });
    expect((await db.select().from(farmBuildings).where(eq(farmBuildings.id, granary!.id)))[0]!.storedBarley).toBe(stored);
    const again = await catchUp(f.farmId, Date.parse(phase.completesAt) + 60_000);
    expect(again.carriedItemQuantity).toBe(0);
    expect(again.production.planting).toBeNull();
    expect((await db.select().from(farmBuildings).where(eq(farmBuildings.id, warehouse!.id)))[0]!.storedBarley).toBe(remaining);
    expect((await catchUp(f.farmId, Date.parse(phase.completesAt) + 120_000)).version).toBe(again.version);
  });
  it("catches up harvesting and delivery together without an arrival callback", async () => {
    const f = await fixture();
    const [granary] = await db.insert(farmBuildings).values({ farmId: f.farmId, type: "granary", column: 5, row: 3,
      loadingTile: { column: 5, row: 5 }, startedAt: new Date(0), completesAt: new Date(1) }).returning();
    await Effect.runPromise(f.start());
    const done = await catchUp(f.farmId, Date.now() + 3600_000);
    expect(done.production.planting).toBeNull();
    expect(done.carriedItemQuantity).toBe(0);
    expect(done.progressionStats.harvestedBarley).toBe(8);
    expect((await db.select().from(farmBuildings).where(eq(farmBuildings.id, granary!.id)))[0]!.storedBarley).toBe(8);
  });
  it("checks room on arrival if granary stock changes during the walk", async () => {
    const f = await fixture();
    await db.insert(farmInventory).values({ farmId: f.farmId, itemKey: "barley", quantity: 5 });
    const [granary] = await db.insert(farmBuildings).values({ farmId: f.farmId, type: "granary", column: 5, row: 3,
      loadingTile: { column: 5, row: 5 }, startedAt: new Date(0), completesAt: new Date(1) }).returning();
    const started = await Effect.runPromise(f.start([targets[0]!]));
    const travelling = await catchUp(f.farmId, Date.parse(started.farm.production.planting!.nextStepAt!) + 10_000);
    const phase = travelling.production.planting!.phase;
    if (phase.type !== "delivering") throw new Error("Expected delivery");
    await db.update(farmBuildings).set({ storedBarley: 14 }).where(eq(farmBuildings.id, granary!.id));
    const done = await catchUp(f.farmId, Date.parse(phase.completesAt));
    expect(done.carriedItemQuantity).toBe(1);
    expect(done.carriedItemExpiresAt).toEqual(travelling.carriedItemExpiresAt);
    expect((await db.select().from(farmBuildings).where(eq(farmBuildings.id, granary!.id)))[0]!.storedBarley).toBe(15);
  });
  it.each([[50, 4], [51, 6], [90, 6], [91, 8], [100, 8]])("locks %i happiness to %i fields and completes after happiness drops", async (happiness, limit) => {
    const f = await fixture();
    const fields = Array.from({ length: 9 }, (_, i) => ({ column: i % 8, row: 8 + Math.floor(i / 8) }));
    await db.delete(farmCrops).where(eq(farmCrops.farmId, f.farmId));
    await db.insert(farmCrops).values(fields.map(p => ({ ...p, farmId: f.farmId, cropKey: "barley" as const,
      sowingStartedAt: new Date(0), plantedAt: new Date(10000), growthCompletesAt: new Date(1810000) })));
    await db.update(farms).set({ happiness, happinessCheckedAt: new Date() }).where(eq(farms.id, f.farmId));
    await expect(Effect.runPromise(Effect.flip(f.start(fields.slice(0, limit + 1))))).resolves.toMatchObject({ _tag: "BatchPlantingError" });
    const started = await Effect.runPromise(f.start(fields.slice(0, limit)));
    expect(started.farm.production.planting?.harvestFieldLimit).toBe(limit);
    await db.update(farms).set({ happiness: 0 }).where(eq(farms.id, f.farmId));
    const done = await catchUp(f.farmId, Date.now() + 300000);
    expect(done.production.planting).toBeNull();
    expect(done.carriedItemQuantity).toBe(limit * 2);
    expect(done.progressionStats.harvests).toBe(limit);
    expect((await catchUp(f.farmId, Date.now() + 400000)).carriedItemQuantity).toBe(limit * 2);
  });
  it("finishes all four fields after leaving during the first harvest, exactly once", async () => {
    const f = await fixture(); await Effect.runPromise(f.start());
    const started = await f.advance("harvest");
    const job = started.farm.production.planting!;
    if (job.phase.type !== "harvesting") throw new Error("Expected harvesting");
    const firstEnd = Date.parse(job.phase.completesAt);
    const returned = await catchUp(f.farmId, firstEnd + 120000);
    expect(returned.production.planting).toBeNull();
    expect(returned.carriedItemKey).toBe("barley");
    expect(returned.carriedItemQuantity).toBe(8);
    expect(returned.carriedItemExpiresAt?.getTime()).toBe(firstEnd + EXPOSED_BARLEY_LIFETIME_MS);
    expect(returned.progressionStats.harvests).toBe(4);
    expect(returned.progressionStats.harvestedBarley).toBe(8);
    expect(await db.select().from(farmCrops).where(eq(farmCrops.farmId, f.farmId))).toHaveLength(1);
    const again = await catchUp(f.farmId, firstEnd + 180000);
    expect(again.version).toBe(returned.version);
    expect(again.carriedItemQuantity).toBe(8);
    expect(again.progressionStats.harvests).toBe(4);
  });
  it("advances while travelling and resumes a partially finished second field", async () => {
    const f = await fixture();
    const started = await Effect.runPromise(f.start());
    const job = started.farm.production.planting!;
    const firstStart = Date.parse(job.nextStepAt!);
    expect((await catchUp(f.farmId, firstStart - 1)).carriedItemQuantity).toBe(0);
    const secondStart = firstStart + 10000 + job.travelMs![1]!;
    const resumed = await catchUp(f.farmId, secondStart + 5000);
    expect(resumed.carriedItemQuantity).toBe(2);
    expect(resumed.production.planting?.phase).toMatchObject({ type: "harvesting", completesAt: new Date(secondStart + 10000).toISOString() });
    expect(resumed.production.planting?.remaining).toHaveLength(2);
    expect((await catchUp(f.farmId, secondStart + 10000)).carriedItemQuantity).toBe(4);
  });
  it("honors stop after the current field when the tab stays away", async () => {
    const f = await fixture(); await Effect.runPromise(f.start()); await f.advance("harvest");
    const stopped = await f.advance("stop");
    const phase = stopped.farm.production.planting!.phase;
    if (phase.type !== "harvesting") throw new Error("Expected harvesting");
    const returned = await catchUp(f.farmId, Date.parse(phase.completesAt) + 120000);
    expect(returned.production.planting).toBeNull();
    expect(returned.carriedItemQuantity).toBe(2);
    expect(returned.progressionStats.harvests).toBe(1);
    expect(await db.select().from(farmCrops).where(eq(farmCrops.farmId, f.farmId))).toHaveLength(4);
  });
  it("catches up legacy saves that lack travel deadlines", async () => {
    const f = await fixture(); await Effect.runPromise(f.start());
    const started = await f.advance("harvest");
    const job = started.farm.production.planting!;
    if (job.phase.type !== "harvesting") throw new Error("Expected harvesting");
    await db.update(farms).set({ production: { ...started.farm.production, planting: { ...job, nextStepAt: undefined, travelMs: undefined } } }).where(eq(farms.id, f.farmId));
    const returned = await catchUp(f.farmId, Date.parse(job.phase.completesAt) + 120000);
    expect(returned.production.planting).toBeNull();
    expect(returned.carriedItemQuantity).toBe(8);
  });
  it("handles a late travel callback with the fully caught-up snapshot", async () => {
    const f = await fixture();
    const started = await Effect.runPromise(f.start());
    await db.update(farms).set({ production: { ...started.farm.production, planting: {
      ...started.farm.production.planting!, nextStepAt: new Date(Date.now() - 120000).toISOString()
    } } }).where(eq(farms.id, f.farmId));
    const returned = await f.advance("harvest");
    expect(returned.farm.production.planting).toBeNull();
    expect(returned.farm.carriedItem?.quantity).toBe(8);
    expect(returned.farm.progression?.stats.harvests).toBe(4);
  });
  it("accumulates 2, 4, 6, 8 carried barley, counts each field once, and supports partial storage", async () => {
    const f = await fixture();
    const started = await Effect.runPromise(f.start());
    const batch = started.farm.production.planting!;
    let arrival = Date.parse(batch.nextStepAt!);
    for (let count = 1; count <= 4; count++) {
      const working = await catchUp(f.farmId, arrival);
      expect(working.production.planting?.phase.type).toBe("harvesting");
      const beforeCompletion = await catchUp(f.farmId, arrival + 9999);
      expect(beforeCompletion.carriedItemQuantity).toBe((count - 1) * 2);
      const done = await catchUp(f.farmId, arrival + 10000);
      expect(done.carriedItemQuantity).toBe(count * 2);
      expect(done.progressionStats.harvests).toBe(count);
      expect(await db.select().from(farmCrops).where(eq(farmCrops.farmId, f.farmId))).toHaveLength(5 - count);
      const repeated = await catchUp(f.farmId, arrival + 10000);
      expect(repeated.carriedItemQuantity).toBe(count * 2);
      expect(repeated.progressionStats.harvests).toBe(count);
      expect(repeated.version).toBe(done.version);
      arrival += 10000 + (batch.travelMs?.[count] ?? 0);
    }
    expect((await f.read()).production.planting).toBeNull();
    const deposited = await Effect.runPromise(depositCarriedItem(db, { playerId: f.playerId, expectedFarmVersion: (await f.read()).version }));
    expect(deposited.farm.carriedItem?.quantity).toBe(3);
    expect(deposited.inventory.find(i => i.itemKey === "barley")?.quantity).toBe(5);
  });
  it("finishes the current field on stop without harvesting the remainder", async () => {
    const f = await fixture(); await Effect.runPromise(f.start()); await f.advance("harvest");
    expect((await f.advance("stop")).farm.production.planting?.stopRequested).toBe(true);
    await f.finishTimer(); const stopped = await f.advance("finish");
    expect(stopped.farm.production.planting).toBeNull();
    expect(stopped.farm.carriedItem?.quantity).toBe(2);
    expect(stopped.crops).toHaveLength(4);
  });
  it("rejects five fields, duplicates, unripe crops, occupied hands and cross-mode commands", async () => {
    const f = await fixture();
    expect(GameCommandSchema.safeParse({ type: "start_batch_harvesting", targets, expectedFarmVersion: 1 }).success).toBe(true);
    for (const fields of [targets, [targets[0]!, targets[0]!], [{ column: 7, row: 0 }]])
      await expect(Effect.runPromise(Effect.flip(f.start(fields)))).resolves.toMatchObject({ _tag: "BatchPlantingError" });
    await db.update(farmCrops).set({ growthCompletesAt: new Date(Date.now() + 60000) }).where(and(eq(farmCrops.farmId, f.farmId), eq(farmCrops.column, 0)));
    await expect(Effect.runPromise(Effect.flip(f.start([targets[0]!])))).resolves.toMatchObject({ _tag: "BatchPlantingError" });
    await db.update(farms).set({ carriedItemKey: "barley", carriedItemQuantity: 1, carriedItemExpiresAt: new Date(Date.now() + 60000) }).where(eq(farms.id, f.farmId));
    await expect(Effect.runPromise(Effect.flip(f.start([targets[1]!])))).resolves.toMatchObject({ _tag: "BatchPlantingError" });
    await db.update(farms).set({ carriedItemKey: null, carriedItemQuantity: 0, carriedItemExpiresAt: null }).where(eq(farms.id, f.farmId));
    await Effect.runPromise(f.start([targets[1]!]));
    await expect(f.advance("collect")).rejects.toThrow();
    await expect(f.advance("plant")).rejects.toThrow();
    const stopped = await f.advance("stop");
    expect(stopped.farm.carriedItem).toBeNull();
    expect(stopped.crops).toHaveLength(5);
  });
});
