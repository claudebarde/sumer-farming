import { and, eq, sql } from "drizzle-orm";
import { farmerProductionJob } from "../../game-core/farm/farmerProduction";
import { Data, Effect } from "effect";
import { BREAD_RECIPE, type ProductionState } from "../../game-data/production";
import type { GameCommand } from "../../schemas/gameCommands";
import type { Database } from "../db/client";
import { farms, farmInventory } from "../db/schema";
import { readFarmSnapshot } from "./farmSnapshot";

export class ProductionRuleError extends Data.TaggedError("ProductionRuleError")<{ readonly message: string }> {}
export class ProductionPersistenceError extends Data.TaggedError("ProductionPersistenceError")<{ readonly cause: unknown }> {}

export const productionAction = (database: Database, input: Extract<GameCommand, { type: "start_baking" | "production_delivery" }> & { readonly playerId: string }) => Effect.gen(function* () {
  const result = yield* Effect.tryPromise({
    try: () => database.transaction(async tx => {
      const fail = (message: string) => new ProductionRuleError({ message });
      const [farm] = await tx.select().from(farms).where(eq(farms.playerId, input.playerId)).for("update");
      if (!farm) return fail("The farm does not exist.");
      const snapshot = await readFarmSnapshot(tx, farm, false);
      if (snapshot.farm.version !== input.expectedFarmVersion) return fail("The farm changed. Please try again.");
      if ((snapshot.farm.progression?.level ?? 1) < 6) return fail("Unlock at level 6.");
      const now = Date.now();
      if (snapshot.farm.roads.some(r => (r.completesAt ?? 0) > now)) return fail("Finish building the road first.");
      const state = snapshot.farm.production;
      if (state.planting) return fail("Finish or stop planting or harvesting the selected fields first.");
      if (input.type === "start_baking" && state.baking[input.buildingId]) return fail("This oven is already baking.");
      if (Object.keys(state.baking).length > 0) return fail("The farmer is baking in the Bread Oven. Wait for baking to finish.");
      const storing = input.type === "production_delivery" && input.action === "store";
      if (!storing && (state.delivery || farmerProductionJob(snapshot.farm) || snapshot.farm.millGoods.delivery || snapshot.farm.carriedItem ||
        snapshot.farm.gathering || snapshot.farm.fishing || snapshot.crops.some(c => Date.parse(c.plantedAt) > now || c.harvestStartedAt !== null) ||
        snapshot.buildings.some(b => Date.parse(b.completesAt) > now) || snapshot.improvements.some(i => Date.parse(i.completesAt) > now || i.destroyStartedAt !== null))) {
        return fail("Finish the current task and empty the farmer's hands first.");
      }
      let production: ProductionState;
      if (input.type === "start_baking") {
        const oven = snapshot.buildings.find(b => b.id === input.buildingId && b.type === "breadOven" && Date.parse(b.completesAt) <= now);
        if (!oven) return fail("Choose a completed Bread Oven.");
        if (state.baking[oven.id]) return fail("This oven is already baking.");
        const flour = snapshot.inventory.find(i => i.itemKey === "flour")?.quantity ?? 0;
        if (flour < BREAD_RECIPE.flour) return fail(`Baking requires ${BREAD_RECIPE.flour} stored Flour.`);
        await tx.update(farmInventory).set({ quantity: flour - BREAD_RECIPE.flour, updatedAt: new Date(now) }).where(and(eq(farmInventory.farmId, farm.id), eq(farmInventory.itemKey, "flour")));
        production = { ...state, baking: { ...state.baking, [oven.id]: { startedAt: new Date(now).toISOString(), completesAt: new Date(now + BREAD_RECIPE.durationMs).toISOString(), output: BREAD_RECIPE.output } } };
      } else if (input.action === "pickup") {
        const stack = state.pending[input.buildingId];
        if (!stack) return fail("There are no finished goods to collect.");
        production = { ...state, pending: Object.fromEntries(Object.entries(state.pending).filter(([id]) => id !== input.buildingId)), delivery: { ...stack, buildingId: input.buildingId } };
      } else {
        const delivery = state.delivery;
        if (!delivery || delivery.buildingId !== input.buildingId) return fail("There is no matching delivery to store.");
        const stored = snapshot.inventory.find(i => i.itemKey === delivery.itemKey)?.quantity ?? 0;
        if (stored > 2147483647 - delivery.quantity) return fail("There is no space for these goods.");
        await tx.insert(farmInventory).values({ farmId: farm.id, itemKey: delivery.itemKey, quantity: delivery.quantity })
          .onConflictDoUpdate({ target: [farmInventory.farmId, farmInventory.itemKey], set: { quantity: sql`${farmInventory.quantity} + ${delivery.quantity}`, updatedAt: new Date(now) } });
        production = { ...state, delivery: null };
      }
      const [updated] = await tx.update(farms).set({ production, version: sql`${farms.version} + 1`, updatedAt: new Date(now) }).where(eq(farms.id, farm.id)).returning();
      return readFarmSnapshot(tx, updated!, false);
    }), catch: cause => new ProductionPersistenceError({ cause })
  });
  return result instanceof ProductionRuleError ? yield* Effect.fail(result) : result;
});
