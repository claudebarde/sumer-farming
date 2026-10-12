import { and, eq, sql } from "drizzle-orm";
import { Data, Effect } from "effect";
import type { GameCommand } from "../../schemas/gameCommands";
import { buildingDemolitionReason, withoutBuildingState } from "../../game-core/farm/buildingDemolition";
import type { Database } from "../db/client";
import { farms, farmBuildings } from "../db/schema";
import { readFarmSnapshot } from "./farmSnapshot";

export class BuildingDemolitionRuleError extends Data.TaggedError("BuildingDemolitionRuleError")<{ readonly message: string }> {}
export class BuildingDemolitionPersistenceError extends Data.TaggedError("BuildingDemolitionPersistenceError")<{ readonly cause: unknown }> {}

export const destroyBuilding = (db: Database, input: Extract<GameCommand, { type: "destroy_building" }> & { playerId: string }) => Effect.gen(function* () {
  const result = yield* Effect.tryPromise({ try: () => db.transaction(async tx => {
    const [record] = await tx.select().from(farms).where(eq(farms.playerId, input.playerId)).for("update");
    if (!record) return new BuildingDemolitionRuleError({ message: "Farm not found." });
    if (record.version !== input.expectedFarmVersion) return new BuildingDemolitionRuleError({ message: "The farm changed. Please try again." });
    const snapshot = await readFarmSnapshot(tx, record, false);
    const reason = buildingDemolitionReason(snapshot, input.buildingId, Date.now());
    if (reason) return new BuildingDemolitionRuleError({ message: reason });
    // Ownership and emptiness have been checked under the same farm lock used by
    // production, storage and construction. No refund or inventory write occurs.
    await tx.delete(farmBuildings).where(and(eq(farmBuildings.farmId, record.id), eq(farmBuildings.id, input.buildingId)));
    const [updated] = await tx.update(farms).set({ ...withoutBuildingState(snapshot, input.buildingId),
      version: sql`${farms.version} + 1`, updatedAt: new Date()
    }).where(eq(farms.id, record.id)).returning();
    return readFarmSnapshot(tx, updated!, false);
  }), catch: cause => new BuildingDemolitionPersistenceError({ cause }) });
  return result instanceof BuildingDemolitionRuleError ? yield* Effect.fail(result) : result;
});
