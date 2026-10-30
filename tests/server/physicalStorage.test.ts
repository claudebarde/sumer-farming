import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import { createDatabase } from "../../src/server/db/client";
import { farmBuildings, farmInventory, farms, players } from "../../src/server/db/schema";
import { readFarmSnapshot } from "../../src/server/services/farmSnapshot";
import { setStoredQuantity } from "../../src/server/services/physicalStorage";
import { addToMarketItemStorage, loadMarketItemStorage, removeFromMarketItemStorage } from "../../src/server/services/marketItemStorage";
import { buildingDemolitionReason } from "../../src/game-core/farm/buildingDemolition";

const client = new Client({ connectionString: process.env.TEST_DATABASE_URL ?? "postgres://sumer:sumer_dev@localhost:5432/sumer_farming" });
const db = createDatabase(client), ids = new Set<string>();
beforeAll(() => client.connect());
afterEach(async () => { if (ids.size) await db.delete(players).where(inArray(players.id, [...ids])); ids.clear(); });
afterAll(() => client.end());
const fixture = async () => {
  const playerId = randomUUID(); ids.add(playerId);
  await db.insert(players).values({ id: playerId, displayName: "Physical storage test" });
  const [farm] = await db.insert(farms).values({ playerId, level: 8 }).returning();
  const [warehouse] = await db.insert(farmBuildings).values({ farmId: farm!.id, type: "warehouse", column: 5, row: 3, startedAt: new Date(0), completesAt: new Date(1) }).returning();
  const refresh = () => db.transaction(async tx => {
    const [record] = await tx.select().from(farms).where(eq(farms.id, farm!.id)).for("update");
    return readFarmSnapshot(tx, record!, false);
  });
  return { farm: farm!, warehouse: warehouse!, refresh };
};
it("preserves farm stock on migration and persists new warehouse deliveries across reloads", async () => {
  const f = await fixture();
  await db.insert(farmInventory).values({ farmId: f.farm.id, itemKey: "beer", quantity: 8 });
  const first = await f.refresh();
  expect(first.inventory.find(i => i.itemKey === "beer")?.locations).toEqual({ farm: 8, [f.warehouse.id]: 0 });
  await db.transaction(async tx => {
    await tx.select().from(farms).where(eq(farms.id, f.farm.id)).for("update");
    await setStoredQuantity(tx, f.farm.id, "beer", 11, new Date(), f.warehouse.id);
  });
  for (let i = 0; i < 2; i++) {
    const reloaded = await f.refresh();
    expect(reloaded.inventory.find(i => i.itemKey === "beer")).toMatchObject({ quantity: 11, locations: { farm: 8, [f.warehouse.id]: 3 } });
    expect(buildingDemolitionReason(reloaded, f.warehouse.id, Date.now())).toContain("stored in this warehouse");
  }
});
it("market spending and purchases update actual locations and the combined total together", async () => {
  const f = await fixture();
  await db.insert(farmInventory).values({ farmId: f.farm.id, itemKey: "bread", quantity: 8, locations: { farm: 3, [f.warehouse.id]: 5 } });
  await db.transaction(async tx => {
    await tx.select().from(farms).where(eq(farms.id, f.farm.id)).for("update");
    const storage = await loadMarketItemStorage(tx, f.farm.id, "bread", new Date());
    await removeFromMarketItemStorage(tx, storage, 4, new Date());
    const after = await loadMarketItemStorage(tx, f.farm.id, "bread", new Date());
    await addToMarketItemStorage(tx, after, 2, new Date());
  });
  expect((await f.refresh()).inventory.find(i => i.itemKey === "bread")).toMatchObject({ quantity: 6, locations: { farm: 0, [f.warehouse.id]: 6 } });
});
it("rejects a full destination atomically instead of silently moving goods elsewhere", async () => {
  const f = await fixture();
  await db.insert(farmInventory).values({ farmId: f.farm.id, itemKey: "clay", quantity: 10, locations: { farm: 0, [f.warehouse.id]: 10 } });
  await expect(db.transaction(tx => setStoredQuantity(tx, f.farm.id, "clay", 11, new Date(), f.warehouse.id))).rejects.toThrow("Not enough space");
  expect((await f.refresh()).inventory.find(i => i.itemKey === "clay")?.quantity).toBe(10);
});
it("keeps porter destination slots reserved during purchases, then settles the saved destination once", async () => {
  const f = await fixture();
  const now = Date.now();
  await db.insert(farmInventory).values({ farmId: f.farm.id, itemKey: "beer", quantity: 9, locations: { farm: 0, [f.warehouse.id]: 9 } });
  const porter = { hiredAt: now, expiresAt: now + 100000, checkedAt: now, position: { column: 5, row: 5 },
    job: { buildingId: randomUUID(), itemKey: "beer" as const, quantity: 1, storageId: f.warehouse.id,
      startedAt: now, pickupAt: now, completesAt: now + 50000, path: [{ column: 5, row: 5 }], pickupIndex: 0 } };
  await db.update(farms).set({ production: { ...f.farm.production, porter } }).where(eq(farms.id, f.farm.id));
  await db.transaction(tx => setStoredQuantity(tx, f.farm.id, "beer", 10, new Date()));
  expect((await f.refresh()).inventory.find(i => i.itemKey === "beer")?.locations).toEqual({ farm: 1, [f.warehouse.id]: 9 });
  await db.update(farms).set({ production: { ...f.farm.production, porter: { ...porter, job: { ...porter.job, completesAt: now - 1 } } } }).where(eq(farms.id, f.farm.id));
  for (let i = 0; i < 2; i++) expect((await f.refresh()).inventory.find(i => i.itemKey === "beer"))
    .toMatchObject({ quantity: 11, locations: { farm: 1, [f.warehouse.id]: 10 } });
});

it("persists sesame in the warehouse, rejects overflow atomically and permits zero stock", async () => {
  const f = await fixture();
  const save = (quantity: number, destination?: string) => db.transaction(async tx => {
    await tx.select().from(farms).where(eq(farms.id, f.farm.id)).for("update");
    await setStoredQuantity(tx, f.farm.id, "sesame", quantity, new Date(), destination);
  });
  await save(12);
  expect((await f.refresh()).inventory.find(i => i.itemKey === "sesame")).toMatchObject({ quantity: 12, locations: { [f.warehouse.id]: 12 } });
  await expect(save(13)).rejects.toThrow("Not enough space");
  expect((await f.refresh()).inventory.find(i => i.itemKey === "sesame")?.quantity).toBe(12);
  expect(buildingDemolitionReason(await f.refresh(), f.warehouse.id, Date.now())).toContain("stored in this warehouse");
  await save(0);
  expect((await f.refresh()).inventory.find(i => i.itemKey === "sesame")?.quantity).toBe(0);
  await expect(save(1, "farm")).rejects.toThrow("completed warehouse");
});
