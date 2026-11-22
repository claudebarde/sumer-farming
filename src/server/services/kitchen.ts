import { porterPath } from "../../game-core/farm/porter";
import { SLEEP_HOME, SLEEP_ENTRY_MS } from "../../game-data/farmerSleep";
import { WORKER_MOVE_DURATION_PER_TILE } from "../../game-data/movement";
import { interiorPath, distance, INTERIOR_ENTRY } from "../../game-core/home/interiorNavigation";
import { furnitureObstacles } from "../../game-core/home/furniture";
import { eq, sql } from "drizzle-orm";
import { Effect } from "effect";
import { randomUUID } from "node:crypto";
import type { Database } from "../db/client";
import { farms } from "../db/schema";
import type { GameCommand } from "../../schemas/gameCommands";
import { COOKING_MS, MEALS } from "../../game-data/kitchen";
import { farmerSleepBlocker } from "../../game-core/farm/farmerSleep";
import { ProductionPersistenceError, ProductionRuleError } from "./production";
import { readFarmSnapshot } from "./farmSnapshot";
import { setStoredQuantity } from "./physicalStorage";

export const cookMeal = (db: Database, input: Extract<GameCommand, { type: "cook_meal" }> & { playerId: string }) => Effect.gen(function* () {
  const result = yield* Effect.tryPromise({ try: () => db.transaction(async tx => {
    const [record] = await tx.select().from(farms).where(eq(farms.playerId, input.playerId)).for("update");
    const fail = (message: string) => new ProductionRuleError({ message });
    if (!record) return fail("Farm not found.");
    if (record.version !== input.expectedFarmVersion) return fail("The farm changed. Please try again.");
    const snapshot = await readFarmSnapshot(tx, record, false), now = Date.now();
    if (record.level < 11) return fail("Reach level 11 to cook meals.");
    const indoorKitchen = record.homeAppearance.furniture?.find(item => item.key === "indoor-kitchen");
    if ((!input.interiorPosition && !input.fromFarm) || !indoorKitchen || input.buildingId !== record.id) return fail("Place a kitchen inside your home first.");
    // Sleep allowance is unrelated to cooking; all other physical-work blockers apply.
    const busy = farmerSleepBlocker(snapshot, now);
    if (busy && busy !== "No sleep time available yet.") return fail(busy);
    const ingredients = Object.entries(MEALS[input.meal].ingredients);
    for (const [item, quantity] of ingredients) if ((snapshot.inventory.find(i => i.itemKey === item)?.quantity ?? 0) < quantity) return fail(`Not enough ${item === "brewersGroats" ? "groats" : item}.`);
    const buildings = snapshot.buildings.map(b => ({ ...b, completesAt: Date.parse(b.completesAt) }));
    const routeHome = (from: typeof SLEEP_HOME, to: typeof SLEEP_HOME) => porterPath(buildings, snapshot.farm.roads, from, to, now, [...snapshot.objects, ...snapshot.improvements]);
    const hint = input.farmerPosition && routeHome(SLEEP_HOME, input.farmerPosition) ? input.farmerPosition : SLEEP_HOME;
    const farmPath = input.fromFarm ? routeHome(hint, SLEEP_HOME) : null;
    if (input.fromFarm && !farmPath) return fail("The farmer cannot reach the farmhouse.");
    const farmApproach = farmPath ? { departedAt: now, path: [...farmPath] } : undefined;
    const insideAt = farmPath ? now + (farmPath.length - 1) * WORKER_MOVE_DURATION_PER_TILE + SLEEP_ENTRY_MS : now;
    const origin = input.fromFarm ? INTERIOR_ENTRY : input.interiorPosition!;
    const route = interiorPath(origin,
      { x: indoorKitchen.x + (indoorKitchen.orientation === "mirrored" ? -10 : 10), y: indoorKitchen.y + 30 },
      furnitureObstacles((record.homeAppearance.furniture ?? []).filter(item => item.key !== "indoor-kitchen")));
    if (!route.length) return fail("Leave clear floor in front of the kitchen table.");
    const interior = { kitchen: indoorKitchen, departedAt: insideAt, path: [origin, ...route], ...(farmApproach ? { farmApproach } : {}) };
    // Validate every ingredient before any mutation. The farm row serializes donations,
    // porter deliveries and cooking; a repeated start cannot consume twice.
    for (const [item, quantity] of ingredients) await setStoredQuantity(tx, record.id, item as "flour" | "oil" | "dates" | "sesame" | "brewersGroats",
      snapshot.inventory.find(i => i.itemKey === item)!.quantity - quantity, new Date(now));
    const startedAt = insideAt + Math.ceil(interior.path.slice(1).reduce((total, point, i) => total + distance(interior.path[i]!, point), 0) / 255 * 1000);
    const [updated] = await tx.update(farms).set({ production: { ...snapshot.farm.production, cooking: {
      id: randomUUID(), meal: input.meal, buildingId: record.id, interior,
      startedAt: new Date(startedAt).toISOString(), completesAt: new Date(startedAt + COOKING_MS).toISOString()
    } }, version: sql`${farms.version} + 1`, updatedAt: new Date(now) }).where(eq(farms.id, record.id)).returning();
    return readFarmSnapshot(tx, updated!, false);
  }), catch: cause => new ProductionPersistenceError({ cause }) });
  return result instanceof ProductionRuleError ? yield* Effect.fail(result) : result;
});
