import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { Effect } from "effect";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createDatabase } from "../../src/server/db/client";
import { farms, players, farmCrops, farmBuildings, farmImprovements, farmInventory } from "../../src/server/db/schema";
import { tendPerennialCrop } from "../../src/server/services/perennialCrops";
import { buyFromNpcMarket } from "../../src/server/services/tradeMarketItem";
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
