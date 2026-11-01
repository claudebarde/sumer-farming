import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { Effect } from "effect";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import { createDatabase } from "../../src/server/db/client";
import { farmBuildings, farmInventory, farms, players } from "../../src/server/db/schema";
import { startMilling } from "../../src/server/services/milling";
import { supplyBrewery } from "../../src/server/services/brewerySupplies";
import { advanceFarmLifecycle } from "../../src/server/services/farmLifecycle";
import { readFarmSnapshot } from "../../src/server/services/farmSnapshot";
import { productionAction } from "../../src/server/services/production";
import { hirePorter } from "../../src/server/services/porter";
import { buildingDemolitionReason } from "../../src/game-core/farm/buildingDemolition";
import { commandUnlockLevel } from "../../src/game-core/farm/commandUnlock";
import { FARM_BUILDING_DEFINITIONS } from "../../src/game-data/buildings";

const client = new Client({ connectionString: process.env.TEST_DATABASE_URL ?? "postgres://sumer:sumer_dev@localhost:5432/sumer_farming" });
const db = createDatabase(client), ids: string[] = [];
beforeAll(() => client.connect());
afterEach(async () => { if (ids.length) await db.delete(players).where(inArray(players.id, ids)); ids.length = 0; });
afterAll(() => client.end());
const fixture = async (oil = 0, jars = 3, level = 10) => {
  const playerId = randomUUID(); ids.push(playerId);
  await db.insert(players).values({ id: playerId, displayName: "Oil mill test", shekelBalance: 100 });
  const [farm] = await db.insert(farms).values({ playerId, level }).returning();
  const [mill] = await db.insert(farmBuildings).values({ farmId: farm!.id, type: "oilMill", column: 5, row: 3, loadingTile: { column: 5, row: 5 }, emptyBeerJars: jars, startedAt: new Date(0), completesAt: new Date(1) }).returning();
  const [warehouse] = await db.insert(farmBuildings).values({ farmId: farm!.id, type: "warehouse", column: 2, row: 3, loadingTile: { column: 2, row: 5 }, startedAt: new Date(0), completesAt: new Date(1) }).returning();
  await db.insert(farmInventory).values([
    { farmId: farm!.id, itemKey: "sesame", quantity: 12, locations: { [warehouse!.id]: 12 } },
    { farmId: farm!.id, itemKey: "oil", quantity: oil, locations: { [warehouse!.id]: oil } },
    { farmId: farm!.id, itemKey: "emptyBeerJar", quantity: 6 },
    { farmId: farm!.id, itemKey: "donkey", quantity: 1 },
  ]);
  const read = () => db.transaction(async tx => {
    const [current] = await tx.select().from(farms).where(eq(farms.id, farm!.id)).for("update");
    return readFarmSnapshot(tx, current!, false);
  });
  const advance = (now: number) => db.transaction(async tx => {
    const [current] = await tx.select().from(farms).where(eq(farms.id, farm!.id)).for("update");
    return advanceFarmLifecycle(tx, current!, new Date(now));
  });
  const command = async (worker: "farmer" | "donkey" = "farmer") => ({ playerId, type: "start_milling" as const, recipe: "oil" as const, worker, target: mill!, expectedFarmVersion: (await read()).farm.version });
  return { playerId, farm: farm!, mill: mill!, warehouse: warehouse!, read, advance, command };
};

it("unlocks construction at 10 and matches the flour mill construction cost and duration", () => {
  expect(FARM_BUILDING_DEFINITIONS.oilMill).toEqual(FARM_BUILDING_DEFINITIONS.mill);
  expect(commandUnlockLevel({ type: "build_oil_mill", target: { column: 5, row: 3 }, expectedFarmVersion: 1 })).toBe(10);
});
it.each(["farmer", "donkey"] as const)("reserves %s ingredients immediately and finishes exactly once while offline", async worker => {
  const f = await fixture(), command = await f.command(worker);
  const started = await Effect.runPromise(startMilling(db, command));
  const amount = worker === "donkey" ? 3 : 1, job = started.farm.milling!;
  expect(started.inventory.find(i => i.itemKey === "sesame")?.quantity).toBe(12 - amount * 3);
  expect(started.buildings.find(b => b.id === f.mill.id)?.emptyBeerJars).toBe(3 - amount);
  expect(Date.parse(job.completesAt) - Date.parse(job.startedAt)).toBe(amount * 5 * 60_000);
  expect(job.preparation?.supplyStops?.some(s => s.buildingId === f.warehouse.id)).toBe(true);
  await expect(Effect.runPromise(startMilling(db, command))).rejects.toThrow();
  const completed = await f.advance(Date.parse(job.completesAt) + 1000);
  expect(completed.milling).toBeNull();
  expect(completed.production.pending[f.mill.id]).toEqual({ itemKey: "oil", quantity: amount });
  const again = await f.advance(Date.parse(job.completesAt) + 2000);
  expect(again.production.pending[f.mill.id]?.quantity).toBe(amount);
  expect(again.progressionStats.processedBarley).toBe(0);
  const snapshot = await f.read();
  expect(snapshot.inventory.find(i => i.itemKey === "sesame")?.quantity).toBe(12 - amount * 3);
});
it.each([[10,3,10,"No storage"], [0,0,10,"Stock empty"], [0,3,9,"level 10"]] as const)("rejects blocked production without spending supplies", async (oil, jars, level, message) => {
  const f = await fixture(oil,jars,level);
  await expect(Effect.runPromise(startMilling(db, await f.command()))).rejects.toThrow(message);
  expect((await f.read()).inventory.find(i => i.itemKey === "sesame")?.quantity).toBe(12);
});
it("stocks up to three jars manually and delivers finished oil to the warehouse", async () => {
  const f = await fixture(0,0);
  const supplied = await Effect.runPromise(supplyBrewery(db, { playerId: f.playerId, type: "brewery_supply", action: "stock_jars", target: f.mill, expectedFarmVersion: (await f.read()).farm.version }));
  expect(supplied.buildings.find(b => b.id === f.mill.id)?.emptyBeerJars).toBe(3);
  expect(supplied.inventory.find(i => i.itemKey === "emptyBeerJar")?.quantity).toBe(3);
  const started = await Effect.runPromise(startMilling(db, await f.command()));
  await f.advance(Date.parse(started.farm.milling!.completesAt) + 1);
  const pickup = await Effect.runPromise(productionAction(db, { type: "production_delivery", action: "pickup", playerId: f.playerId, buildingId: f.mill.id, expectedFarmVersion: (await f.read()).farm.version }));
  const stored = await Effect.runPromise(productionAction(db, { type: "production_delivery", action: "store", playerId: f.playerId, buildingId: f.mill.id, expectedFarmVersion: pickup.farm.version }));
  expect(stored.inventory.find(i => i.itemKey === "oil")).toMatchObject({ quantity: 1, locations: { [f.warehouse.id]: 1 } });
  expect(stored.farm.production.delivery).toBeNull();
});
it("porter stocks three jars without duplicating offline deliveries", async () => {
  const f = await fixture(0,0);
  const before = await f.read();
  const hired = await Effect.runPromise(hirePorter(db, { playerId: f.playerId, type: "hire_porter", idempotencyKey: randomUUID(), expectedFarmVersion: before.farm.version, marketRoad: { column: 10, row: 5 } }));
  expect(hired.farm.production.porter?.job).toMatchObject({ itemKey: "emptyBeerJar", quantity: 3, buildingId: f.mill.id });
  await f.advance(hired.farm.production.porter!.job!.completesAt + 1);
  expect((await f.read()).buildings.find(b => b.id === f.mill.id)?.emptyBeerJars).toBe(3);
  await f.advance(hired.farm.production.porter!.job!.completesAt + 2);
  const after = await f.read();
  expect(after.buildings.find(b => b.id === f.mill.id)?.emptyBeerJars).toBe(3);
  expect(after.inventory.find(i => i.itemKey === "emptyBeerJar")?.quantity).toBe(3);
});
it("protects the warehouse reservation during donkey work", async () => {
  const f = await fixture();
  const started = await Effect.runPromise(startMilling(db, await f.command("donkey")));
  expect(buildingDemolitionReason(started, f.warehouse.id, Date.parse(started.farm.milling!.startedAt) + 1)).not.toBeNull();
});
