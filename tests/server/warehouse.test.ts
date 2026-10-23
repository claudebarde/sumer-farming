import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { Effect } from "effect";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createDatabase } from "../../src/server/db/client";
import { farmBuildings, farmInventory, farms, players } from "../../src/server/db/schema";
import { buildFarmBuilding } from "../../src/server/services/buildFarmBuilding";
import { readFarmSnapshot } from "../../src/server/services/farmSnapshot";
import { loadMarketItemStorage } from "../../src/server/services/marketItemStorage";
import { depositCarriedItem, dropCarriedItem } from "../../src/server/services/farmItemActions";
import { productionAction } from "../../src/server/services/production";
import { deliverMillGoods } from "../../src/server/services/milling";
import { emptyProductionState } from "../../src/game-data/production";
import { startGatherResource, completeGatherResource } from "../../src/server/services/gatherResource";

const client = new Client({ connectionString: process.env.TEST_DATABASE_URL ?? "postgres://sumer:sumer_dev@localhost:5432/sumer_farming" });
const db = createDatabase(client);
const ids = new Set<string>();
beforeAll(() => client.connect());
afterEach(async () => { if (ids.size) await db.delete(players).where(inArray(players.id, [...ids])); ids.clear(); });
afterAll(() => client.end());
const fixture = async () => {
  const playerId = randomUUID(); ids.add(playerId);
  await db.insert(players).values({ id: playerId, displayName: "Warehouse test" });
  const [farm] = await db.insert(farms).values({ playerId, level: 8 }).returning();
  const refresh = () => db.transaction(async tx => {
    const [record] = await tx.select().from(farms).where(eq(farms.id, farm!.id)).for("update");
    return readFarmSnapshot(tx, record!, false);
  });
  return { farm: farm!, refresh };
};
describe("warehouse and finite storage", () => {
  it("splits bread delivery between warehouse and farm and persists the remaining cargo", async () => {
    const f = await fixture(); const buildingId = randomUUID();
    const [warehouse] = await db.insert(farmBuildings).values({ farmId: f.farm.id, type: "warehouse", column: 5, row: 3, startedAt: new Date(0), completesAt: new Date(1) }).returning();
    await db.insert(farmInventory).values({ farmId: f.farm.id, itemKey: "bread", quantity: 9, locations: { farm: 0, [warehouse!.id]: 9 } });
    await db.update(farms).set({ production: { ...emptyProductionState(), delivery: { buildingId, itemKey: "bread", quantity: 3 } } }).where(eq(farms.id, f.farm.id));
    const input = { type: "production_delivery" as const, action: "store" as const, buildingId, playerId: f.farm.playerId, expectedFarmVersion: 1 };
    const first = await Effect.runPromise(productionAction(db, input));
    expect(first.inventory.find(i => i.itemKey === "bread")?.quantity).toBe(10);
    expect((await f.refresh()).farm.production.delivery?.quantity).toBe(2);
    const last = await Effect.runPromise(productionAction(db, { ...input, expectedFarmVersion: first.farm.version }));
    expect(last.inventory.find(i => i.itemKey === "bread")?.quantity).toBe(12);
    expect(last.inventory.find(i => i.itemKey === "bread")?.locations).toEqual({ farm: 2, [warehouse!.id]: 10 });
    expect(last.farm.production.delivery).toBeNull();
  });
  it("delivers mixed mill bags to warehouse before farm without crediting farm goods early", async () => {
    const f = await fixture(); const millId = randomUUID();
    const [warehouse] = await db.insert(farmBuildings).values({ farmId: f.farm.id, type: "warehouse", column: 5, row: 3, startedAt: new Date(0), completesAt: new Date(1) }).returning();
    await db.insert(farmInventory).values([{ farmId: f.farm.id, itemKey: "flour", quantity: 10, locations: { farm: 0, [warehouse!.id]: 10 } }, { farmId: f.farm.id, itemKey: "brewersGroats", quantity: 9, locations: { farm: 0, [warehouse!.id]: 9 } }]);
    await db.update(farms).set({ millGoods: { pending: {}, delivery: { millId, bags: { flour: 2, brewersGroats: 3 } } } }).where(eq(farms.id, f.farm.id));
    const input = { type: "mill_delivery" as const, action: "store" as const, millId, playerId: f.farm.playerId, expectedFarmVersion: 1 };
    const first = await Effect.runPromise(deliverMillGoods(db, input));
    expect(first.farm.millGoods.delivery?.bags).toEqual({ flour: 2, brewersGroats: 2 });
    const last = await Effect.runPromise(deliverMillGoods(db, { ...input, expectedFarmVersion: first.farm.version }));
    expect(last.farm.millGoods.delivery).toBeNull();
    expect(last.inventory.find(i => i.itemKey === "flour")?.quantity).toBe(12);
    expect(last.inventory.find(i => i.itemKey === "brewersGroats")?.quantity).toBe(12);
  });
  it("gathers into held cargo offline, credits only at the farm, and rejects gathering when storage is full", async () => {
    const f = await fixture();
    await db.insert(farmInventory).values({ farmId: f.farm.id, itemKey: "clay", quantity: 5 });
    const started = await Effect.runPromise(startGatherResource(db, { playerId: f.farm.playerId, itemKey: "clay", target: { column: 5, row: 9 }, expectedFarmVersion: 1 }));
    expect(started.farm.production.materialReservation).toBe("clay");
    expect((await f.refresh()).farm.production.materialReservation).toBe("clay");
    await db.update(farms).set({ gatheringStartedAt: new Date(Date.now() - 20000), gatheringCompletesAt: new Date(Date.now() - 10000) }).where(eq(farms.id, f.farm.id));
    const gathered = await f.refresh();
    expect(gathered.farm.gathering).toBeNull();
    const retried = await Effect.runPromise(completeGatherResource(db, { playerId: f.farm.playerId, expectedFarmVersion: gathered.farm.version }));
    expect(retried.farm.carriedItem?.quantity).toBe(1);
    expect(gathered.inventory.find(i => i.itemKey === "clay")?.quantity).toBe(5);
    expect(gathered.farm.carriedItem).toMatchObject({ itemKey: "clay", quantity: 1 });
    expect((await f.refresh()).farm.production.materialDelivery).toBe(false);
    const delivered = await Effect.runPromise(depositCarriedItem(db, { playerId: f.farm.playerId, expectedFarmVersion: gathered.farm.version }));
    expect(delivered.inventory.find(i => i.itemKey === "clay")?.quantity).toBe(6);
    expect(delivered.farm.production.materialReservation).toBeNull();
    expect(await Effect.runPromise(Effect.flip(startGatherResource(db, { playerId: f.farm.playerId, itemKey: "clay", target: { column: 5, row: 9 }, expectedFarmVersion: delivered.farm.version })))).toMatchObject({ rule: { type: "storage_full" } });
  });
  it.each(["reed", "clay"] as const)("drops %s on non-arable ground without losing or duplicating it", async itemKey => {
    const f = await fixture();
    await db.update(farms).set({ carriedItemKey: itemKey, carriedItemQuantity: 1 }).where(eq(farms.id, f.farm.id));
    await Effect.runPromise(dropCarriedItem(db, { playerId: f.farm.playerId, target: { column: -2, row: 2 }, expectedFarmVersion: 1 }));
    const snapshot = await f.refresh();
    expect(snapshot.farm.carriedItem).toBeNull();
    expect(snapshot.groundItems).toHaveLength(1);
    expect(snapshot.groundItems[0]).toMatchObject({ itemKey, quantity: 1, expiresAt: null });
  });
  it.each(["reed", "clay"] as const)("rejects invalid %s drop terrain without losing cargo", async itemKey => {
    const f = await fixture();
    await db.update(farms).set({ carriedItemKey: itemKey, carriedItemQuantity: 1 }).where(eq(farms.id, f.farm.id));
    for (const target of [{ column: 4, row: 10 }, { column: 4, row: 11 }, { column: 4, row: 5 },
      { column: 1, row: 3 }, { column: 11, row: 3 }, { column: -5, row: 2 }]) {
      const current = await f.refresh();
      expect(await Effect.runPromise(Effect.flip(dropCarriedItem(db, { playerId: f.farm.playerId, target, expectedFarmVersion: current.farm.version })))).toMatchObject({ rule: { type: "invalid_drop_ground" } });
    }
    const current = await f.refresh();
    expect(current.farm.carriedItem).toMatchObject({ itemKey, quantity: 1 });
    expect(current.groundItems).toHaveLength(0);
  });
  it("does not let another material deposit use the gathering reservation", async () => {
    const f = await fixture();
    await db.insert(farmInventory).values({ farmId: f.farm.id, itemKey: "reed", quantity: 5 });
    await db.update(farms).set({ carriedItemKey: "reed", carriedItemQuantity: 1, production: { ...emptyProductionState(), materialReservation: "reed" } }).where(eq(farms.id, f.farm.id));
    expect(await Effect.runPromise(Effect.flip(depositCarriedItem(db, { playerId: f.farm.playerId, expectedFarmVersion: 1 })))).toMatchObject({ rule: { type: "farm_storage_full" } });
    const snapshot = await f.refresh();
    expect(snapshot.inventory.find(i => i.itemKey === "reed")?.quantity).toBe(5);
    expect(snapshot.farm.production.materialReservation).toBe("reed");
  });
  it("preserves old over-cap inventory and offers no new market capacity", async () => {
    const f = await fixture();
    await db.insert(farmInventory).values({ farmId: f.farm.id, itemKey: "bread", quantity: 27 });
    expect((await f.refresh()).inventory.find(i => i.itemKey === "bread")?.quantity).toBe(27);
    await db.transaction(async tx => {
      const storage = await loadMarketItemStorage(tx, f.farm.id, "bread", new Date());
      expect(storage.storedQuantity).toBe(27);
      expect(storage.availableCapacity).toBe(0);
    });
  });
  it("builds from stored materials, rejects roadless placement and a second warehouse", async () => {
    const f = await fixture();
    await db.insert(farmInventory).values([{ farmId: f.farm.id, itemKey: "reed", quantity: 6 }, { farmId: f.farm.id, itemKey: "clay", quantity: 6 }]);
    const input = { playerId: f.farm.playerId, building: "warehouse" as const, target: { column: 5, row: 3 }, expectedFarmVersion: 1 };
    expect(await Effect.runPromise(Effect.flip(buildFarmBuilding(db, { ...input, target: { column: 5, row: 0 } })))).toMatchObject({ rule: { type: "road_access_required" } });
    const built = await Effect.runPromise(buildFarmBuilding(db, input));
    expect(built.buildings[0]).toMatchObject({ type: "warehouse", column: 5, row: 3 });
    expect(built.inventory.find(i => i.itemKey === "reed")?.quantity).toBe(2);
    expect(built.inventory.find(i => i.itemKey === "clay")?.quantity ?? 0).toBe(0);
    const warehouse = built.buildings[0]!;
    expect(Date.parse(warehouse.completesAt) - Date.parse(warehouse.startedAt)).toBe(180000);
    expect(warehouse.loadingTile).toEqual({ column: 5, row: 5 });
    const reloaded = await f.refresh();
    expect(reloaded.buildings[0]!.completesAt).toBe(warehouse.completesAt);
    expect(await Effect.runPromise(Effect.flip(buildFarmBuilding(db, input)))).toMatchObject({ rule: { type: "version_conflict" } });
    expect(await Effect.runPromise(Effect.flip(buildFarmBuilding(db, { ...input, expectedFarmVersion: built.farm.version })))).toMatchObject({ rule: { type: "building_limit" } });
    await db.update(farmBuildings).set({ startedAt: new Date(Date.now() - 181000), completesAt: new Date(Date.now() - 1000) })
      .where(eq(farmBuildings.id, warehouse.id));
    const returned = await f.refresh();
    expect(Date.parse(returned.buildings[0]!.completesAt)).toBeLessThan(Date.now());
    expect(returned.buildings).toHaveLength(1);
    expect(returned.inventory.find(i => i.itemKey === "reed")?.quantity).toBe(2);
    expect(returned.inventory.find(i => i.itemKey === "clay")?.quantity ?? 0).toBe(0);
  });
  it("migrates a legacy second granary without losing stock and exposes new market capacity", async () => {
    const f = await fixture();
    const buildings = await db.insert(farmBuildings).values([0, 5].map((column, index) => ({ farmId: f.farm.id, type: "granary" as const, column, row: 3, storedBarley: 17 + index, startedAt: new Date(index), completesAt: new Date(2 + index) }))).returning();
    const snapshot = await f.refresh();
    expect(snapshot.buildings.find(b => b.id === buildings[1]!.id)).toMatchObject({ type: "warehouse", storedBarley: 18, column: 5 });
    expect((await f.refresh()).buildings.filter(b => b.type === "warehouse")).toHaveLength(1);
    await db.transaction(async tx => {
      expect((await loadMarketItemStorage(tx, f.farm.id, "barley", new Date())).totalCapacity).toBe(45);
      expect((await loadMarketItemStorage(tx, f.farm.id, "bread", new Date())).totalCapacity).toBe(20);
    });
  });
  it("stores materials independently of barley and retains carried goods when full", async () => {
    const f = await fixture();
    await db.insert(farmInventory).values([{ farmId: f.farm.id, itemKey: "barley", quantity: 5 }, { farmId: f.farm.id, itemKey: "clay", quantity: 5 }]);
    await db.update(farms).set({ carriedItemKey: "clay", carriedItemQuantity: 1, production: { ...emptyProductionState(), materialDelivery: true } }).where(eq(farms.id, f.farm.id));
    const result = await Effect.runPromise(depositCarriedItem(db, { playerId: f.farm.playerId, expectedFarmVersion: 1 }));
    expect(result.inventory.find(i => i.itemKey === "clay")?.quantity).toBe(6);
    expect(result.farm.carriedItem).toBeNull();
    expect(result.farm.production.materialDelivery).toBe(false);
    await db.update(farms).set({ carriedItemKey: "clay", carriedItemQuantity: 1 }).where(eq(farms.id, f.farm.id));
    expect(await Effect.runPromise(Effect.flip(depositCarriedItem(db, { playerId: f.farm.playerId, expectedFarmVersion: result.farm.version })))).toMatchObject({ rule: { type: "farm_storage_full" } });
    expect((await f.refresh()).farm.carriedItem?.quantity).toBe(1);
  });
  it("leaves the whole bread pile at the oven when estate space is insufficient", async () => {
    const f = await fixture(); const buildingId = randomUUID();
    await db.insert(farmInventory).values({ farmId: f.farm.id, itemKey: "bread", quantity: 9 });
    await db.update(farms).set({ production: { ...emptyProductionState(), pending: { [buildingId]: { itemKey: "bread", quantity: 4 } } } }).where(eq(farms.id, f.farm.id));
    const input = { type: "production_delivery" as const, playerId: f.farm.playerId, buildingId, expectedFarmVersion: 1 };
    expect(await Effect.runPromise(Effect.flip(productionAction(db, { ...input, action: "pickup" })))).toMatchObject({ message: expect.stringContaining("whole pile") });
    const unchanged = await f.refresh();
    expect(unchanged.farm.production.delivery).toBeNull();
    expect(unchanged.farm.production.pending[buildingId]?.quantity).toBe(4);
    expect(unchanged.inventory.find(i => i.itemKey === "bread")?.quantity).toBe(9);
  });
  it("keeps flour and groats limits separate during collection", async () => {
    const f = await fixture(); const millId = randomUUID();
    await db.insert(farmInventory).values([{ farmId: f.farm.id, itemKey: "flour", quantity: 10 }, { farmId: f.farm.id, itemKey: "brewersGroats", quantity: 8 }]);
    await db.update(farms).set({ millGoods: { pending: { [millId]: { flour: 3, brewersGroats: 3 } }, delivery: null } }).where(eq(farms.id, f.farm.id));
    expect(await Effect.runPromise(Effect.flip(deliverMillGoods(db, { type: "mill_delivery", action: "pickup", playerId: f.farm.playerId, millId, expectedFarmVersion: 1 })))).toMatchObject({ message: expect.stringContaining("whole pile") });
    expect((await f.refresh()).farm.millGoods.pending[millId]).toEqual({ flour: 3, brewersGroats: 3 });
  });
});
