import { cropWorkReserved } from "../../src/game-data/cropWork";
import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { Effect } from "effect";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createDatabase } from "../../src/server/db/client";
import { farms, players, farmCrops, farmBuildings, farmImprovements, farmInventory } from "../../src/server/db/schema";
import { startSesameHarvest, tendPerennialCrop } from "../../src/server/services/perennialCrops";
import { buyFromNpcMarket, sellToNpcMarket } from "../../src/server/services/tradeMarketItem";
import { advanceFarmLifecycle } from "../../src/server/services/farmLifecycle";

const client = new Client({ connectionString: process.env.TEST_DATABASE_URL ?? "postgres://sumer:sumer_dev@localhost:5432/sumer_farming" });
const db = createDatabase(client);
const ids = new Set<string>();
const target = { column: 4, row: 8 };
beforeAll(() => client.connect());
afterEach(async () => { if (ids.size) await db.delete(players).where(inArray(players.id, [...ids])); ids.clear(); });
afterAll(() => client.end());
const fixture = async (level = 10, balance = 100) => {
  const playerId = randomUUID(); ids.add(playerId);
  await db.insert(players).values({ id: playerId, displayName: "Sesame test", shekelBalance: balance });
  const [farm] = await db.insert(farms).values({ playerId, level, happiness: 60, happinessCheckedAt: new Date() }).returning();
  await db.insert(farmBuildings).values({ farmId: farm!.id, type: "warehouse", column: 5, row: 3, loadingTile: { column: 5, row: 5 }, startedAt: new Date(0), completesAt: new Date(1) });
  await db.insert(farmImprovements).values([8,9].map(row => ({ farmId: farm!.id, type: "irrigation" as const, column: 3, row, startedAt: new Date(0), completesAt: new Date(1) })));
  await db.insert(farmInventory).values({ farmId: farm!.id, itemKey: "sesame", quantity: 1 });
  const read = async () => (await db.select().from(farms).where(eq(farms.id, farm!.id)))[0]!;
  const act = async (action: "plant" | "harvest", position = target, version?: number) => Effect.runPromise(tendPerennialCrop(db, {
    type: "work_sesame", action, playerId, crop: "sesame", target: position, expectedFarmVersion: version ?? (await read()).version
  }));
  const mature = async () => {
    const [crop] = await db.insert(farmCrops).values({ farmId: farm!.id, cropKey: "sesame", ...target,
      sowingStartedAt: new Date(0), plantedAt: new Date(10000), growthCompletesAt: new Date(86410000) }).returning();
    return crop!;
  };
  const catchUp = (at: number) => db.transaction(async tx => {
    const [record] = await tx.select().from(farms).where(eq(farms.id, farm!.id)).for("update");
    return advanceFarmLifecycle(tx, record!, new Date(at));
  });
  const stock = async () => (await db.select().from(farmInventory).where(and(eq(farmInventory.farmId, farm!.id), eq(farmInventory.itemKey, "sesame"))))[0]?.quantity ?? 0;
  return { playerId, farmId: farm!.id, read, act, mature, catchUp, stock };
};

describe("sesame saved work", () => {
  it("buys seeds for 3 shekels and protects space reserved for a harvest", async () => {
    const f = await fixture();
    const bought = await Effect.runPromise(buyFromNpcMarket(db, { playerId: f.playerId, itemKey: "sesame", quantity: 8,
      expectedUnitPrice: 3, expectedFarmVersion: (await f.read()).version, idempotencyKey: randomUUID() }));
    expect(bought.player.shekelBalance).toBe(76);
    expect(await f.stock()).toBe(9);
    await f.mature();
    const harvest = await f.act("harvest");
    const rejected = await Effect.runPromise(Effect.flip(buyFromNpcMarket(db, { playerId: f.playerId, itemKey: "sesame", quantity: 1,
      expectedUnitPrice: 3, expectedFarmVersion: harvest.farm.version, idempotencyKey: randomUUID() })));
    expect(rejected).toMatchObject({ rule: { type: "insufficient_storage", available: 0 } });
    await f.catchUp(harvest.farm.production.cropWork!.completesAt + 1);
    expect(await f.stock()).toBe(12);
  });
  it("sells the last basket once and rejects selling missing stock", async () => {
    const f = await fixture();
    const input = { playerId: f.playerId, itemKey: "sesame" as const, quantity: 1,
      expectedUnitPrice: 1, expectedFarmVersion: (await f.read()).version, idempotencyKey: randomUUID() };
    const sold = await Effect.runPromise(sellToNpcMarket(db, input));
    expect(sold.player.shekelBalance).toBe(101);
    expect(await f.stock()).toBe(0);
    const retry = await Effect.runPromise(sellToNpcMarket(db, input));
    expect(retry.player.shekelBalance).toBe(101);
    const rejected = await Effect.runPromise(Effect.flip(sellToNpcMarket(db, { ...input,
      expectedFarmVersion: retry.farm.version, idempotencyKey: randomUUID() })));
    expect(rejected).toMatchObject({ rule: { type: "insufficient_stored_item", available: 0 } });
    expect(await f.stock()).toBe(0);
  });
  it("requires level 10 for both buying and selling sesame", async () => {
    const f = await fixture(9);
    for (const [trade, price] of [[buyFromNpcMarket, 3], [sellToNpcMarket, 1]] as const) {
      const rejected = await Effect.runPromise(Effect.flip(trade(db, { playerId: f.playerId,
        itemKey: "sesame", quantity: 1, expectedUnitPrice: price,
        expectedFarmVersion: (await f.read()).version, idempotencyKey: randomUUID() })));
      expect(rejected).toMatchObject({ rule: { type: "trade_unavailable", itemKey: "sesame" } });
    }
    expect(await f.stock()).toBe(1);
  });
  it("spends the last seed once and preserves the full 60-minute cycle offline", async () => {
    const f = await fixture();
    const snapshot = await f.act("plant");
    const job = snapshot.farm.production.cropWork!;
    expect(await f.stock()).toBe(0);
    expect(Date.parse(snapshot.crops[0]!.plantedAt)).toBe(job.workEndsAt);
    expect(Date.parse(snapshot.crops[0]!.growthCompletesAt) - job.workEndsAt).toBe(3600000);
    await expect(f.act("plant", target, snapshot.farm.version)).rejects.toThrow();
    await f.catchUp(job.completesAt + 3600000);
    await f.catchUp(job.completesAt + 3600001);
    expect(await f.stock()).toBe(0);
    expect((await f.read()).production.cropWork?.settled).toBe(true);
  });
  it("stores three baskets exactly once and clears the annual crop", async () => {
    const f = await fixture(); await f.mature();
    const snapshot = await f.act("harvest");
    const job = snapshot.farm.production.cropWork!;
    expect(job.quantity).toBe(3);
    expect(await f.stock()).toBe(1);
    await f.catchUp(job.completesAt + 1);
    await f.catchUp(job.completesAt + 86400000);
    expect(await f.stock()).toBe(4);
    expect(await db.select().from(farmCrops).where(eq(farmCrops.farmId, f.farmId))).toHaveLength(0);
    expect((await f.read()).progressionStats.datesStored ?? 0).toBe(0);
  });
  it("rejects insufficient room without starting a harvest", async () => {
    const f = await fixture(); await f.mature();
    await db.update(farmInventory).set({ quantity: 10 }).where(eq(farmInventory.farmId, f.farmId));
    await expect(f.act("harvest")).rejects.toThrow(/space for 3/);
    expect((await f.read()).production.cropWork).toBeFalsy();
    expect(await f.stock()).toBe(10);
  });
  it("rejects planting before level 10 and without seeds", async () => {
    const locked = await fixture(9); await expect(locked.act("plant")).rejects.toThrow(/level 10/);
    const f = await fixture();
    await db.delete(farmInventory).where(eq(farmInventory.farmId, f.farmId));
    await expect(f.act("plant")).rejects.toThrow(/1 basket/);
  });
});

describe("multi-field sesame harvesting", () => {
  const setup = async (quantity = 1) => {
    const f = await fixture();
    await db.update(farmInventory).set({ quantity }).where(and(eq(farmInventory.farmId, f.farmId), eq(farmInventory.itemKey, "sesame")));
    await f.mature();
    const second = { column: 4, row: 9 };
    await db.insert(farmCrops).values({ farmId: f.farmId, cropKey: "sesame", ...second,
      sowingStartedAt: new Date(0), plantedAt: new Date(10000), growthCompletesAt: new Date(86410000) });
    const start = async (targets = [target, second]) => Effect.runPromise(startSesameHarvest(db, {
      type: "start_batch_harvesting", crop: "sesame", playerId: f.playerId, targets,
      expectedFarmVersion: (await f.read()).version,
    }));
    return { ...f, second, start };
  };
  it("schedules field-by-field deliveries and catches up exactly once offline", async () => {
    const f = await setup();
    const saved = await f.start();
    const first = saved.farm.production.cropWork!;
    const second = saved.farm.production.cropWorkQueue![0]!;
    expect(first.batch).toMatchObject({ index: 0, total: 2 });
    expect(second.batch).toMatchObject({ index: 1, total: 2, id: first.batch!.id });
    expect(second.startedAt).toBe(first.completesAt);
    expect(second.outbound[0]).toEqual(first.inbound.at(-1));
    expect(cropWorkReserved(saved.farm.production, "sesame")).toBe(6);
    expect(await f.stock()).toBe(1);
    const partial = await f.catchUp(first.completesAt);
    expect(await f.stock()).toBe(4);
    expect(partial.production.cropWork!.id).toBe(second.id);
    expect(cropWorkReserved(partial.production, "sesame")).toBe(3);
    await f.catchUp(second.completesAt + 1000);
    await f.catchUp(second.completesAt + 2000);
    expect(await f.stock()).toBe(7);
    expect(await db.select().from(farmCrops).where(eq(farmCrops.farmId, f.farmId))).toHaveLength(0);
    expect((await f.read()).production.cropWork!.settled).toBe(true);
    expect(cropWorkReserved((await f.read()).production, "sesame")).toBe(0);
  });
  it("reserves all selected yields against concurrent purchases", async () => {
    const f = await setup(6);
    const saved = await f.start();
    const rejected = await Effect.runPromise(Effect.flip(buyFromNpcMarket(db, { playerId: f.playerId, itemKey: "sesame", quantity: 1,
      expectedUnitPrice: 3, expectedFarmVersion: saved.farm.version, idempotencyKey: randomUUID() })));
    expect(rejected).toMatchObject({ rule: { type: "insufficient_storage", available: 0 } });
    await expect(f.start()).rejects.toThrow();
    const end = saved.farm.production.cropWorkQueue![0]!.completesAt;
    await f.catchUp(end + 1000);
    expect(await f.stock()).toBe(12);
  });
  it("rejects too little warehouse space and duplicates without reserving any fields", async () => {
    const f = await setup(7);
    await expect(f.start()).rejects.toThrow(/warehouse space/);
    await expect(f.start([target, target])).rejects.toThrow(/distinct/);
    expect((await f.read()).production.cropWork).toBeUndefined();
    const crops = await db.select().from(farmCrops).where(eq(farmCrops.farmId, f.farmId));
    expect(crops.every(c => c.harvestStartedAt === null)).toBe(true);
  });
  it("rejects non-sesame fields, unripe crops and selections beyond happiness capacity", async () => {
    const f = await setup();
    await db.update(farmCrops).set({ cropKey: "barley" }).where(and(eq(farmCrops.farmId, f.farmId), eq(farmCrops.row, 9)));
    await expect(f.start()).rejects.toThrow(/Sesame not found/);
    await db.update(farmCrops).set({ cropKey: "sesame", growthCompletesAt: new Date(Date.now() + 100000) }).where(and(eq(farmCrops.farmId, f.farmId), eq(farmCrops.row, 9)));
    await expect(f.start()).rejects.toThrow(/still growing/);
    await expect(f.start(Array.from({ length: 7 }, (_, i) => ({ column: i, row: 8 })))).rejects.toThrow(/Select up to/);
  });
});
