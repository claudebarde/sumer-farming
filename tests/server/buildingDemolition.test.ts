import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { Effect } from "effect";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import { createDatabase } from "../../src/server/db/client";
import { farmBuildings, farmInventory, farms, players } from "../../src/server/db/schema";
import { destroyBuilding } from "../../src/server/services/destroyBuilding";
import { buildFarmBuilding } from "../../src/server/services/buildFarmBuilding";
import type { FarmBuildingType } from "../../src/game-data/buildings";

const client = new Client({ connectionString: process.env.TEST_DATABASE_URL ?? "postgres://sumer:sumer_dev@localhost:5432/sumer_farming" });
const db = createDatabase(client), ids: string[] = [];
beforeAll(() => client.connect());
afterEach(async () => { if (ids.length) await db.delete(players).where(inArray(players.id, ids)); ids.length = 0; });
afterAll(() => client.end());
const fixture = async (type: FarmBuildingType = "granary", storedBarley = 0) => {
  const playerId = randomUUID(); ids.push(playerId);
  await db.insert(players).values({ id: playerId, displayName: "Demolition test", shekelBalance: 100 });
  const [farm] = await db.insert(farms).values({ playerId, level: 3 }).returning();
  const [building] = await db.insert(farmBuildings).values({ farmId: farm!.id, type, storedBarley,
    column: 5, row: 3, loadingTile: { column: 5, row: 5 }, startedAt: new Date(0), completesAt: new Date(1) }).returning();
  return { farm: farm!, building: building!, input: { type: "destroy_building" as const, playerId, buildingId: building!.id, expectedFarmVersion: 1 } };
};

it("rebuilds a demolished granary, consuming materials and persisting its construction deadline", async () => {
  const f = await fixture();
  const demolished = await Effect.runPromise(destroyBuilding(db, f.input));
  await db.insert(farmInventory).values([
    { farmId: f.farm.id, itemKey: "reed", quantity: 2 },
    { farmId: f.farm.id, itemKey: "clay", quantity: 3 }
  ]);
  const result = await Effect.runPromise(buildFarmBuilding(db, { building: "granary", playerId: f.input.playerId,
    target: { column: 4, row: 3 }, expectedFarmVersion: demolished.farm.version }));
  expect(result.buildings).toHaveLength(1);
  const building = result.buildings[0]!;
  expect(building.loadingTile).toEqual({ column: 4, row: 5 });
  expect(Date.parse(building.completesAt) - Date.parse(building.startedAt)).toBe(120000);
  expect(result.inventory.filter(i => i.itemKey === "reed" || i.itemKey === "clay").every(i => i.quantity === 0)).toBe(true);
  const [saved] = await db.select().from(farmBuildings).where(eq(farmBuildings.id, building.id));
  expect(saved!.completesAt.toISOString()).toBe(building.completesAt);
});

it.each(["granary", "mill", "brewery", "breadOven", "warehouse", "smallShrine"] as const)("removes an empty idle %s, its loading reservation and no materials are refunded", async type => {
  const f = await fixture(type);
  const result = await Effect.runPromise(destroyBuilding(db, f.input));
  expect(result.buildings).toHaveLength(0);
  expect(result.inventory).toHaveLength(0);
  expect(result.player.shekelBalance).toBe(100);
  expect(result.farm.version).toBeGreaterThan(1);
  expect(await db.select().from(farmBuildings).where(eq(farmBuildings.id, f.building.id))).toHaveLength(0);
  await expect(Effect.runPromise(destroyBuilding(db, f.input))).rejects.toThrow("farm changed");
});

it("rejects nonempty granaries and foreign buildings and the starting farm", async () => {
  const f = await fixture("granary", 4), other = await fixture();
  await expect(Effect.runPromise(destroyBuilding(db, f.input))).rejects.toThrow("Empty");
  await expect(Effect.runPromise(destroyBuilding(db, { ...f.input, buildingId: other.building.id }))).rejects.toThrow("cannot be destroyed");
  await expect(Effect.runPromise(destroyBuilding(db, { ...f.input, buildingId: f.farm.id }))).rejects.toThrow("cannot be destroyed");
  expect((await db.select().from(farmBuildings).where(eq(farmBuildings.id, f.building.id)))[0]?.storedBarley).toBe(4);
});

it("protects warehouse dates and inventory above the remaining capacity", async () => {
  const f = await fixture("warehouse");
  await db.insert(farmInventory).values({ farmId: f.farm.id, itemKey: "dates", quantity: 1 });
  await expect(Effect.runPromise(destroyBuilding(db, f.input))).rejects.toThrow("stored in this warehouse");
  await db.update(farmInventory).set({ itemKey: "flour", quantity: 11, locations: null }).where(eq(farmInventory.farmId, f.farm.id));
  await expect(Effect.runPromise(destroyBuilding(db, f.input))).rejects.toThrow("stored in this warehouse");
  await db.update(farmInventory).set({ quantity: 10, locations: { farm: 10 } }).where(eq(farmInventory.farmId, f.farm.id));
  const result = await Effect.runPromise(destroyBuilding(db, f.input));
  expect(result.inventory.find(i => i.itemKey === "flour")?.quantity).toBe(10);
});

it("blocks active work and pending goods, then removes the shrine blessing on demolition", async () => {
  const f = await fixture("smallShrine");
  await db.update(farms).set({ production: { pending: { [f.building.id]: { itemKey: "bread", quantity: 2 } }, delivery: null, baking: {} } }).where(eq(farms.id, f.farm.id));
  await expect(Effect.runPromise(destroyBuilding(db, f.input))).rejects.toThrow("collect the goods");
  await db.update(farms).set({ production: { pending: {}, delivery: null, baking: {}, shrineBlessing: {
    buildingId: f.building.id, startedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 60000).toISOString()
  } } }).where(eq(farms.id, f.farm.id));
  const result = await Effect.runPromise(destroyBuilding(db, f.input));
  expect(result.farm.production.shrineBlessing).toBeNull();
});

it("rejects a stale version without removing the building", async () => {
  const f = await fixture();
  await expect(Effect.runPromise(destroyBuilding(db, { ...f.input, expectedFarmVersion: 99 }))).rejects.toThrow("farm changed");
  expect(await db.select().from(farmBuildings).where(eq(farmBuildings.id, f.building.id))).toHaveLength(1);
});
