import { farmerProductionJob } from "../../game-core/farm/farmerProduction";
import { and, eq, inArray, sql } from "drizzle-orm";
import { farmDecorationTypes, isClearableScenery } from "../../game-data/farmObjects";
import { ROAD_CONSTRUCTION_DURATION_MS, roadIsComplete } from "../../game-data/roads";
import { Data, Effect } from "effect";
import { getBuildingFootprint } from "../../game-core/farm/buildings";
import { roadKey, validateRoadPlacement } from "../../game-core/farm/roads";
import { INITIAL_FARM_CONFIG } from "../../game-data/initialFarm";
import type { GameCommand } from "../../schemas/gameCommands";
import type { Database } from "../db/client";
import { farms, farmObjects } from "../db/schema";
import { readFarmSnapshot } from "./farmSnapshot";

export class RoadRuleError extends Data.TaggedError("RoadRuleError")<{ readonly message: string }> {}
export class RoadPersistenceError extends Data.TaggedError("RoadPersistenceError")<{ readonly cause: unknown }> {}

export const buildRoad = (database: Database, input: Extract<GameCommand, { type: "build_road" }> & { readonly playerId: string }) => Effect.gen(function* () {
  const result = yield* Effect.tryPromise({
    try: () => database.transaction(async tx => {
      const fail = (message: string) => new RoadRuleError({ message });
      const [farm] = await tx.select().from(farms).where(eq(farms.playerId, input.playerId)).for("update");
      if (!farm) return fail("The farm does not exist.");
      const snapshot = await readFarmSnapshot(tx, farm, false);
      if (snapshot.farm.version !== input.expectedFarmVersion) return fail("The farm changed. Please try again.");
      const now = Date.now();
      if (snapshot.farm.roads.some(r => !roadIsComplete(r, now))) return fail("Finish building the road first.");
      if (snapshot.farm.production.planting || snapshot.farm.carriedItem || farmerProductionJob(snapshot.farm) || snapshot.farm.production.delivery || snapshot.farm.millGoods.delivery || snapshot.farm.gathering || snapshot.farm.fishing ||
        snapshot.crops.some(c => Date.parse(c.plantedAt) > now || c.harvestStartedAt !== null) || snapshot.buildings.some(b => Date.parse(b.completesAt) > now) ||
        snapshot.improvements.some(i => Date.parse(i.completesAt) > now || i.destroyStartedAt !== null)) return fail("Finish the current task and empty the farmer's hands first.");
      const occupied = new Set([
        ...snapshot.crops, ...snapshot.groundItems, ...snapshot.objects.filter(object => !isClearableScenery(object.type)), ...snapshot.improvements,
        ...snapshot.buildings.flatMap(b => getBuildingFootprint(b.type, b)),
        ...getBuildingFootprint("granary", { column: INITIAL_FARM_CONFIG.buildingBounds.minimumColumn, row: INITIAL_FARM_CONFIG.buildingBounds.minimumRow })
      ].map(roadKey));
      const reason = validateRoadPlacement(input.target, snapshot.farm.roads, occupied);
      if (reason) return fail(reason);
      await tx.delete(farmObjects).where(and(
        eq(farmObjects.farmId, farm.id), eq(farmObjects.column, input.target.column),
        eq(farmObjects.row, input.target.row), inArray(farmObjects.type, [...farmDecorationTypes])
      ));
      const [updated] = await tx.update(farms).set({ roads: [...snapshot.farm.roads, { ...input.target, completesAt: now + ROAD_CONSTRUCTION_DURATION_MS }], version: sql`${farms.version} + 1`, updatedAt: new Date(now) }).where(eq(farms.id, farm.id)).returning();
      return readFarmSnapshot(tx, updated!, false);
    }), catch: cause => new RoadPersistenceError({ cause })
  });
  return result instanceof RoadRuleError ? yield* Effect.fail(result) : result;
});
