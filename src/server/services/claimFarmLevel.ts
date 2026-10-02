import { and, eq, sql } from "drizzle-orm";
import { Data, Effect } from "effect";
import { evaluateProgression } from "../../game-core/farm/progression";
import { HAPPINESS_MANAGEMENT_LEVEL } from "../../game-data/household";
import type { Database } from "../db/client";
import { farmBuildings, farmGroundItems, farmInventory, farms } from "../db/schema";
import { readFarmSnapshot } from "./farmSnapshot";

export class LevelClaimRuleError extends Data.TaggedError("LevelClaimRuleError")<{ readonly message: string }> {}
export class LevelClaimPersistenceError extends Data.TaggedError("LevelClaimPersistenceError")<{ readonly cause: unknown }> {}

export const claimFarmLevel = (database: Database, input: {
  readonly playerId: string; readonly expectedLevel: number; readonly expectedFarmVersion: number;
}) => Effect.gen(function* () {
  const result = yield* Effect.tryPromise({
    try: () => database.transaction(async tx => {
      const [farm] = await tx.select().from(farms).where(eq(farms.playerId, input.playerId)).for("update");
      if (!farm) return new LevelClaimRuleError({ message: "The farm does not exist." });
      // The expected level makes retries harmless without spending twice or skipping a level.
      if (farm.level > input.expectedLevel) return readFarmSnapshot(tx, farm, false);
      if (farm.level !== input.expectedLevel || farm.version !== input.expectedFarmVersion)
        return new LevelClaimRuleError({ message: "The farm changed. Refresh the requirements and try again." });
      const snapshot = await readFarmSnapshot(tx, farm, false);
      const now = Date.now();
      const progress = evaluateProgression(snapshot, now);
      if (!progress.canClaim) return new LevelClaimRuleError({ message: !progress.seedSafe
        ? progress.level === 3
          ? "Keep at least one unexpired barley on the ground, or have an already-planted barley field, before consuming the 15 granary barley."
          : "Keep one extra barley to plant, or have a planted barley field, before consuming this offering."
        : "Complete all requirements before claiming the next level." });
      for (const offering of progress.offerings) {
        if (offering.source === "ground_barley") {
          let remaining = offering.quantity;
          for (const item of snapshot.groundItems.filter(i => i.itemKey === "barley" && i.expiresAt !== null && Date.parse(i.expiresAt) > now)) {
            const take = Math.min(remaining, item.quantity);
            if (take === 0) break;
            if (take === item.quantity) await tx.delete(farmGroundItems).where(eq(farmGroundItems.id, item.id));
            else await tx.update(farmGroundItems).set({ quantity: item.quantity - take }).where(eq(farmGroundItems.id, item.id));
            remaining -= take;
          }
        } else if (offering.source === "granary_barley") {
          let remaining = offering.quantity;
          for (const building of snapshot.buildings.filter(b => b.type === "granary" && Date.parse(b.completesAt) <= now &&
            (progress.level !== 3 || b.storedBarley >= offering.quantity))) {
            const take = Math.min(remaining, building.storedBarley);
            if (take > 0) await tx.update(farmBuildings).set({ storedBarley: building.storedBarley - take }).where(eq(farmBuildings.id, building.id));
            remaining -= take;
            if (remaining === 0) break;
          }
        } else if (offering.source === "processed_grain") {
          let remaining = offering.quantity;
          for (const itemKey of ["flour", "brewersGroats"] as const) {
            const quantity = snapshot.inventory.find(i => i.itemKey === itemKey)?.quantity ?? 0;
            const take = Math.min(remaining, quantity);
            if (take > 0) await tx.update(farmInventory).set({ quantity: quantity - take }).where(and(eq(farmInventory.farmId, farm.id), eq(farmInventory.itemKey, itemKey)));
            remaining -= take;
          }
        } else if (offering.source === "fish") {
          await tx.update(farmInventory).set({ quantity: sql`${farmInventory.quantity} - ${offering.quantity}` })
            .where(and(eq(farmInventory.farmId, farm.id), eq(farmInventory.itemKey, "fish")));
        }
      }
      const [updated] = await tx.update(farms).set({ level: farm.level + 1,
        ...(farm.level === 5 ? { progressionStats: {
          ...snapshot.farm.progression!.stats,
          level6Baseline: {
            produced: snapshot.farm.progression!.stats.beerProduced + (snapshot.farm.progression!.stats.breadProduced ?? 0),
            sold: snapshot.farm.progression!.beerSold + snapshot.farm.progression!.breadSold
          }
        } } : {}),
        ...(farm.level + 1 === HAPPINESS_MANAGEMENT_LEVEL ? { happinessCheckedAt: new Date(now) } : {}),
        version: sql`${farms.version} + 1`, updatedAt: new Date() }).where(eq(farms.id, farm.id)).returning();
      return readFarmSnapshot(tx, updated!, false);
    }), catch: cause => new LevelClaimPersistenceError({ cause })
  });
  return result instanceof LevelClaimRuleError ? yield* Effect.fail(result) : result;
});
