import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import { createDatabase } from "../../src/server/db/client";
import { farms, players, pointAwards, shekelTransactions } from "../../src/server/db/schema";
import { recordAttendanceActivity, settleAttendance } from "../../src/server/services/attendance";
import { utcDay } from "../../src/game-data/attendance";
import { saveHomeFurniture } from "../../src/server/services/homeAppearance";
const client = new Client({ connectionString: process.env.TEST_DATABASE_URL ?? "postgres://sumer:sumer_dev@localhost:5432/sumer_farming" });
const db = createDatabase(client), ids: string[] = [];
beforeAll(() => client.connect());
afterEach(async () => { if (ids.length) await db.delete(players).where(inArray(players.id, ids)); ids.length = 0; });
afterAll(() => client.end());
const setup = async () => {
  const playerId = randomUUID(); ids.push(playerId);
  await db.insert(players).values({ id: playerId, displayName: "Attendance test" });
  const [farm] = await db.insert(farms).values({ playerId, level: 11 }).returning();
  return farm!;
};
const settle = (id: string, now: Date, trade = false) => db.transaction(async tx => {
  const [farm] = await tx.select().from(farms).where(eq(farms.id, id)).for("update");
  return settleAttendance(tx, farm!, now, trade);
});
it("requires active completed work, counts once, and unlocks without touching permanent rewards", async () => {
  const farm = await setup(), now = new Date(), today = utcDay(+now);
  await db.update(farms).set({ progressionStats: { ...farm.progressionStats,
    achievementTreasures: ["golden-drinking-cup"], attendance: { lastDay: today - 1, streak: 4, unlocked: false, activeUntil: +now + 1000 } } }).where(eq(farms.id, farm.id));
  expect((await settle(farm.id, now)).progressionStats.attendance?.unlocked).toBe(false);
  await db.insert(pointAwards).values({ playerId: farm.playerId, source: "harvest:test", action: "harvestBarley", points: 10, ruleVersion: 1, completedAt: now });
  const earned = await settle(farm.id, now);
  expect(earned.progressionStats.attendance).toMatchObject({ streak: 5, unlocked: true });
  expect((await settle(farm.id, now)).version).toBe(earned.version);
  expect(earned.progressionStats.achievementTreasures).toEqual(["golden-drinking-cup"]);
});
it("does not count offline work or idle polling; expires and removes only the myrtle", async () => {
  const farm = await setup(), now = new Date();
  await db.update(farms).set({ progressionStats: { ...farm.progressionStats,
    attendance: { lastDay: utcDay(+now) - 3, streak: 5, unlocked: true, activeUntil: +now - 600000 } },
    homeAppearance: { ...farm.homeAppearance, furnitureRevision: 2, furniture: [{ key: "potted-myrtle", x: 850, y: 700 }, { key: "clay-bowl", x: 700, y: 850 }] } }).where(eq(farms.id, farm.id));
  await db.insert(pointAwards).values({ playerId: farm.playerId, source: "offline", action: "bakeBread", points: 40, ruleVersion: 1, completedAt: now });
  const expired = await settle(farm.id, now);
  expect(expired.progressionStats.attendance).toMatchObject({ streak: 0, unlocked: false });
  expect(expired.homeAppearance.furniture?.map(item => item.key)).toEqual(["clay-bowl"]);
  expect(expired.homeAppearance.furnitureRevision).toBe(3);
  expect((await settle(farm.id, now)).homeAppearance.furnitureRevision).toBe(3);
  expect((await saveHomeFurniture(db, farm.playerId, { revision: 3, items: [{ key: "potted-myrtle", x: 850, y: 700 }] })).ok).toBe(false);
});
it("counts active trading only with a real recent ledger entry", async () => {
  const farm = await setup(), now = new Date();
  await db.update(farms).set({ progressionStats: { ...farm.progressionStats, attendance: { streak: 0, unlocked: false, activeUntil: +now + 1000 } } }).where(eq(farms.id, farm.id));
  expect((await settle(farm.id, now, true)).progressionStats.attendance?.streak).toBe(0);
  await db.insert(shekelTransactions).values({ playerId: farm.playerId, idempotencyKey: randomUUID(), type: "market_purchase", delta: -1, balanceAfter: 10, itemKey: "barley", itemQuantity: 1, unitPrice: 1, createdAt: now });
  expect((await settle(farm.id, now, true)).progressionStats.attendance?.streak).toBe(1);
});

it("returns the updated attendance and version immediately after a successful action", async () => {
  const farm = await setup(), started = new Date(Date.now() - 1000);
  await db.insert(pointAwards).values({ playerId: farm.playerId, source: "fresh-work", action: "harvestBarley", points: 10, ruleVersion: 1, completedAt: new Date(Math.max(utcDay(Date.now()) * 86400000, Date.now() - 600000)) });
  const snapshot = await recordAttendanceActivity(db, farm.playerId, "complete_harvest_crop", started);
  expect(snapshot?.farm.progression?.stats.attendance).toMatchObject({ streak: 1, unlocked: false });
  const [saved] = await db.select().from(farms).where(eq(farms.id, farm.id));
  expect(snapshot?.farm.version).toBe(saved?.version);
  const other = await setup();
  expect((await settle(other.id, new Date())).progressionStats.attendance).toBeUndefined();
});
