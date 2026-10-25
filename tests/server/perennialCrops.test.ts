import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { Effect } from "effect";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createDatabase } from "../../src/server/db/client";
import { farms, players, farmCrops, farmBuildings, farmImprovements, farmInventory, shekelTransactions } from "../../src/server/db/schema";
import { tendPerennialCrop } from "../../src/server/services/perennialCrops";
import { advanceFarmLifecycle } from "../../src/server/services/farmLifecycle";
import { supplyBrewery } from "../../src/server/services/brewerySupplies";
import { startHarvestCrop } from "../../src/server/services/harvestCrop";
import { CROP_DEFINITIONS } from "../../src/game-data/crops";
import { plantCrop } from "../../src/server/services/plantCrop";
import { batchPlantingAction } from "../../src/server/services/batchPlanting";

const client = new Client({ connectionString: process.env.TEST_DATABASE_URL ?? "postgres://sumer:sumer_dev@localhost:5432/sumer_farming" });
const db = createDatabase(client);
const ids = new Set<string>();
const target = { column: 4, row: 8 };
beforeAll(() => client.connect());
afterEach(async () => { if (ids.size) await db.delete(players).where(inArray(players.id, [...ids])); ids.clear(); });
afterAll(() => client.end());
const fixture = async (level = 9, balance = 100) => {
  const playerId = randomUUID(); ids.add(playerId);
  await db.insert(players).values({ id: playerId, displayName: "Palm test", shekelBalance: balance });
  const [farm] = await db.insert(farms).values({ playerId, level, happiness: 60, happinessCheckedAt: new Date() }).returning();
  await db.insert(farmBuildings).values({ farmId: farm!.id, type: "warehouse", column: 5, row: 3, loadingTile: { column: 5, row: 5 }, startedAt: new Date(0), completesAt: new Date(1) });
  await db.insert(farmImprovements).values([8,9].map(row => ({ farmId: farm!.id, type: "irrigation" as const, column: 3, row, startedAt: new Date(0), completesAt: new Date(1) })));
  const read = async () => (await db.select().from(farms).where(eq(farms.id, farm!.id)))[0]!;
  const act = async (action: "plant" | "harvest" | "tend", position = target, version?: number) => Effect.runPromise(tendPerennialCrop(db, {
    type: "tend_perennial_crop", action, playerId, crop: "datePalm", target: position, expectedFarmVersion: version ?? (await read()).version
  }));
  const mature = async () => {
    const [crop] = await db.insert(farmCrops).values({ farmId: farm!.id, cropKey: "datePalm", ...target,
      sowingStartedAt: new Date(0), plantedAt: new Date(10000), growthCompletesAt: new Date(86410000) }).returning();
    return crop!;
  };
  const catchUp = (at: number) => db.transaction(async tx => {
    const [record] = await tx.select().from(farms).where(eq(farms.id, farm!.id)).for("update");
    return advanceFarmLifecycle(tx, record!, new Date(at));
  });
  const stock = async () => (await db.select().from(farmInventory).where(and(eq(farmInventory.farmId, farm!.id), eq(farmInventory.itemKey, "dates"))))[0]?.quantity ?? 0;
  return { playerId, farmId: farm!.id, read, act, mature, catchUp, stock };
};

describe("perennial crops", () => {
  it("persists a single tending reduction immediately and preserves it through offline settlement", async () => {
    const f = await fixture(); const crop = await f.mature();
    const start = Date.now() - 6 * 3600000, readyAt = start + 24 * 3600000;
    await db.update(farmCrops).set({ growthCompletesAt: new Date(readyAt) }).where(eq(farmCrops.id, crop.id));
    const farm = await f.read();
    await db.update(farms).set({ production: { ...farm.production, palmCycles: { [crop.id]: { startedAt: start, originalReadyAt: readyAt } } } }).where(eq(farms.id, f.farmId));
    const result = await f.act("tend");
    const cycle = result.farm.production.palmCycles![crop.id]!;
    const deadline = cycle.tendedAt! + Math.ceil((readyAt - cycle.tendedAt!) / 2);
    expect(Date.parse(result.crops[0]!.growthCompletesAt)).toBe(deadline);
    expect(result.player.shekelBalance).toBe(100);
    expect(result.farm.production.cropWork).toMatchObject({ action: "tend", quantity: 0 });
    await expect(f.act("tend", target, result.farm.version)).rejects.toThrow();
    await f.catchUp(deadline + 1);
    const restored = await f.read();
    expect(restored.production.palmCycles![crop.id]).toEqual(cycle);
    expect(await f.stock()).toBe(0);
    await expect(f.act("tend")).rejects.toThrow(/already/);
    const [tree] = await db.select().from(farmCrops).where(eq(farmCrops.id, crop.id));
    expect(tree!.growthCompletesAt.getTime()).toBe(deadline);
  });
  it("rejects late tending and legacy cycles without changing their saved deadline", async () => {
    const f = await fixture(); const crop = await f.mature();
    const start = Date.now() - 13 * 3600000, readyAt = start + 24 * 3600000;
    await db.update(farmCrops).set({ growthCompletesAt: new Date(readyAt) }).where(eq(farmCrops.id, crop.id));
    await expect(f.act("tend")).rejects.toThrow(/next harvest/);
    const farm = await f.read();
    await db.update(farms).set({ production: { ...farm.production, palmCycles: { [crop.id]: { startedAt: start, originalReadyAt: readyAt } } } }).where(eq(farms.id, f.farmId));
    await expect(f.act("tend")).rejects.toThrow(/closed/);
    expect((await db.select().from(farmCrops).where(eq(farmCrops.id, crop.id)))[0]!.growthCompletesAt.getTime()).toBe(readyAt);
  });
  it("charges once, saves travel + planting, and matures without completion commands", async () => {
    const f = await fixture();
    const snapshot = await f.act("plant");
    const job = snapshot.farm.production.cropWork!;
    const crop = snapshot.crops[0]!;
    expect(snapshot.player.shekelBalance).toBe(75);
    expect(job.workStartsAt).toBeGreaterThan(job.startedAt);
    expect(job.outbound.at(-1)).toEqual(target);
    expect(job.inbound).toEqual([target]);
    expect(job.workEndsAt - job.workStartsAt).toBe(10000);
    expect(Date.parse(crop.plantedAt)).toBe(job.workEndsAt);
    expect(Date.parse(crop.growthCompletesAt) - Date.parse(crop.plantedAt)).toBe(24 * 3600000);
    await expect(f.act("plant", target, 1)).rejects.toThrow();
    const duringTravel = await f.catchUp(job.workStartsAt - 1);
    expect(duringTravel.production.cropWork?.settled).toBe(false);
    expect(duringTravel.production.cropWork?.workEndsAt).toBe(job.workEndsAt);
    const done = await f.catchUp(job.completesAt + 86400000);
    expect(done.production.cropWork?.settled).toBe(true);
    expect((await db.select().from(shekelTransactions).where(eq(shekelTransactions.playerId, f.playerId)))).toHaveLength(1);
  });
  it.each([1,8])("locks planting at level %i", async level => {
    const f = await fixture(level); await expect(f.act("plant")).rejects.toThrow(/level 9/);
  });
  it("requires shekels and an empty irrigated tile", async () => {
    const f = await fixture(9, 24);
    await expect(f.act("plant")).rejects.toThrow(/shekels/);
    await db.update(players).set({ shekelBalance: 100 }).where(eq(players.id, f.playerId));
    await expect(f.act("plant", { column: 6, row: 8 })).rejects.toThrow(/irrigated/);
    await f.mature(); await expect(f.act("plant")).rejects.toThrow(/irrigated/);
  });
  it("limits the initial orchard to two palms", async () => {
    const f = await fixture();
    await db.insert(farmCrops).values([0,1].map(column => ({ farmId: f.farmId, cropKey: "datePalm" as const, column, row: 0, sowingStartedAt: new Date(0), plantedAt: new Date(1), growthCompletesAt: new Date(86400001) })));
    await expect(f.act("plant")).rejects.toThrow(/Maximum 2/);
  });
  it("delivers two baskets offline and starts a fresh untended 24-hour cycle from harvest", async () => {
    const f = await fixture(); const crop = await f.mature();
    const snapshot = await f.act("harvest"); const job = snapshot.farm.production.cropWork!;
    expect(job.outbound.at(-1)).toEqual(target);
    expect(job.inbound[0]).toEqual(target);
    expect(job.workEndsAt - job.workStartsAt).toBe(10000);
    await f.catchUp(job.workStartsAt + 5000);
    expect((await f.read()).production.cropWork).toEqual(job);
    expect(await f.stock()).toBe(0);
    expect(job.inbound.at(-1)).toEqual({ column: 5, row: 5 });
    expect(await f.stock()).toBe(0);
    const done = await f.catchUp(job.completesAt + 100000);
    expect(done.production.cropWork?.settled).toBe(true); expect(await f.stock()).toBe(2);
    const [tree] = await db.select().from(farmCrops).where(eq(farmCrops.id, crop.id));
    expect(tree!.growthCompletesAt.getTime()).toBe(job.workEndsAt + 24 * 3600000);
    expect(done.production.palmCycles?.[crop.id]).toEqual({ startedAt: job.workEndsAt, originalReadyAt: job.workEndsAt + 24 * 3600000 });
    expect(tree!.plantedAt).toEqual(crop.plantedAt);
    expect(done.progressionStats.harvestedBarley).toBe(0);
    expect(done.progressionStats.datesStored).toBe(2);
    await f.catchUp(job.completesAt + 200000); expect(await f.stock()).toBe(2);
    expect((await f.read()).progressionStats.datesStored).toBe(2);
    await expect(f.act("harvest")).rejects.toThrow(/still growing/);
  });
  it.each([0,1,2,3])("stores a full harvest only in the warehouse with %i baskets already stored", async stored => {
    const f = await fixture(); await f.mature();
    if (stored) await db.insert(farmInventory).values({ farmId: f.farmId, itemKey: "dates", quantity: stored });
    const snapshot = await f.act("harvest"); const job = snapshot.farm.production.cropWork!;
    expect(job.inbound.at(-1)).toEqual({ column: 5, row: 5 });
    expect(job.quantity).toBe(2);
    await f.catchUp(job.completesAt); expect(await f.stock()).toBe(stored + 2);
  });
  it.each([4,5,10])("blocks the whole harvest with %i stored baskets and leaves the palm unchanged", async quantity => {
    const f = await fixture(); const crop = await f.mature();
    await db.insert(farmInventory).values({ farmId: f.farmId, itemKey: "dates", quantity });
    await expect(f.act("harvest")).rejects.toThrow(/No storage space/);
    expect(await f.stock()).toBe(quantity);
    expect((await f.read()).production.cropWork).toBeUndefined();
    const [tree] = await db.select().from(farmCrops).where(eq(farmCrops.id, crop.id));
    expect(tree!.growthCompletesAt).toEqual(crop.growthCompletesAt);
    expect(tree!.harvestStartedAt).toBeNull();
  });
  it.each(["absent", "unfinished"])("requires a completed warehouse, never falling back to a farm or granary (%s)", async state => {
    const f = await fixture(); await f.mature();
    if (state === "absent") await db.delete(farmBuildings).where(eq(farmBuildings.farmId, f.farmId));
    else await db.update(farmBuildings).set({ completesAt: new Date(Date.now() + 60000) }).where(eq(farmBuildings.farmId, f.farmId));
    await db.insert(farmBuildings).values({ farmId: f.farmId, type: "granary", column: 0, row: 0, startedAt: new Date(0), completesAt: new Date(1) });
    await expect(f.act("harvest")).rejects.toThrow();
    expect(await f.stock()).toBe(0);
  });
  it("blocks repeated harvests and the legacy annual-crop endpoints", async () => {
    const f = await fixture(); await f.mature();
    await expect(Effect.runPromise(startHarvestCrop(db, { playerId: f.playerId, target, expectedFarmVersion: 1 }))).rejects.toThrow();
    await expect(Effect.runPromise(plantCrop(db, { playerId: f.playerId, crop: "datePalm", target, expectedFarmVersion: 1 }))).rejects.toThrow();
    await expect(Effect.runPromise(batchPlantingAction(db, { type: "start_batch_harvesting", playerId: f.playerId, targets: [target], expectedFarmVersion: 1 }))).rejects.toThrow();
    const snapshot = await f.act("harvest");
    await expect(f.act("harvest", target, snapshot.farm.version)).rejects.toThrow(/tending/);
    await expect(f.act("harvest", { column: 4, row: 7 }, snapshot.farm.version)).rejects.toThrow(/tending/);
  });
  it("consumes one basket, gives fish's +10 boost and has its own persisted cooldown", async () => {
    const f = await fixture();
    await db.insert(farmInventory).values({ farmId: f.farmId, itemKey: "dates", quantity: 2 });
    await db.update(farms).set({ lastFishAt: new Date() }).where(eq(farms.id, f.farmId));
    const treat = (version: number) => Effect.runPromise(supplyBrewery(db, { type: "give_farmer_dates", playerId: f.playerId, expectedFarmVersion: version }));
    const snapshot = await treat(1);
    expect(snapshot.farm.household.happiness).toBe(70); expect(await f.stock()).toBe(1);
    expect(snapshot.farm.production.lastDatesAt).toBeTruthy();
    await expect(treat(snapshot.farm.version)).rejects.toThrow(/8 hours/);
    expect(await f.stock()).toBe(1);
    expect(CROP_DEFINITIONS.datePalm.harvestItemKey).toBe("dates");
  });
});
