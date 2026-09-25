import { and, eq, sql } from "drizzle-orm";
import { Data, Effect } from "effect";
import { CAST_COOLDOWN_MS, CAST_DELAY_MS, FISH_CAPACITY } from "../../game-data/fishing";
import { catchesFish } from "../../game-core/farm/fishing";
import { INITIAL_FARM_CONFIG } from "../../game-data/initialFarm";
import type { GameCommand } from "../../schemas/gameCommands";
import type { Database } from "../db/client";
import { farmCrops, farmInventory, farms } from "../db/schema";
import { advanceFarmLifecycle } from "./farmLifecycle";
import { readFarmSnapshot } from "./farmSnapshot";

export class FishingRuleError extends Data.TaggedError("FishingRuleError")<{ readonly message: string }> {}
export class FishingPersistenceError extends Data.TaggedError("FishingPersistenceError")<{ readonly cause: unknown }> {}
type Input = Extract<GameCommand, { type: "fishing" | "cast_fishing" | "cancel_fishing" }> & { readonly playerId: string };

export const fishingAction = (db: Database, input: Input) => Effect.gen(function* () {
  const result = yield* Effect.tryPromise({
    try: () => db.transaction(async tx => {
      const [loaded] = await tx.select().from(farms).where(eq(farms.playerId, input.playerId)).for("update");
      const fail = (message: string) => new FishingRuleError({ message });
      if (!loaded) return fail("The farm could not be found.");
      const now = Date.now();
      const farm = await advanceFarmLifecycle(tx, loaded, new Date(now));
      const [inventory] = await tx.select().from(farmInventory).where(and(eq(farmInventory.farmId, farm.id), eq(farmInventory.itemKey, "fish")));
      const quantity = inventory?.quantity ?? 0;
      const update: Partial<typeof farms.$inferInsert> = {};
      if (input.type === "cancel_fishing") {
        if (farm.fishing?.id !== input.sessionId) return readFarmSnapshot(tx, farm, false);
        update.fishing = null;
      } else if (input.type === "cast_fishing") {
        const session = farm.fishing;
        if (!session || session.id !== input.sessionId || farm.carriedItemKey !== null) return fail("This fishing session is no longer active.");
        if (session.lastCastAt !== null && now - session.lastCastAt < CAST_COOLDOWN_MS) return fail("Wait a moment before casting again.");
        if (!Number.isFinite(input.aim) || input.aim < 0 || input.aim > 1) return fail("Cast inside the fishing area.");
        const caught = catchesFish(session.seed, now + CAST_DELAY_MS - session.startedAt, input.aim);
        // A single short cast resolves under the farm lock; no client-supplied success/time.
        await new Promise(resolve => setTimeout(resolve, CAST_DELAY_MS));
        if (caught) {
          update.fishing = null;
          update.carriedItemKey = "fish";
          update.carriedItemQuantity = 1;
          update.carriedItemExpiresAt = null;
        } else update.fishing = { ...session, lastCastAt: now };
      } else {
        if (farm.version !== input.expectedFarmVersion) return fail("The farm changed. Please try again.");
        const { worldBounds, riverRow, buildingBounds } = INITIAL_FARM_CONFIG;
        const atRiver = input.target.row === riverRow && input.target.column >= worldBounds.minimumColumn && input.target.column <= worldBounds.maximumColumn;
        if (input.action === "start") {
          if (!atRiver) return fail("Fish from the riverbank.");
          if (farm.carriedItemKey !== null) return fail("Empty your hands before fishing.");
          if (quantity >= FISH_CAPACITY) return fail("Fish storage is full.");
          const [busy] = await tx.select({ id: farmCrops.id }).from(farmCrops).where(and(eq(farmCrops.farmId, farm.id), sql`(${farmCrops.plantedAt} > ${new Date(now)} OR ${farmCrops.harvestStartedAt} IS NOT NULL)`)).limit(1);
          if (farm.gatheringItemKey !== null || busy) return fail("The farmer is busy.");
          if (farm.fishing) return readFarmSnapshot(tx, farm, false);
          update.fishing = { id: crypto.randomUUID(), seed: crypto.getRandomValues(new Uint32Array(1))[0]!, startedAt: now, lastCastAt: null, ...input.target };
        } else {
          if (farm.carriedItemKey !== "fish" || farm.carriedItemQuantity !== 1) return fail("The farmer is not holding a fish.");
          if (input.action === "release" && !atRiver) return fail("Release the fish into the river.");
          if (input.action === "store") {
            if (input.target.column < buildingBounds.minimumColumn || input.target.column > buildingBounds.maximumColumn || input.target.row < buildingBounds.minimumRow || input.target.row > buildingBounds.maximumRow) return fail("Store fish only at the farm building.");
            if (quantity >= FISH_CAPACITY) return fail("Fish storage is full. Release the fish at the river.");
            await tx.insert(farmInventory).values({ farmId: farm.id, itemKey: "fish", quantity: quantity + 1 }).onConflictDoUpdate({ target: [farmInventory.farmId, farmInventory.itemKey], set: { quantity: quantity + 1, updatedAt: new Date(now) } });
          }
          update.carriedItemKey = null; update.carriedItemQuantity = 0; update.carriedItemExpiresAt = null;
        }
      }
      const [updated] = await tx.update(farms).set({ ...update, version: sql`${farms.version} + 1`, updatedAt: new Date() }).where(eq(farms.id, farm.id)).returning();
      return readFarmSnapshot(tx, updated!, false);
    }), catch: cause => new FishingPersistenceError({ cause })
  });
  return result instanceof FishingRuleError ? yield* Effect.fail(result) : result;
});
