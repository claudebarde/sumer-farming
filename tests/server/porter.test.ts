import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { Effect } from "effect";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createDatabase } from "../../src/server/db/client";
import { farmBuildings, farmInventory, farms, players, shekelTransactions } from "../../src/server/db/schema";
import { hirePorter } from "../../src/server/services/porter";
import { advanceFarmLifecycle } from "../../src/server/services/farmLifecycle";
import { loadMarketItemStorage } from "../../src/server/services/marketItemStorage";
import { emptyProductionState } from "../../src/game-data/production";
const client = new Client({ connectionString: process.env.TEST_DATABASE_URL ?? "postgres://sumer:sumer_dev@localhost:5432/sumer_farming" });
const db = createDatabase(client);
const ids: string[] = [];
beforeAll(() => client.connect());
afterEach(async () => { if (ids.length) await db.delete(players).where(inArray(players.id, ids)); ids.length = 0; });
afterAll(() => client.end());
const fixture = async (balance = 40, level = 8) => {
  const playerId = randomUUID(); ids.push(playerId);
  await db.insert(players).values({ id: playerId, displayName: "Porter test", shekelBalance: balance });
  const [farm] = await db.insert(farms).values({ playerId, level }).returning();
  return { playerId, farm: farm!, input: { type: "hire_porter" as const, playerId, idempotencyKey: randomUUID(), expectedFarmVersion: 1 } };
};
describe("porter persistence and payment", () => {
  it("starts at the market and books existing bread on the same saved timeline", async () => {
    const f = await fixture();
    const [oven] = await db.insert(farmBuildings).values({ farmId: f.farm.id, type: "breadOven", column: 0, row: 1,
      loadingTile: { column: -1, row: 1 }, startedAt: new Date(0), completesAt: new Date(1) }).returning();
    await db.update(farms).set({ production: { ...emptyProductionState(), pending: { [oven!.id]: { itemKey: "bread", quantity: 2 } } } }).where(eq(farms.id, f.farm.id));
    const marketRoad = { column: 10, row: 5 };
    const hired = await Effect.runPromise(hirePorter(db, { ...f.input, marketRoad }));
    const job = hired.farm.production.porter!.job!;
    expect(job.itemKey).toBe("bread");
    expect(job.path[0]).toEqual(marketRoad);
    expect(job.path[job.pickupIndex]).toEqual(oven!.loadingTile);
    expect(hired.inventory.find(i => i.itemKey === "bread")).toBeUndefined();
    await db.transaction(async tx => {
      const [record] = await tx.select().from(farms).where(eq(farms.id, f.farm.id)).for("update");
      const arriving = await advanceFarmLifecycle(tx, record!, new Date(job.completesAt - 1));
      expect(arriving.production.porter!.job).toEqual(job);
      const delivered = await advanceFarmLifecycle(tx, arriving, new Date(job.completesAt));
      expect(delivered.production.porter!.job).toBeNull();
      await advanceFarmLifecycle(tx, delivered, new Date(job.completesAt + 60_000));
    });
    const stock = await db.select().from(farmInventory).where(eq(farmInventory.farmId, f.farm.id));
    expect(stock.find(i => i.itemKey === "bread")?.quantity).toBe(2);
  });
  it("collects an offline bake completed during the hire, but not one completed after expiry", async () => {
    const f = await fixture();
    const [oven] = await db.insert(farmBuildings).values({ farmId: f.farm.id, type: "breadOven", column: 3, row: 3, loadingTile: { column: 3, row: 5 }, startedAt: new Date(0), completesAt: new Date(1) }).returning();
    const hired = await Effect.runPromise(hirePorter(db, f.input));
    const porter = hired.farm.production.porter!;
    const bake = (completesAt: number) => ({ [oven!.id]: { startedAt: new Date(porter.hiredAt).toISOString(), completesAt: new Date(completesAt).toISOString(), output: 2 } });
    await db.update(farms).set({ production: { ...emptyProductionState(), porter, baking: bake(porter.hiredAt + 10000) } }).where(eq(farms.id, f.farm.id));
    await db.transaction(async tx => {
      const [farm] = await tx.select().from(farms).where(eq(farms.id, f.farm.id)).for("update");
      const completed = await advanceFarmLifecycle(tx, farm!, new Date(porter.expiresAt + 30000));
      expect(completed.production.pending[oven!.id]).toBeUndefined();
    });
    const [stock] = await db.select().from(farmInventory).where(eq(farmInventory.farmId, f.farm.id));
    expect(stock!.quantity).toBe(2);
    await db.update(farms).set({ production: { ...emptyProductionState(), porter, baking: bake(porter.expiresAt + 10000) } }).where(eq(farms.id, f.farm.id));
    await db.transaction(async tx => {
      const [farm] = await tx.select().from(farms).where(eq(farms.id, f.farm.id)).for("update");
      const completed = await advanceFarmLifecycle(tx, farm!, new Date(porter.expiresAt + 30000));
      expect(completed.production.pending[oven!.id]?.quantity).toBe(2);
      expect(completed.production.porter?.job).toBeNull();
    });
  });
  it("charges once, records payment, allows hiring while farmer is working and rejects a second hire", async () => {
    const f = await fixture();
    await db.update(farms).set({ production: { ...emptyProductionState(), baking: { [randomUUID()]: { startedAt: new Date().toISOString(), completesAt: new Date(Date.now() + 100000).toISOString(), output: 2 } } } }).where(eq(farms.id, f.farm.id));
    const hired = await Effect.runPromise(hirePorter(db, f.input));
    expect(hired.player.shekelBalance).toBe(20);
    expect(hired.farm.production.porter!.expiresAt - hired.farm.production.porter!.hiredAt).toBe(86400000);
    const retry = await Effect.runPromise(hirePorter(db, f.input));
    expect(retry.player.shekelBalance).toBe(20);
    const repeat = await Effect.runPromise(Effect.flip(hirePorter(db, { ...f.input, idempotencyKey: randomUUID(), expectedFarmVersion: retry.farm.version })));
    expect(repeat.message).toContain("already hired");
    expect(await db.select().from(shekelTransactions).where(eq(shekelTransactions.playerId, f.playerId))).toHaveLength(1);
  });
  it.each([[19, 8], [40, 4]])("rejects insufficient balance or locked level (%s, %s) without charging", async (balance, level) => {
    const f = await fixture(balance, level);
    await Effect.runPromise(Effect.flip(hirePorter(db, f.input)));
    const [player] = await db.select().from(players).where(eq(players.id, f.playerId));
    expect(player!.shekelBalance).toBe(balance);
  });
  it("reserves market capacity and completes an offline trip exactly once", async () => {
    const f = await fixture();
    const [mill] = await db.insert(farmBuildings).values({ farmId: f.farm.id, type: "mill", column: 3, row: 3, loadingTile: { column: 3, row: 5 }, startedAt: new Date(0), completesAt: new Date(1) }).returning();
    await db.insert(farmInventory).values({ farmId: f.farm.id, itemKey: "flour", quantity: 9 });
    await db.update(farms).set({ millGoods: { pending: { [mill!.id]: { flour: 3, brewersGroats: 0 } }, delivery: null } }).where(eq(farms.id, f.farm.id));
    const hired = await Effect.runPromise(hirePorter(db, f.input));
    expect(hired.farm.production.porter?.job?.quantity).toBe(1);
    const available = await db.transaction(tx => loadMarketItemStorage(tx, f.farm.id, "flour", new Date()));
    expect(available.availableCapacity).toBe(0);
    await db.transaction(async tx => {
      const [farm] = await tx.select().from(farms).where(eq(farms.id, f.farm.id)).for("update");
      const done = await advanceFarmLifecycle(tx, farm!, new Date(Date.now() + 30000));
      await advanceFarmLifecycle(tx, done, new Date(Date.now() + 40000));
    });
    const [stock] = await db.select().from(farmInventory).where(eq(farmInventory.farmId, f.farm.id));
    expect(stock!.quantity).toBe(10);
    const [farm] = await db.select().from(farms).where(eq(farms.id, f.farm.id));
    expect(farm!.millGoods.pending[mill!.id]?.flour).toBe(2);
  });
});
