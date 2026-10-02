import { farmerProductionJob } from "../../game-core/farm/farmerProduction";
import { and, eq, sql } from "drizzle-orm";
import { Data, Effect } from "effect";
import { millRecipe, type MillGoods } from "../../game-data/milling";
import { millingUnavailableReason } from "../../game-core/farm/milling";
import type { GameCommand } from "../../schemas/gameCommands";
import type { Database } from "../db/client";
import { farmBuildings, farmInventory, farms } from "../db/schema";
import { readFarmSnapshot } from "./farmSnapshot";

export class MillingRuleError extends Data.TaggedError("MillingRuleError")<{ readonly message: string }> {}
export class MillingPersistenceError extends Data.TaggedError("MillingPersistenceError")<{ readonly cause: unknown }> {}

export const deliverMillGoods = (database: Database, input: Extract<GameCommand, { type: "mill_delivery" }> & { readonly playerId: string }) => Effect.gen(function* () {
  const result = yield* Effect.tryPromise({
    try: () => database.transaction(async tx => {
      const [farm] = await tx.select().from(farms).where(eq(farms.playerId, input.playerId)).for("update");
      if (!farm) return new MillingRuleError({ message: "The farm does not exist." });
      const snapshot = await readFarmSnapshot(tx, farm, false);
      if (snapshot.farm.version !== input.expectedFarmVersion) return new MillingRuleError({ message: "The farm changed. Please try again." });
      const now = Date.now();
      const goods = snapshot.farm.millGoods;
      if (snapshot.farm.production.planting) return new MillingRuleError({ message: "Finish or stop planting or harvesting the selected fields first." });
      if (snapshot.farm.roads.some(r => (r.completesAt ?? 0) > now)) return new MillingRuleError({ message: "Finish building the road first." });
      let next: MillGoods;
      if (input.action === "pickup") {
        if (snapshot.farm.production.delivery || goods.delivery || farmerProductionJob(snapshot.farm) || snapshot.farm.carriedItem || snapshot.farm.fishing || snapshot.farm.gathering ||
          snapshot.crops.some(c => Date.parse(c.plantedAt) > now || c.harvestStartedAt !== null) ||
          snapshot.buildings.some(b => Date.parse(b.completesAt) > now) ||
          snapshot.improvements.some(i => Date.parse(i.completesAt) > now || i.destroyStartedAt !== null)) {
          return new MillingRuleError({ message: "The farmer must finish the current task and empty his hands first." });
        }
        const bags = goods.pending[input.millId];
        if (!bags || bags.flour + bags.brewersGroats === 0) return new MillingRuleError({ message: "There are no bags to collect." });
        next = { pending: Object.fromEntries(Object.entries(goods.pending).filter(([id]) => id !== input.millId)),
          delivery: { millId: input.millId, bags } };
      } else {
        const delivery = goods.delivery;
        if (!delivery || delivery.millId !== input.millId) return new MillingRuleError({ message: "No matching bag delivery is in progress." });
        for (const itemKey of ["flour", "brewersGroats"] as const) {
          const quantity = delivery.bags[itemKey];
          if (quantity > 0) await tx.insert(farmInventory).values({ farmId: farm.id, itemKey, quantity })
            .onConflictDoUpdate({ target: [farmInventory.farmId, farmInventory.itemKey], set: { quantity: sql`${farmInventory.quantity} + ${quantity}`, updatedAt: new Date(now) } });
        }
        next = { ...goods, delivery: null };
      }
      const [updated] = await tx.update(farms).set({ millGoods: next, version: sql`${farms.version} + 1`, updatedAt: new Date(now) }).where(eq(farms.id, farm.id)).returning();
      return readFarmSnapshot(tx, updated!, false);
    }), catch: cause => new MillingPersistenceError({ cause })
  });
  return result instanceof MillingRuleError ? yield* Effect.fail(result) : result;
});

export const startMilling = (database: Database, input: Extract<GameCommand, { type: "start_milling" }> & { readonly playerId: string }) => Effect.gen(function* () {
  const result = yield* Effect.tryPromise({
    try: () => database.transaction(async tx => {
      const [farm] = await tx.select().from(farms).where(eq(farms.playerId, input.playerId)).for("update");
      if (!farm) return new MillingRuleError({ message: "The farm does not exist." });
      const snapshot = await readFarmSnapshot(tx, farm, false);
      if (snapshot.farm.version !== input.expectedFarmVersion) return new MillingRuleError({ message: "The farm changed. Please try again." });
      const now = Date.now();
      const reason = millingUnavailableReason(snapshot, input.recipe, now, input.worker);
      if (snapshot.farm.roads.some(r => (r.completesAt ?? 0) > now)) return new MillingRuleError({ message: "Finish building the road first." });
      if (reason) return new MillingRuleError({ message: reason });
      const mill = snapshot.buildings.find(b => b.type === "mill" && b.column === input.target.column && b.row === input.target.row && Date.parse(b.completesAt) <= now);
      if (!mill) return new MillingRuleError({ message: "Choose a completed Mill." });
      const recipe = millRecipe(input.recipe, input.worker);
      let remaining = recipe.barley;
      const carried = snapshot.farm.carriedItem;
      const fromHands = carried?.itemKey === "barley" ? Math.min(remaining, carried.quantity) : 0;
      remaining -= fromHands;
      const stored = snapshot.inventory.find(i => i.itemKey === "barley")?.quantity ?? 0;
      for (const granary of snapshot.buildings.filter(b => b.type === "granary" && Date.parse(b.completesAt) <= now)) {
        const take = Math.min(remaining, granary.storedBarley);
        if (take > 0) await tx.update(farmBuildings).set({ storedBarley: granary.storedBarley - take }).where(eq(farmBuildings.id, granary.id));
        remaining -= take;
        if (remaining === 0) break;
      }
      const fromFarm = Math.min(remaining, stored);
      if (fromFarm > 0) await tx.update(farmInventory).set({ quantity: stored - fromFarm }).where(and(eq(farmInventory.farmId, farm.id), eq(farmInventory.itemKey, "barley")));
      const [updated] = await tx.update(farms).set({
        milling: { buildingId: mill.id, recipe: input.recipe, worker: input.worker ?? "farmer", barley: recipe.barley, output: recipe.output,
          startedAt: new Date(now).toISOString(), completesAt: new Date(now + recipe.durationMs).toISOString() },
        ...(fromHands > 0 ? { carriedItemKey: carried!.quantity === fromHands ? null : "barley" as const,
          carriedItemQuantity: carried!.quantity - fromHands, carriedItemExpiresAt: carried!.quantity === fromHands ? null : new Date(carried!.expiresAt!) } : {}),
        version: sql`${farms.version} + 1`, updatedAt: new Date(now)
      }).where(eq(farms.id, farm.id)).returning();
      return readFarmSnapshot(tx, updated!, false);
    }), catch: cause => new MillingPersistenceError({ cause })
  });
  return result instanceof MillingRuleError ? yield* Effect.fail(result) : result;
});
