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
  await db.update(farms).set({ homeAppearance: { ...farm!.homeAppearance,
    furniture: [{ key: "indoor-kitchen", x: 850, y: 700 }] } }).where(eq(farms.id, farm!.id));
  await db.insert(farmBuildings).values({ farmId: farm!.id, type: "warehouse", column: 7, row: 3, startedAt: new Date(0), completesAt: new Date(1000) });
  for (const itemKey of ["flour", "oil", "dates", "sesame", "brewersGroats"] as const) await db.insert(farmInventory).values({ farmId: farm!.id, itemKey, quantity: 4 });
  const command = (meal: MealKey, version = 1) => ({ type: "cook_meal" as const, meal, buildingId: farm!.id, interiorPosition: { x: 705, y: 940 }, expectedFarmVersion: version, playerId });
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
it("unlocks the painted jar on the fiftieth offline meal completion only once", async () => {
  const { farm, command, advance } = await setup();
  await db.insert(pointAwards).values(Array.from({ length: 49 }, (_, i) => ({
    playerId: farm.playerId, source: `meal:previous:${i}`, action: "cookMeal", points: 30,
    ruleVersion: 1, completedAt: new Date(),
  })));
  const started = await Effect.runPromise(cookMeal(db, command("barleyCakes")));
  expect(started.farm.progression?.stats.achievementTreasures ?? []).not.toContain("painted-large-jar");
  const end = Date.parse(started.farm.production.cooking!.completesAt);
  const done = await advance(end + 1000);
  expect(done.progressionStats.achievementTreasures).toContain("painted-large-jar");
  const again = await advance(end + 2000);
  expect(again.homeAppearance.furnitureRevision).toBe(done.homeAppearance.furnitureRevision);
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

it.each(["original", "mirrored"] as const)("cooks indoors in %s orientation without an outdoor kitchen, and completes exactly once offline", async orientation => {
  const { farm, command, advance } = await setup();
  await db.delete(farmBuildings).where(eq(farmBuildings.farmId, farm.id));
  const kitchen = { key: "indoor-kitchen" as const, x: 850, y: 700, orientation };
  await db.update(farms).set({ homeAppearance: { ...farm.homeAppearance, furniture: [kitchen] } }).where(eq(farms.id, farm.id));
  const input = { ...command("barleyCakes"), buildingId: farm.id, interiorPosition: { x: 705, y: 940 } };
  const started = await Effect.runPromise(cookMeal(db, input));
  const job = started.farm.production.cooking!;
  expect(job.preparation).toBeUndefined();
  expect(job.interior?.kitchen).toEqual(kitchen);
  expect(job.interior?.path.at(-1)).toEqual({ x: 850 + (orientation === "mirrored" ? -10 : 10), y: 730 });
  expect(Date.parse(job.startedAt)).toBeGreaterThan(job.interior!.departedAt);
  expect(Date.parse(job.completesAt) - Date.parse(job.startedAt)).toBe(30_000);
  await expect(Effect.runPromise(cookMeal(db, { ...input, expectedFarmVersion: started.farm.version }))).rejects.toThrow();
  const { saveHomeFurniture } = await import("../../src/server/services/homeAppearance");
  expect((await saveHomeFurniture(db, farm.playerId, { revision: 0, items: [] })).ok).toBe(false);
  const end = Date.parse(job.completesAt);
  const completed = await advance(end + 1000);
  expect(completed.production.cooking).toBeNull();
  expect(completed.production.mealBenefit?.startedAt).toBe(end);
  await advance(end + 2000);
  const awards = await db.select().from(pointAwards).where(eq(pointAwards.playerId, farm.playerId));
  expect(awards.filter(a => a.action === "cookMeal")).toHaveLength(1);
  const inventory = await db.select().from(farmInventory).where(eq(farmInventory.farmId, farm.id));
  expect(inventory.find(item => item.itemKey === "flour")?.quantity).toBe(3);
  expect(inventory.find(item => item.itemKey === "oil")?.quantity).toBe(3);
});

it("rejects missing indoor kitchens and invalid routes without consuming ingredients", async () => {
  const { farm, command } = await setup();
  const input = { ...command("barleyCakes"), buildingId: farm.id, interiorPosition: { x: 0, y: 0 } };
  await db.update(farms).set({ homeAppearance: { ...farm.homeAppearance, furniture: [] } }).where(eq(farms.id, farm.id));
  await expect(Effect.runPromise(cookMeal(db, input))).rejects.toThrow("kitchen");
  await db.update(farms).set({ homeAppearance: { ...farm.homeAppearance, furniture: [{ key: "indoor-kitchen", x: 850, y: 700 }] } }).where(eq(farms.id, farm.id));
  await expect(Effect.runPromise(cookMeal(db, input))).rejects.toThrow("clear floor");
  const inventory = await db.select().from(farmInventory).where(eq(farmInventory.farmId, farm.id));
  expect(inventory.every(item => item.quantity === 4)).toBe(true);
});

it("starts farmhouse cooking immediately with saved travel, and finishes once without animation callbacks", async () => {
  const { farm, command, advance } = await setup();
  const { SLEEP_HOME, SLEEP_ENTRY_MS } = await import("../../src/game-data/farmerSleep");
  const { WORKER_MOVE_DURATION_PER_TILE } = await import("../../src/game-data/movement");
  const base = { ...command("dateCakes"), interiorPosition: undefined };
  const input = { ...base, fromFarm: true, farmerPosition: { column: SLEEP_HOME.column + 2, row: SLEEP_HOME.row } };
  const started = await Effect.runPromise(cookMeal(db, input));
  const job = started.farm.production.cooking!, indoor = job.interior!;
  expect(indoor.farmApproach?.path.at(-1)).toEqual(SLEEP_HOME);
  expect(indoor.departedAt - indoor.farmApproach!.departedAt).toBe(
    (indoor.farmApproach!.path.length - 1) * WORKER_MOVE_DURATION_PER_TILE + SLEEP_ENTRY_MS);
  expect(Date.parse(job.startedAt)).toBeGreaterThan(indoor.departedAt);
  expect(Date.parse(job.completesAt) - Date.parse(job.startedAt)).toBe(COOKING_MS);
  expect(started.inventory.find(i => i.itemKey === "dates")?.quantity).toBe(3);
  await expect(Effect.runPromise(cookMeal(db, { ...input, expectedFarmVersion: started.farm.version }))).rejects.toThrow("busy");
  const end = Date.parse(job.completesAt);
  const done = await advance(end + 5000);
  expect(done.production.cooking).toBeNull();
  expect(done.production.mealBenefit).toEqual({ meal: "dateCakes", startedAt: end, expiresAt: end + MEALS.dateCakes.durationMs });
  await advance(end + 10_000);
  const awards = await db.select().from(pointAwards).where(eq(pointAwards.playerId, farm.playerId));
  expect(awards.filter(a => a.action === "cookMeal")).toHaveLength(1);
});

it("requires a placed kitchen for the farm shortcut too", async () => {
  const { farm, command } = await setup();
  await db.update(farms).set({ homeAppearance: { ...farm.homeAppearance, furniture: [] } }).where(eq(farms.id, farm.id));
  await expect(Effect.runPromise(cookMeal(db, { ...command("barleyCakes"), fromFarm: true }))).rejects.toThrow("Place a kitchen");
});

it("starts cooking after a porter delivery settles without rejecting its own version update", async () => {
  const { farm, command } = await setup();
  const now = Date.now();
  await db.update(farms).set({ production: { ...farm.production, porter: {
    hiredAt: now - 20000, expiresAt: now - 1000, checkedAt: now - 10000,
    position: { column: 0, row: 5 },
    job: { buildingId: farm.id, itemKey: "flour", quantity: 1, storageId: "farm",
      startedAt: now - 10000, pickupAt: now - 9000, completesAt: now - 5000,
      path: [{ column: 0, row: 5 }], pickupIndex: 0 }
  } } }).where(eq(farms.id, farm.id));
  const started = await Effect.runPromise(cookMeal(db, command("barleyCakes", farm.version)));
  expect(started.farm.production.cooking?.meal).toBe("barleyCakes");
  expect(started.inventory.find(i => i.itemKey === "flour")?.quantity).toBe(5 - (MEALS.barleyCakes.ingredients.flour ?? 0));
  await expect(Effect.runPromise(cookMeal(db, command("barleyCakes", farm.version)))).rejects.toThrow("The farm changed");
});
