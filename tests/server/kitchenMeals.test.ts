import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { Effect } from "effect";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import { createDatabase } from "../../src/server/db/client";
import { farms, players, farmBuildings, farmInventory, pointAwards } from "../../src/server/db/schema";
import { cookMeal } from "../../src/server/services/kitchen";
import { advanceFarmLifecycle } from "../../src/server/services/farmLifecycle";
import { COOKING_MS, MEALS, MEAL_KEYS, activeMeal, mealRationDeadline, type MealKey } from "../../src/game-data/kitchen";
import { assertFarmerAvailable } from "../../src/server/services/farmerAvailability";

const client = new Client({ connectionString: process.env.TEST_DATABASE_URL ?? "postgres://sumer:sumer_dev@localhost:5432/sumer_farming" });
const db = createDatabase(client), ids: string[] = [];
beforeAll(() => client.connect());
afterEach(async () => { if (ids.length) await db.delete(players).where(inArray(players.id, ids)); ids.length = 0; });
afterAll(() => client.end());
const setup = async (level = 11) => {
  const playerId = randomUUID(); ids.push(playerId);
  await db.insert(players).values({ id: playerId, displayName: "Meal test" });
  const [farm] = await db.insert(farms).values({ playerId, level }).returning();
  const [kitchen] = await db.insert(farmBuildings).values({ farmId: farm!.id, type: "kitchen", column: -1, row: 6,
    loadingTile: { column: -1, row: 5 }, startedAt: new Date(0), completesAt: new Date(1000) }).returning();
  await db.insert(farmBuildings).values({ farmId: farm!.id, type: "warehouse", column: 7, row: 3, startedAt: new Date(0), completesAt: new Date(1000) });
  for (const itemKey of ["flour", "oil", "dates", "sesame", "brewersGroats"] as const) await db.insert(farmInventory).values({ farmId: farm!.id, itemKey, quantity: 4 });
  const command = (meal: MealKey, version = 1) => ({ type: "cook_meal" as const, meal, buildingId: kitchen!.id, expectedFarmVersion: version, playerId });
  const advance = (at: number) => db.transaction(async tx => {
    const [saved] = await tx.select().from(farms).where(eq(farms.id, farm!.id)).for("update");
    return advanceFarmLifecycle(tx, saved!, new Date(at));
  });
  return { farm: farm!, command, advance };
};
it.each(MEAL_KEYS)("cooks %s once, consumes automatically offline and never stores meals", async meal => {
  const { farm, command, advance } = await setup();
  const started = await Effect.runPromise(cookMeal(db, command(meal)));
  const job = started.farm.production.cooking!;
  for (const [item, quantity] of Object.entries(MEALS[meal].ingredients)) {
    const stops = job.preparation.supplyStops!.filter(stop => stop.itemKey === item);
    expect(stops.reduce((sum, stop) => sum + stop.quantity, 0)).toBe(quantity);
    if (item === 'oil' || item === 'dates' || item === 'sesame') expect(stops.every(stop => stop.buildingId !== null)).toBe(true);
    expect(stops.every(stop => stop.index < job.preparation.path.length)).toBe(true);
  }
  expect(Date.parse(job.completesAt) - Date.parse(job.startedAt)).toBe(COOKING_MS);
  for (const item of started.inventory) expect(item.quantity).toBe(4 - ((MEALS[meal].ingredients as Record<string, number>)[item.itemKey] ?? 0));
  expect(started.farm.production.mealBenefit).toBeUndefined();
  await expect(Effect.runPromise(cookMeal(db, command(meal)))).rejects.toThrow();
  expect(() => assertFarmerAvailable({ ...farm, production: started.farm.production })).toThrow("cooking");
  const end = Date.parse(job.completesAt), later = await advance(end + 1000);
  expect(later.production.cooking).toBeNull();
  expect(later.production.mealBenefit).toEqual({ meal, startedAt: end, expiresAt: end + MEALS[meal].durationMs });
  const again = await advance(end + MEALS[meal].durationMs + 1000);
  expect(again.production.mealBenefit).toEqual(later.production.mealBenefit);
  const awards = await db.select().from(pointAwards).where(eq(pointAwards.playerId, farm.playerId));
  expect(awards.filter(a => a.action === "cookMeal")).toMatchObject([{ source: `meal:${job.id}`, points: 30, completedAt: new Date(end) }]);
  expect(activeMeal(again.production.mealBenefit, end + MEALS[meal].durationMs + 1000)).toBeNull();
  const inventory = await db.select().from(farmInventory).where(eq(farmInventory.farmId, farm.id));
  for (const item of inventory) expect(item.quantity).toBe(4 - ((MEALS[meal].ingredients as Record<string, number>)[item.itemKey] ?? 0));
});
it("rejects missing ingredients and level 10 without consuming anything", async () => {
  const { farm, command } = await setup(10);
  await expect(Effect.runPromise(cookMeal(db, command("barleyCakes")))).rejects.toThrow("level 11");
  await db.update(farms).set({ level: 11 }).where(eq(farms.id, farm.id));
  await db.update(farmInventory).set({ quantity: 0 }).where(eq(farmInventory.farmId, farm.id));
  await expect(Effect.runPromise(cookMeal(db, command("porridge")))).rejects.toThrow("Not enough");
  const [saved] = await db.select().from(farms).where(eq(farms.id, farm.id));
  expect(saved!.production.cooking).toBeUndefined();
});
it("preserves the old benefit while cooking, then replaces it at the completion timestamp", async () => {
  const { farm, command, advance } = await setup();
  const old = { meal: "dateCakes" as const, startedAt: Date.now() - 1000, expiresAt: Date.now() + 1000000 };
  await db.update(farms).set({ production: { ...farm.production, mealBenefit: old } }).where(eq(farms.id, farm.id));
  const started = await Effect.runPromise(cookMeal(db, command("sesameCakes")));
  expect(started.farm.production.mealBenefit).toEqual(old);
  const done = await advance(Date.parse(started.farm.production.cooking!.completesAt));
  expect(done.production.mealBenefit!.meal).toBe("sesameCakes");
});
it("keeps earned hunger credit but revokes unused protection on replacement", () => {
  const hour = 3600000, porridge = { meal: "porridge" as const, startedAt: 0, expiresAt: hour };
  expect(mealRationDeadline(24 * hour, null, porridge, 0)).toBe(24.5 * hour);
  expect(mealRationDeadline(24.5 * hour, porridge, { meal: "dateCakes", startedAt: hour / 2, expiresAt: hour }, hour / 2)).toBe(24.25 * hour);
  expect(mealRationDeadline(10 * 60000, null, porridge, 0)).toBe(20 * 60000);
});
it("settles porridge ration timing identically online and offline", async () => {
  const minute = 60_000, start = Date.now(), results = [];
  for (const incremental of [false, true]) {
    const { farm, advance } = await setup();
    await db.insert(farmInventory).values({ farmId: farm.id, itemKey: "barley", quantity: 10 });
    await db.update(farms).set({
      production: { ...farm.production, mealBenefit: { meal: "porridge", startedAt: start, expiresAt: start + 60 * minute } },
      nextBarleyConsumptionAt: new Date(start + 20 * minute), hungrySince: null,
      happinessCheckedAt: new Date(start)
    }).where(eq(farms.id, farm.id));
    if (incremental) {
      await advance(start + 20 * minute);
      await advance(start + 60 * minute);
    }
    const finished = await advance(start + 25 * 60 * minute);
    const inventory = await db.select().from(farmInventory).where(eq(farmInventory.farmId, farm.id));
    results.push({ deadline: finished.nextBarleyConsumptionAt?.getTime(), hungrySince: finished.hungrySince,
      barley: inventory.find(item => item.itemKey === "barley")?.quantity });
  }
  expect(results[0]).toEqual(results[1]);
  expect(results[0]!.deadline).toBe(start + (48 * 60 + 40) * minute);
  expect(results[0]!.barley).toBe(8);
});
