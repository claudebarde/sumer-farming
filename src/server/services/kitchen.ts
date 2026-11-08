import { eq, sql } from "drizzle-orm";
import { Effect } from "effect";
import { randomUUID } from "node:crypto";
import type { Database } from "../db/client";
import { farms } from "../db/schema";
import type { GameCommand } from "../../schemas/gameCommands";
import { COOKING_MS, MEALS } from "../../game-data/kitchen";
import { planProductionJourney, productionArrivalAt } from "../../game-core/farm/productionJourney";
import { farmerSleepBlocker } from "../../game-core/farm/farmerSleep";
import { ProductionPersistenceError, ProductionRuleError } from "./production";
import { readFarmSnapshot } from "./farmSnapshot";
import { setStoredQuantity } from "./physicalStorage";

export const cookMeal = (db: Database, input: Extract<GameCommand, { type: "cook_meal" }> & { playerId: string }) => Effect.gen(function* () {
  const result = yield* Effect.tryPromise({ try: () => db.transaction(async tx => {
    const [record] = await tx.select().from(farms).where(eq(farms.playerId, input.playerId)).for("update");
    const fail = (message: string) => new ProductionRuleError({ message });
    if (!record) return fail("Farm not found.");
    const snapshot = await readFarmSnapshot(tx, record, false), now = Date.now();
    if (snapshot.farm.version !== input.expectedFarmVersion) return fail("The farm changed. Please try again.");
    if (record.level < 11) return fail("Reach level 11 to cook meals.");
    const kitchen = snapshot.buildings.find(b => b.id === input.buildingId && b.type === "kitchen" && Date.parse(b.completesAt) <= now);
    if (!kitchen) return fail("Choose a completed kitchen.");
    // Sleep allowance is unrelated to cooking; all other physical-work blockers apply.
    const busy = farmerSleepBlocker(snapshot, now);
    if (busy && busy !== "No sleep time available yet.") return fail(busy);
    const ingredients = Object.entries(MEALS[input.meal].ingredients);
    for (const [item, quantity] of ingredients) if ((snapshot.inventory.find(i => i.itemKey === item)?.quantity ?? 0) < quantity) return fail(`Not enough ${item === "brewersGroats" ? "groats" : item}.`);
    const preparation = planProductionJourney(snapshot, kitchen.id, now, input, "cooking", MEALS[input.meal].ingredients);
    if (!preparation) return fail("The kitchen needs an accessible road.");
    // Validate every ingredient before any mutation. The farm row serializes donations,
    // porter deliveries and cooking; a repeated start cannot consume twice.
    for (const [item, quantity] of ingredients) await setStoredQuantity(tx, record.id, item as "flour" | "oil" | "dates" | "sesame" | "brewersGroats",
      snapshot.inventory.find(i => i.itemKey === item)!.quantity - quantity, new Date(now));
    const startedAt = productionArrivalAt(preparation);
    const [updated] = await tx.update(farms).set({ production: { ...snapshot.farm.production, cooking: {
      id: randomUUID(), meal: input.meal, buildingId: kitchen.id, preparation,
      startedAt: new Date(startedAt).toISOString(), completesAt: new Date(startedAt + COOKING_MS).toISOString()
    } }, version: sql`${farms.version} + 1`, updatedAt: new Date(now) }).where(eq(farms.id, record.id)).returning();
    return readFarmSnapshot(tx, updated!, false);
  }), catch: cause => new ProductionPersistenceError({ cause }) });
  return result instanceof ProductionRuleError ? yield* Effect.fail(result) : result;
});
