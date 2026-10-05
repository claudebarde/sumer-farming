import { and, eq, sql } from "drizzle-orm";
import { farmerProductionJob } from "../../game-core/farm/farmerProduction";
import { sharedDeliveryStop } from "../../game-core/farm/storageDelivery";
import { porterReserved } from "../../game-data/porter";
import { Data, Effect } from "effect";
import { BREAD_RECIPE, type ProductionState } from "../../game-data/production";
import { SHRINE_UNLOCK_LEVEL, SHRINE_OFFERING_QUANTITY, SHRINE_BLESSING_DURATION_MS, shrineBlessingActive } from "../../game-data/shrine";
import { happinessDecayElapsed } from "../../game-core/farm/wellbeing";
import type { GameCommand } from "../../schemas/gameCommands";
import type { Database } from "../db/client";
import { farms, farmInventory } from "../db/schema";
import { readFarmSnapshot } from "./farmSnapshot";
import { estateResourceCapacity } from "../../game-data/storage";
import { activeBuildingUpgrade, buildingLevel, buildingProductionMultiplier } from "../../game-data/buildingUpgrades";

export class ProductionRuleError extends Data.TaggedError("ProductionRuleError")<{ readonly message: string }> {}
export class ProductionPersistenceError extends Data.TaggedError("ProductionPersistenceError")<{ readonly cause: unknown }> {}

export const productionAction = (database: Database, input: Extract<GameCommand, { type: "start_baking" | "production_delivery" | "shrine_offering" }> & { readonly playerId: string }) => Effect.gen(function* () {
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
      if (input.type === "shrine_offering") {
        if ((snapshot.farm.progression?.level ?? 1) < SHRINE_UNLOCK_LEVEL) return fail("Unlock at level 8.");
        if (!snapshot.buildings.some(b => b.id === input.buildingId && b.type === "smallShrine" && Date.parse(b.completesAt) <= now)) return fail("Choose a completed Small shrine.");
        if (shrineBlessingActive(state.shrineBlessing, now)) return fail("A blessing is already active. Wait until it expires.");
        const quantity = snapshot.inventory.find(i => i.itemKey === input.item)?.quantity ?? 0;
        if (quantity < SHRINE_OFFERING_QUANTITY) return fail(`Store ${SHRINE_OFFERING_QUANTITY} ${input.item} at the farm first.`);
        await tx.update(farmInventory).set({ quantity: quantity - SHRINE_OFFERING_QUANTITY, updatedAt: new Date(now) })
          .where(and(eq(farmInventory.farmId, farm.id), eq(farmInventory.itemKey, input.item)));
        // Preserve fractional decay accrued under the previous blessing before replacing it.
        const [current] = await tx.select().from(farms).where(eq(farms.id, farm.id));
        const credit = happinessDecayElapsed(current!.happinessCheckedAt.getTime(), now, state.shrineBlessing);
        await tx.update(farms).set({ happinessCheckedAt: new Date(now - credit) }).where(eq(farms.id, farm.id));
        production = { ...state, shrineBlessing: { buildingId: input.buildingId, startedAt: new Date(now).toISOString(), expiresAt: new Date(now + SHRINE_BLESSING_DURATION_MS).toISOString() } };
      } else if (input.type === "start_baking") {
        const oven = snapshot.buildings.find(b => b.id === input.buildingId && b.type === "breadOven" && Date.parse(b.completesAt) <= now);
        if (!oven) return fail("Choose a completed Bread Oven.");
        if (activeBuildingUpgrade(state.buildingUpgrades, oven.id, now)) return fail("The Bread Oven is upgrading.");
        if (state.baking[oven.id]) return fail("This oven is already baking.");
        const flour = snapshot.inventory.find(i => i.itemKey === "flour")?.quantity ?? 0;
        if (flour < BREAD_RECIPE.flour) return fail(`Baking requires ${BREAD_RECIPE.flour} stored Flour.`);
        await tx.update(farmInventory).set({ quantity: flour - BREAD_RECIPE.flour, updatedAt: new Date(now) }).where(and(eq(farmInventory.farmId, farm.id), eq(farmInventory.itemKey, "flour")));
        const duration = Math.round(BREAD_RECIPE.durationMs * buildingProductionMultiplier("breadOven", buildingLevel(state.buildingUpgrades, oven.id, now)));
        production = { ...state, baking: { ...state.baking, [oven.id]: { startedAt: new Date(now).toISOString(), completesAt: new Date(now + duration).toISOString(), output: BREAD_RECIPE.output } } };
      } else if (input.action === "pickup") {
        const stack = state.pending[input.buildingId];
        if (!stack) return fail("There are no finished goods to collect.");
        const stored = snapshot.inventory.find(i => i.itemKey === stack.itemKey)?.quantity ?? 0;
        const quantity = Math.min(stack.quantity, Math.max(0, estateResourceCapacity(stack.itemKey, snapshot.buildings, now) - stored - porterReserved(state.porter, stack.itemKey)));
        if (quantity === 0) return fail("Storage is full. Use or sell some goods first.");
        const pending = Object.fromEntries(Object.entries(state.pending).filter(([id]) => id !== input.buildingId));
        production = { ...state, pending: quantity < stack.quantity ? { ...pending, [input.buildingId]: { ...stack, quantity: stack.quantity - quantity } } : pending, delivery: { ...stack, quantity, buildingId: input.buildingId } };
      } else {
        const delivery = state.delivery;
        if (!delivery || delivery.buildingId !== input.buildingId) return fail("There is no matching delivery to store.");
        const stored = snapshot.inventory.find(i => i.itemKey === delivery.itemKey)?.quantity ?? 0;
        const stop = sharedDeliveryStop(delivery.itemKey, stored + porterReserved(state.porter, delivery.itemKey), snapshot.buildings.some(b => b.type === "warehouse" && Date.parse(b.completesAt) <= now));
        const quantity = Math.min(delivery.quantity, stop.room);
        if (quantity > 0) await tx.insert(farmInventory).values({ farmId: farm.id, itemKey: delivery.itemKey, quantity })
          .onConflictDoUpdate({ target: [farmInventory.farmId, farmInventory.itemKey], set: { quantity: sql`${farmInventory.quantity} + ${quantity}`, updatedAt: new Date(now) } });
        const remainder = delivery.quantity - quantity;
        const continueDelivery = remainder > 0 && stored + quantity + porterReserved(state.porter, delivery.itemKey) < estateResourceCapacity(delivery.itemKey, snapshot.buildings, now);
        production = { ...state, delivery: continueDelivery ? { ...delivery, quantity: remainder } : null, pending: remainder > 0 && !continueDelivery ? { ...state.pending, [delivery.buildingId]: { itemKey: delivery.itemKey, quantity: (state.pending[delivery.buildingId]?.quantity ?? 0) + remainder } } : state.pending };
      }
      const [updated] = await tx.update(farms).set({ production, version: sql`${farms.version} + 1`, updatedAt: new Date(now) }).where(eq(farms.id, farm.id)).returning();
      return readFarmSnapshot(tx, updated!, false);
    }), catch: cause => new ProductionPersistenceError({ cause })
  });
  return result instanceof ProductionRuleError ? yield* Effect.fail(result) : result;
});
