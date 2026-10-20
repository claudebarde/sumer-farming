import { farmerProductionJob } from "../../game-core/farm/farmerProduction";
import { and, eq, inArray, sql } from "drizzle-orm";
import { farmDecorationTypes, isClearableScenery } from "../../game-data/farmObjects";
import { ROAD_CONSTRUCTION_DURATION_MS, roadIsComplete } from "../../game-data/roads";
import { Data, Effect } from "effect";
import { getBuildingFootprint } from "../../game-core/farm/buildings";
import { roadKey, roadRemovalReason, validateRoadPlacement } from "../../game-core/farm/roads";
import { INITIAL_FARM_CONFIG } from "../../game-data/initialFarm";
import type { GameCommand } from "../../schemas/gameCommands";
import type { Database } from "../db/client";
import { farms, farmObjects } from "../db/schema";
import { readFarmSnapshot } from "./farmSnapshot";
import { porterPath, porterRoadRemovalReason } from "../../game-core/farm/porter";
import { roadNeighbors } from "../../game-core/farm/roads";
import { WORKER_MOVE_DURATION_PER_TILE } from "../../game-data/movement";

export class RoadRuleError extends Data.TaggedError("RoadRuleError")<{ readonly message: string }> {}
export class RoadPersistenceError extends Data.TaggedError("RoadPersistenceError")<{ readonly cause: unknown }> {}

export const buildRoad = (database: Database, input: Extract<GameCommand, { type: "build_road" | "destroy_road" }> & { readonly playerId: string }) => Effect.gen(function* () {
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
      const reason = input.type === "destroy_road"
        ? porterRoadRemovalReason(snapshot.farm.production.porter, input.target) ?? roadRemovalReason(input.target, snapshot.farm.roads, snapshot.buildings.flatMap(b => b.loadingTile ? [b.loadingTile] : []), now)
        : validateRoadPlacement(input.target, snapshot.farm.roads, occupied, now);
      if (reason) return fail(reason);
      const buildings = snapshot.buildings.map(b => ({ ...b, completesAt: Date.parse(b.completesAt) }));
      const obstacles = [...snapshot.objects, ...snapshot.improvements.filter(i => i.row !== INITIAL_FARM_CONFIG.roadRow), input.target];
      const paths = roadNeighbors(input.target).flatMap(tile => {
        const path = porterPath(buildings, snapshot.farm.roads, input.farmerPosition ?? INITIAL_FARM_CONFIG.farmerSpawn, tile, now, obstacles);
        return path ? [path] : [];
      });
      const approachPath = paths.sort((a, b) => a.length - b.length)[0];
      if (!approachPath) return fail("The farmer cannot reach this road tile.");
      const completesAt = now + (approachPath.length - 1) * WORKER_MOVE_DURATION_PER_TILE + ROAD_CONSTRUCTION_DURATION_MS;
      if (input.type === "destroy_road") {
        const roads = snapshot.farm.roads.map(road => roadKey(road) === roadKey(input.target)
          ? { ...road, removing: true, approachPath, completesAt } : road);
        const [updated] = await tx.update(farms).set({ roads, version: sql`${farms.version} + 1`, updatedAt: new Date(now) })
          .where(eq(farms.id, farm.id)).returning();
        return readFarmSnapshot(tx, updated!, false);
      }
      await tx.delete(farmObjects).where(and(
        eq(farmObjects.farmId, farm.id), eq(farmObjects.column, input.target.column),
        eq(farmObjects.row, input.target.row), inArray(farmObjects.type, [...farmDecorationTypes])
      ));
      const [updated] = await tx.update(farms).set({ roads: [...snapshot.farm.roads, { ...input.target, approachPath, completesAt }], version: sql`${farms.version} + 1`, updatedAt: new Date(now) }).where(eq(farms.id, farm.id)).returning();
      return readFarmSnapshot(tx, updated!, false);
    }), catch: cause => new RoadPersistenceError({ cause })
  });
  return result instanceof RoadRuleError ? yield* Effect.fail(result) : result;
});
