import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { Effect } from "effect";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import { createDatabase } from "../../src/server/db/client";
import { farmBuildings, farmInventory, farms, players, shekelTransactions } from "../../src/server/db/schema";
import { buildFarmBuilding } from "../../src/server/services/buildFarmBuilding";
import { readFarmSnapshot } from "../../src/server/services/farmSnapshot";

const client = new Client({ connectionString: process.env.TEST_DATABASE_URL ?? "postgres://sumer:sumer_dev@localhost:5432/sumer_farming" });
const db = createDatabase(client);
const ids: string[] = [];
beforeAll(() => client.connect());
afterEach(async () => { if (ids.length) await db.delete(players).where(inArray(players.id, ids)); ids.length = 0; });
afterAll(() => client.end());
const fixture = async (level = 12, shekelBalance = 60, clay = 6) => {
  const playerId = randomUUID(); ids.push(playerId);
  await db.insert(players).values({ id: playerId, displayName: "Pen test", pointsStartedAt: new Date(0), shekelBalance });
  const [farm] = await db.insert(farms).values({ playerId, level }).returning();
  await db.insert(farmInventory).values({ farmId: farm!.id, itemKey: "clay", quantity: clay });
  const input = { playerId, building: "sheepPen" as const, target: { column: 5, row: 3 }, expectedFarmVersion: 1 };
  const refresh = () => db.transaction(async tx => {
    const [saved] = await tx.select().from(farms).where(eq(farms.id, farm!.id)).for("update");
    return readFarmSnapshot(tx, saved!, false);
  });
  return { farm: farm!, input, refresh };
};
it.each([[11, 60, 6, "level_required"], [12, 59, 6, "insufficient_shekels"], [12, 60, 5, "missing_material"]] as const)(
  "rejects invalid level/cost %s/%s/%s without spending", async (level, money, clay, reason) => {
    const f = await fixture(level, money, clay);
    expect(await Effect.runPromise(Effect.flip(buildFarmBuilding(db, f.input)))).toMatchObject({ rule: { type: reason } });
    const snapshot = await f.refresh();
    expect(snapshot.player.shekelBalance).toBe(money);
    expect(snapshot.inventory.find(i => i.itemKey === "clay")?.quantity).toBe(clay);
    expect(snapshot.buildings).toHaveLength(0);
  });
it("persists a three-minute pen and spends once, with offline completion and a one-pen limit", async () => {
  const f = await fixture();
  const built = await Effect.runPromise(buildFarmBuilding(db, f.input));
  const pen = built.buildings[0]!;
  expect(pen.type).toBe("sheepPen");
  expect(pen.loadingTile?.row).toBe(5);
  expect(Date.parse(pen.completesAt) - Date.parse(pen.startedAt)).toBe(180000);
  expect(built.player.shekelBalance).toBe(0);
  expect(built.inventory.find(i => i.itemKey === "clay")?.quantity ?? 0).toBe(0);
  expect((await f.refresh()).buildings).toEqual(built.buildings);
  expect(await Effect.runPromise(Effect.flip(buildFarmBuilding(db, f.input)))).toMatchObject({ rule: { type: "version_conflict" } });
  await db.update(farmBuildings).set({ startedAt: new Date(Date.now() - 181000), completesAt: new Date(Date.now() - 1000) }).where(eq(farmBuildings.id, pen.id));
  const completed = await f.refresh();
  expect(completed.player.points).toBe(50);
  expect((await f.refresh()).player.points).toBe(50);
  expect(await Effect.runPromise(Effect.flip(buildFarmBuilding(db, { ...f.input, expectedFarmVersion: completed.farm.version, target: { column: 7, row: 3 } })))).toMatchObject({ rule: { type: "building_limit" } });
  expect(await db.select().from(shekelTransactions).where(eq(shekelTransactions.playerId, f.input.playerId))).toHaveLength(1);
});
