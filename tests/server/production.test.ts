import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { Effect } from "effect";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createDatabase } from "../../src/server/db/client";
import { farmBuildings, farmInventory, farms, players } from "../../src/server/db/schema";
import { productionAction } from "../../src/server/services/production";
import { startMilling } from "../../src/server/services/milling";
import { supplyBrewery } from "../../src/server/services/brewerySupplies";
import { readFarmSnapshot } from "../../src/server/services/farmSnapshot";
import { BREAD_RECIPE, emptyProductionState } from "../../src/game-data/production";

const connectionString = process.env.TEST_DATABASE_URL ?? "postgres://sumer:sumer_dev@localhost:5432/sumer_farming";
const client = new Client({ connectionString });
const db = createDatabase(client);
const ids = new Set<string>();
beforeAll(() => client.connect());
afterEach(async () => {
  if (ids.size) await db.delete(players).where(inArray(players.id, [...ids]));
  ids.clear();
});
afterAll(() => client.end());

const fixture = async (flour = 6, level = 6) => {
  const playerId = randomUUID();
  ids.add(playerId);
  await db.insert(players).values({ id: playerId, displayName: "Baking test" });
  const [farm] = await db.insert(farms).values({ playerId, level }).returning();
  const [oven] = await db.insert(farmBuildings).values({ farmId: farm!.id, type: "breadOven", column: 5, row: 3,
    startedAt: new Date(0), completesAt: new Date(1) }).returning();
  await db.insert(farmInventory).values({ farmId: farm!.id, itemKey: "flour", quantity: flour });
  const refresh = () => db.transaction(async tx => {
    const [record] = await tx.select().from(farms).where(eq(farms.id, farm!.id)).for("update");
    return readFarmSnapshot(tx, record!, false);
  });
  const bake = (version = 1) => ({ type: "start_baking" as const, playerId, buildingId: oven!.id, expectedFarmVersion: version });
  const delivery = (action: "pickup" | "store", version: number) => ({ type: "production_delivery" as const, action, playerId, buildingId: oven!.id, expectedFarmVersion: version });
  const finish = async () => {
    const [record] = await db.select().from(farms).where(eq(farms.id, farm!.id));
    const job = record!.production.baking[oven!.id]!;
    await db.update(farms).set({ production: { ...record!.production, baking: {
      ...record!.production.baking, [oven!.id]: { ...job, startedAt: new Date(0).toISOString(), completesAt: new Date(1).toISOString() }
    } } }).where(eq(farms.id, farm!.id));
    return refresh();
  };
  return { farm: farm!, oven: oven!, refresh, bake, delivery, finish };
};

describe("baking and finished-goods delivery", () => {
  it("locks other physical actions until baking completes, including after reload", async () => {
    const f = await fixture();
    await Effect.runPromise(productionAction(db, f.bake()));
    const reloaded = await f.refresh();
    const expectedFarmVersion = reloaded.farm.version;
    await expect(Effect.runPromise(Effect.flip(startMilling(db, {
      type: "start_milling", playerId: f.farm.playerId, recipe: "flour", target: { column: 3, row: 3 }, expectedFarmVersion
    })))).resolves.toMatchObject({ message: expect.stringContaining("baking") });
    await expect(Effect.runPromise(Effect.flip(productionAction(db, f.delivery("pickup", expectedFarmVersion))))).resolves.toMatchObject({ message: expect.stringContaining("baking") });
    await expect(Effect.runPromise(Effect.flip(supplyBrewery(db, {
      type: "give_farmer_bread", playerId: f.farm.playerId, expectedFarmVersion
    })))).resolves.toMatchObject({ message: "The farmer is busy." });
    const complete = await f.finish();
    const picked = await Effect.runPromise(productionAction(db, f.delivery("pickup", complete.farm.version)));
    expect(picked.farm.production.delivery?.quantity).toBe(2);
  });
  it("charges two Flour once and starts a persisted five-minute job", async () => {
    const f = await fixture();
    const started = await Effect.runPromise(productionAction(db, f.bake()));
    const job = started.farm.production.baking[f.oven.id]!;
    expect(Date.parse(job.completesAt) - Date.parse(job.startedAt)).toBe(300000);
    expect(job.output).toBe(BREAD_RECIPE.output);
    expect(started.inventory.find(i => i.itemKey === "flour")?.quantity).toBe(4);
    expect(started.inventory.find(i => i.itemKey === "bread")).toBeUndefined();
    expect((await f.refresh()).farm.production.baking).toEqual(started.farm.production.baking);
    await expect(Effect.runPromise(Effect.flip(productionAction(db, f.bake())))).resolves.toMatchObject({ message: "The farm changed. Please try again." });
    await expect(Effect.runPromise(Effect.flip(productionAction(db, f.bake(started.farm.version))))).resolves.toMatchObject({ message: "This oven is already baking." });
    expect((await f.refresh()).inventory.find(i => i.itemKey === "flour")?.quantity).toBe(4);
  });

  it("accumulates completed batches without crediting resources, then stores exactly once after pickup and reload", async () => {
    const f = await fixture();
    await Effect.runPromise(productionAction(db, f.bake()));
    const first = await f.finish();
    expect(first.farm.production.pending[f.oven.id]).toEqual({ itemKey: "bread", quantity: 2 });
    expect(first.farm.production.baking).toEqual({});
    expect(first.farm.progression?.stats.breadProduced).toBe(2);
    expect((await f.refresh()).farm.progression?.stats.breadProduced).toBe(2);
    expect((await f.refresh()).farm.production.pending).toEqual(first.farm.production.pending);
    await Effect.runPromise(productionAction(db, f.bake(first.farm.version)));
    const second = await f.finish();
    expect(second.farm.production.pending[f.oven.id]?.quantity).toBe(4);
    expect(second.farm.progression?.stats.breadProduced).toBe(4);
    expect(second.inventory.find(i => i.itemKey === "bread")).toBeUndefined();
    await expect(Effect.runPromise(Effect.flip(productionAction(db, f.delivery("store", second.farm.version))))).resolves.toMatchObject({ message: "There is no matching delivery to store." });
    const picked = await Effect.runPromise(productionAction(db, f.delivery("pickup", second.farm.version)));
    expect(picked.farm.production.pending).toEqual({});
    expect(picked.farm.production.delivery).toEqual({ buildingId: f.oven.id, itemKey: "bread", quantity: 4 });
    expect(picked.inventory.find(i => i.itemKey === "bread")).toBeUndefined();
    const reloaded = await f.refresh();
    expect(reloaded.farm.production.delivery).toEqual(picked.farm.production.delivery);
    await expect(Effect.runPromise(Effect.flip(productionAction(db, f.bake(reloaded.farm.version))))).resolves.toMatchObject({ message: "Finish the current task and empty the farmer's hands first." });
    const stored = await Effect.runPromise(productionAction(db, f.delivery("store", reloaded.farm.version)));
    expect(stored.inventory.find(i => i.itemKey === "bread")?.quantity).toBe(4);
    expect(stored.farm.production.delivery).toBeNull();
    await expect(Effect.runPromise(Effect.flip(productionAction(db, f.delivery("store", stored.farm.version))))).resolves.toMatchObject({ message: "There is no matching delivery to store." });
    expect((await f.refresh()).inventory.find(i => i.itemKey === "bread")?.quantity).toBe(4);
  });

  it.each([0, 1])("rejects baking with only %i stored Flour", async flour => {
    const f = await fixture(flour);
    await expect(Effect.runPromise(Effect.flip(productionAction(db, f.bake())))).resolves.toMatchObject({ message: "Baking requires 2 stored Flour." });
    const after = await f.refresh();
    expect(after.farm.production).toEqual(emptyProductionState());
    expect(after.inventory.find(i => i.itemKey === "flour")?.quantity).toBe(flour);
    expect(after.farm.version).toBe(1);
  });

  it("rejects baking below level 6", async () => {
    const f = await fixture(6, 5);
    await expect(Effect.runPromise(Effect.flip(productionAction(db, f.bake())))).resolves.toMatchObject({ message: "Unlock at level 6." });
  });

  it("rejects a foreign oven and leaves both farms unchanged", async () => {
    const f = await fixture();
    const foreign = await fixture();
    await expect(Effect.runPromise(Effect.flip(productionAction(db, { ...f.bake(), buildingId: foreign.oven.id })))).resolves.toMatchObject({ message: "Choose a completed Bread Oven." });
    expect((await f.refresh()).farm.production).toEqual(emptyProductionState());
    expect((await foreign.refresh()).farm.production).toEqual(emptyProductionState());
  });

  it("rejects baking while carrying items or constructing the oven", async () => {
    const f = await fixture();
    await db.update(farms).set({ carriedItemKey: "barley", carriedItemQuantity: 1 }).where(eq(farms.id, f.farm.id));
    await expect(Effect.runPromise(Effect.flip(productionAction(db, f.bake())))).resolves.toMatchObject({ _tag: "ProductionRuleError" });
    await db.update(farms).set({ carriedItemKey: null, carriedItemQuantity: 0 }).where(eq(farms.id, f.farm.id));
    await db.update(farmBuildings).set({ completesAt: new Date(Date.now() + 60000) }).where(eq(farmBuildings.id, f.oven.id));
    await expect(Effect.runPromise(Effect.flip(productionAction(db, f.bake())))).resolves.toMatchObject({ _tag: "ProductionRuleError" });
    expect((await f.refresh()).inventory.find(i => i.itemKey === "flour")?.quantity).toBe(6);
  });

  it("credits a carried basket only once under concurrent store requests", async () => {
    const f = await fixture();
    await db.update(farms).set({ production: { ...emptyProductionState(), delivery: { buildingId: f.oven.id, itemKey: "bread", quantity: 2 } } }).where(eq(farms.id, f.farm.id));
    const other = new Client({ connectionString });
    await other.connect();
    try {
      const results = await Promise.all([db, createDatabase(other)].map(database => Effect.runPromise(Effect.either(productionAction(database, f.delivery("store", 1))))));
      expect(results.map(r => r._tag).sort()).toEqual(["Left", "Right"]);
      expect((await f.refresh()).inventory.find(i => i.itemKey === "bread")?.quantity).toBe(2);
    } finally { await other.end(); }
  });
});
