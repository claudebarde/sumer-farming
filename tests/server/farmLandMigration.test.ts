import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import { createDatabase } from "../../src/server/db/client";
import { farmBuildings, farmGroundItems, farmObjects, farms, players } from "../../src/server/db/schema";
import { migrateFarmLand } from "../../src/server/services/farmLandMigration";
import { readFarmSnapshot } from "../../src/server/services/farmSnapshot";
import { isArableGround } from "../../src/game-core/farm/land";

const client = new Client({ connectionString: process.env.TEST_DATABASE_URL ?? "postgres://sumer:sumer_dev@localhost:5432/sumer_farming" });
const db = createDatabase(client), ids: string[] = [];
beforeAll(() => client.connect());
afterEach(async () => { if (ids.length) await db.delete(players).where(inArray(players.id, ids)); ids.length = 0; });
afterAll(() => client.end());

it("migrates saved scenery once on snapshot, preserving buildings, goods and active reed gathering", async () => {
  const playerId = randomUUID(); ids.push(playerId);
  await db.insert(players).values({ id: playerId, displayName: "Land migration test" });
  const now = new Date();
  const [farm] = await db.insert(farms).values({ playerId, level: 4,
    gatheringItemKey: "reed", gatheringColumn: 7, gatheringRow: 9,
    gatheringStartedAt: now, gatheringCompletesAt: new Date(now.getTime() + 60000),
    roads: [{ column: 8, row: 9 }]
  }).returning();
  const farmId = farm!.id;
  const objects = await db.insert(farmObjects).values([
    { farmId, type: "reeds", column: 7, row: 9 },
    { farmId, type: "rock", column: 0, row: 9 },
    { farmId, type: "bush", column: 6, row: 9 },
    { farmId, type: "reeds", column: -3, row: 9 }
  ]).returning();
  const buildings = await db.insert(farmBuildings).values({ farmId, type: "granary", column: 5, row: 3,
    storedBarley: 12, loadingTile: { column: 5, row: 5 }, startedAt: new Date(0), completesAt: new Date(1) }).returning();
  const goods = await db.insert(farmGroundItems).values({ farmId, itemKey: "barley", quantity: 1, column: 9, row: 9,
    expiresAt: new Date(now.getTime() + 86400000) }).returning();
  const refresh = () => db.transaction(async tx => {
    const [record] = await tx.select().from(farms).where(eq(farms.id, farmId)).for("update");
    return readFarmSnapshot(tx, record!, false);
  });
  const first = await refresh();
  expect(first.objects.map(o => o.id).sort()).toEqual(objects.map(o => o.id).sort());
  expect(first.objects.every(o => !isArableGround(o))).toBe(true);
  expect(first.objects.some(o => (o.column === 8 || o.column === 9) && o.row === 9)).toBe(false);
  const movedReed = first.objects.find(o => o.id === objects[0]!.id)!;
  expect(movedReed.row).toBe(9);
  const [saved] = await db.select().from(farms).where(eq(farms.id, farmId));
  expect(saved).toMatchObject({ gatheringColumn: movedReed.column, gatheringRow: movedReed.row,
    gatheringStartedAt: now, gatheringCompletesAt: farm!.gatheringCompletesAt, version: farm!.version + 1 });
  expect(await db.select().from(farmBuildings).where(eq(farmBuildings.farmId, farmId))).toEqual(buildings);
  expect(await db.select().from(farmGroundItems).where(eq(farmGroundItems.farmId, farmId))).toEqual(goods);
  const second = await refresh();
  expect(second.objects).toEqual(first.objects);
  expect(second.farm.version).toBe(first.farm.version);
  // The migration itself also does nothing when invoked again during another command.
  const unchanged = await db.transaction(tx => migrateFarmLand(tx, saved!, now));
  expect(unchanged.version).toBe(saved!.version);
});
