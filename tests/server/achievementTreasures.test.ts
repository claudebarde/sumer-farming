import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import { createDatabase } from "../../src/server/db/client";
import { farms, players, pointAwards, shekelTransactions } from "../../src/server/db/schema";
import { settleAchievementTreasures } from "../../src/server/services/achievementTreasures";
import { saveHomeFurniture, saveHomeAppearance } from "../../src/server/services/homeAppearance";
import { earnedAchievements } from "../../src/game-data/achievementTreasures";

const client = new Client({ connectionString: process.env.TEST_DATABASE_URL ?? "postgres://sumer:sumer_dev@localhost:5432/sumer_farming" });
const db = createDatabase(client), ids: string[] = [];
beforeAll(() => client.connect());
afterEach(async () => { if (ids.length) await db.delete(players).where(inArray(players.id, ids)); ids.length = 0; });
afterAll(() => client.end());
const setup = async () => {
  const playerId = randomUUID(); ids.push(playerId);
  await db.insert(players).values({ id: playerId, displayName: "Achievement test" });
  const [farm] = await db.insert(farms).values({ playerId, level: 11 }).returning();
  return farm!;
};
const settle = (id: string) => db.transaction(async tx => {
  const [farm] = await tx.select().from(farms).where(eq(farms.id, id)).for("update");
  return settleAchievementTreasures(tx, farm!);
});

it("requires every threshold and counts units independently from points", () => {
  const history = { beer: 499, beerRequests: 24, harvests: 499, meals: 49, requests: 49, points: 24999 };
  expect(earnedAchievements(history)).toEqual([]);
  expect(earnedAchievements({ ...history, meals: 50 })).toEqual(["painted-large-jar"]);
  expect(earnedAchievements({ ...history, points: 25000 })).toEqual(["fine-household-pottery-set"]);
  expect(earnedAchievements({ ...history, beer: 500, beerRequests: 25 })).toEqual(["golden-drinking-cup"]);
});

it("uses recorded history, upgrades the placed jar once, and keeps unlocks permanent", async () => {
  const farm = await setup();
  await db.update(farms).set({
    progressionStats: { ...farm.progressionStats, beerProduced: 500, beerRequestsFulfilled: 25, harvests: 450 },
    homeAppearance: { ...farm.homeAppearance, furnitureRevision: 3, furniture: [{ key: "plain-jar", x: 850, y: 700 }] },
  }).where(eq(farms.id, farm.id));
  await db.insert(pointAwards).values([
    ...Array.from({ length: 100 }, (_, i) => ({ playerId: farm.playerId, source: `meal:${i}`, action: "cookMeal", points: 30, ruleVersion: 1, completedAt: new Date() })),
    ...Array.from({ length: 50 }, (_, i) => ({ playerId: farm.playerId, source: `sesame:${i}`, action: "harvestSesame", points: 20, ruleVersion: 1, completedAt: new Date() })),
    { playerId: farm.playerId, source: "other", action: "farmLevel", points: 21000, ruleVersion: 1, completedAt: new Date() },
  ]);
  await db.insert(shekelTransactions).values(Array.from({ length: 50 }, () => ({ playerId: farm.playerId, idempotencyKey: randomUUID(), type: "request_reward" as const, requestCustomer: "Test", delta: 1, balanceAfter: 1 })));
  const unlocked = await settle(farm.id);
  expect(unlocked.progressionStats.achievementTreasures).toHaveLength(4);
  expect(unlocked.homeAppearance.furniture).toEqual([{ key: "painted-large-jar", x: 850, y: 700 }]);
  expect(unlocked.homeAppearance.furnitureRevision).toBe(4);
  await db.delete(pointAwards).where(eq(pointAwards.playerId, farm.playerId));
  const again = await settle(farm.id);
  expect(again.progressionStats.achievementTreasures).toEqual(unlocked.progressionStats.achievementTreasures);
  expect(again.homeAppearance.furnitureRevision).toBe(4);
  expect((await saveHomeFurniture(db, farm.playerId, { revision: 4, items: [{ key: "plain-jar", x: 850, y: 700 }] })).ok).toBe(false);
  expect((await saveHomeFurniture(db, farm.playerId, { revision: 4, items: [{ key: "patterned-reed-chest", x: 850, y: 700 }] })).ok).toBe(true);
  await saveHomeAppearance(db, farm.playerId, { style: "farm-style-clay", decoration: "none" });
  expect((await settle(farm.id)).progressionStats.achievementTreasures).toHaveLength(4);
});

it("rejects unearned items and does not invent history", async () => {
  const farm = await setup();
  const initial = await settle(farm.id);
  expect(initial.progressionStats.achievementTreasures ?? []).toEqual([]);
  for (const key of ["golden-drinking-cup", "patterned-reed-chest", "fine-household-pottery-set", "painted-large-jar"]) {
    expect((await saveHomeFurniture(db, farm.playerId, { revision: 0, items: [{ key, x: 850, y: 700 }] })).ok).toBe(false);
  }
  const [saved] = await db.select().from(farms).where(eq(farms.id, farm.id));
  expect(saved?.homeAppearance.furniture).toBeUndefined();
});
