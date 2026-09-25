import { assertFarmerAvailable, FarmerUnavailableError } from "./farmerAvailability";
import { and, eq, sql } from "drizzle-orm";
import { Clock, Data, Effect } from "effect";
import { match } from "ts-pattern";

import type { FarmCoordinate } from "../../game-core/farm/irrigation";
import { getBuildingFootprint } from "../../game-core/farm/buildings";
import { INITIAL_FARM_CONFIG } from "../../game-data/initialFarm";
import {
  RESOURCE_DEFINITIONS,
  type GatherableResourceKey
} from "../../game-data/resources";
import type { FarmSnapshot } from "../../schemas/farm";
import type { Database, DatabaseTransaction } from "../db/client";
import {
  farmCrops,
  farmBuildings,
  farmGroundItems,
  farmImprovements,
  farmObjects,
  farms
} from "../db/schema";
import { removeCompletedImprovementDestructions } from "./farmImprovementLifecycle";
import { readFarmSnapshot } from "./farmSnapshot";
import { advanceFarmLifecycle } from "./farmLifecycle";

type GatherResourceRule =
  | { readonly type: "farm_not_found" }
  | {
      readonly type: "version_conflict";
      readonly expectedVersion: number;
      readonly actualVersion: number;
    }
  | { readonly type: "hands_not_empty" }
  | { readonly type: "gathering_in_progress" }
  | { readonly type: "gathering_not_started" }
  | { readonly type: "gathering_not_complete" }
  | { readonly type: "invalid_resource_location" }
  | { readonly type: "resource_not_found" };

export class GatherResourceRuleError extends Data.TaggedError(
  "GatherResourceRuleError"
)<{
  readonly rule: GatherResourceRule;
}> {}

export class GatherResourcePersistenceError extends Data.TaggedError(
  "GatherResourcePersistenceError"
)<{
  readonly cause: unknown;
}> {}

export type GatherResourceError = FarmerUnavailableError
  | GatherResourceRuleError
  | GatherResourcePersistenceError;

type StartGatherResourceInput = {
  readonly playerId: string;
  readonly itemKey: GatherableResourceKey;
  readonly target: FarmCoordinate;
  readonly expectedFarmVersion: number;
};

type CompleteGatherResourceInput = {
  readonly playerId: string;
  readonly expectedFarmVersion: number;
};

type DatabaseOutcome =
  | { readonly type: "success"; readonly snapshot: FarmSnapshot }
  | { readonly type: "rule_error"; readonly rule: GatherResourceRule };

const isInsideWorld = ({ column, row }: FarmCoordinate): boolean => {
  const { worldBounds } = INITIAL_FARM_CONFIG;

  return (
    column >= worldBounds.minimumColumn &&
    column <= worldBounds.maximumColumn &&
    row >= worldBounds.minimumRow &&
    row <= worldBounds.maximumRow
  );
};

const isAdjacentToRiver = ({ row }: FarmCoordinate): boolean =>
  Math.abs(row - INITIAL_FARM_CONFIG.riverRow) === 1;

const isTileEmpty = async (
  transaction: DatabaseTransaction,
  farmId: string,
  target: FarmCoordinate
): Promise<boolean> => {
  const [groundItems, crops, improvements, objects, buildings] =
    await Promise.all([
    transaction
      .select({ id: farmGroundItems.id })
      .from(farmGroundItems)
      .where(
        and(
          eq(farmGroundItems.farmId, farmId),
          eq(farmGroundItems.column, target.column),
          eq(farmGroundItems.row, target.row)
        )
      )
      .limit(1),
    transaction
      .select({ id: farmCrops.id })
      .from(farmCrops)
      .where(
        and(
          eq(farmCrops.farmId, farmId),
          eq(farmCrops.column, target.column),
          eq(farmCrops.row, target.row)
        )
      )
      .limit(1),
    transaction
      .select({ id: farmImprovements.id })
      .from(farmImprovements)
      .where(
        and(
          eq(farmImprovements.farmId, farmId),
          eq(farmImprovements.column, target.column),
          eq(farmImprovements.row, target.row)
        )
      )
      .limit(1),
    transaction
      .select({ id: farmObjects.id })
      .from(farmObjects)
      .where(
        and(
          eq(farmObjects.farmId, farmId),
          eq(farmObjects.column, target.column),
          eq(farmObjects.row, target.row)
        )
      )
      .limit(1),
    transaction
      .select({
        type: farmBuildings.type,
        column: farmBuildings.column,
        row: farmBuildings.row
      })
      .from(farmBuildings)
      .where(eq(farmBuildings.farmId, farmId))
  ]);

  return (
    [groundItems, crops, improvements, objects].every(
      occupants => occupants.length === 0
    ) &&
    !buildings.some(building =>
      getBuildingFootprint(building.type, building).some(
        position =>
          position.column === target.column && position.row === target.row
      )
    )
  );
};

const hasReedSource = async (
  transaction: DatabaseTransaction,
  farmId: string,
  target: FarmCoordinate
): Promise<boolean> =>
  (
    await transaction
      .select({ id: farmObjects.id })
      .from(farmObjects)
      .where(
        and(
          eq(farmObjects.farmId, farmId),
          eq(farmObjects.type, "reeds"),
          eq(farmObjects.column, target.column),
          eq(farmObjects.row, target.row)
        )
      )
      .limit(1)
  ).length === 1;

export const startGatherResource = (
  database: Database,
  input: StartGatherResourceInput
): Effect.Effect<FarmSnapshot, GatherResourceError> =>
  Effect.gen(function* () {
    const currentTimeMillis = yield* Clock.currentTimeMillis;
    const now = new Date(currentTimeMillis);
    const outcome = yield* Effect.tryPromise({
      try: (): Promise<DatabaseOutcome> =>
        database.transaction(async transaction => {
          const loadedFarm = (
            await transaction
              .select()
              .from(farms)
              .where(eq(farms.playerId, input.playerId))
              .limit(1)
              .for("update")
          )[0];

          if (loadedFarm === undefined) {
            return { type: "rule_error", rule: { type: "farm_not_found" } };
          }
          const farm = await advanceFarmLifecycle(
            transaction,
            loadedFarm,
            now
          );
          assertFarmerAvailable(farm);

          if (farm.version !== input.expectedFarmVersion) {
            return {
              type: "rule_error",
              rule: {
                type: "version_conflict",
                expectedVersion: input.expectedFarmVersion,
                actualVersion: farm.version
              }
            };
          }

          if (farm.gatheringItemKey !== null) {
            const isSameGathering =
              farm.gatheringItemKey === input.itemKey &&
              farm.gatheringColumn === input.target.column &&
              farm.gatheringRow === input.target.row;

            return isSameGathering
              ? {
                  type: "success",
                  snapshot: await readFarmSnapshot(transaction, farm, false)
                }
              : {
                  type: "rule_error",
                  rule: { type: "gathering_in_progress" }
                };
          }

          if (farm.carriedItemKey !== null) {
            return {
              type: "rule_error",
              rule: { type: "hands_not_empty" }
            };
          }

          await removeCompletedImprovementDestructions(
            transaction,
            farm.id,
            now
          );

          const validLocation =
            isInsideWorld(input.target) &&
            isAdjacentToRiver(input.target) &&
            (input.itemKey === "reed"
              ? await hasReedSource(transaction, farm.id, input.target)
              : await isTileEmpty(transaction, farm.id, input.target));

          if (!validLocation) {
            return {
              type: "rule_error",
              rule: {
                type:
                  input.itemKey === "reed"
                    ? "resource_not_found"
                    : "invalid_resource_location"
              }
            };
          }

          const completesAt = new Date(
            currentTimeMillis +
              RESOURCE_DEFINITIONS[input.itemKey].gatheringDurationMs
          );
          const [updatedFarm] = await transaction
            .update(farms)
            .set({
              gatheringItemKey: input.itemKey,
              gatheringColumn: input.target.column,
              gatheringRow: input.target.row,
              gatheringStartedAt: now,
              gatheringCompletesAt: completesAt,
              version: sql`${farms.version} + 1`,
              updatedAt: now
            })
            .where(eq(farms.id, farm.id))
            .returning();

          return updatedFarm === undefined
            ? { type: "rule_error", rule: { type: "farm_not_found" } }
            : {
                type: "success",
                snapshot: await readFarmSnapshot(
                  transaction,
                  updatedFarm,
                  false
                )
              };
        }),
      catch: cause => cause instanceof FarmerUnavailableError ? cause : new GatherResourcePersistenceError({ cause })
    });

    return yield* match(outcome)
      .with({ type: "success" }, ({ snapshot }) => Effect.succeed(snapshot))
      .with({ type: "rule_error" }, ({ rule }) =>
        Effect.fail(new GatherResourceRuleError({ rule }))
      )
      .exhaustive();
  });

export const completeGatherResource = (
  database: Database,
  input: CompleteGatherResourceInput
): Effect.Effect<FarmSnapshot, GatherResourceError> =>
  Effect.gen(function* () {
    const currentTimeMillis = yield* Clock.currentTimeMillis;
    const now = new Date(currentTimeMillis);
    const outcome = yield* Effect.tryPromise({
      try: (): Promise<DatabaseOutcome> =>
        database.transaction(async transaction => {
          const loadedFarm = (
            await transaction
              .select()
              .from(farms)
              .where(eq(farms.playerId, input.playerId))
              .limit(1)
              .for("update")
          )[0];

          if (loadedFarm === undefined) {
            return { type: "rule_error", rule: { type: "farm_not_found" } };
          }
          const farm = await advanceFarmLifecycle(
            transaction,
            loadedFarm,
            now
          );
          assertFarmerAvailable(farm);

          if (farm.version !== input.expectedFarmVersion) {
            return {
              type: "rule_error",
              rule: {
                type: "version_conflict",
                expectedVersion: input.expectedFarmVersion,
                actualVersion: farm.version
              }
            };
          }

          if (
            farm.gatheringItemKey === null ||
            farm.gatheringColumn === null ||
            farm.gatheringRow === null ||
            farm.gatheringCompletesAt === null
          ) {
            return {
              type: "rule_error",
              rule: { type: "gathering_not_started" }
            };
          }

          if (currentTimeMillis < farm.gatheringCompletesAt.getTime()) {
            return {
              type: "rule_error",
              rule: { type: "gathering_not_complete" }
            };
          }

          if (farm.carriedItemKey !== null) {
            return {
              type: "rule_error",
              rule: { type: "hands_not_empty" }
            };
          }

          const [updatedFarm] = await transaction
            .update(farms)
            .set({
              carriedItemKey: farm.gatheringItemKey,
              carriedItemQuantity: 1,
              carriedItemExpiresAt: null,
              gatheringItemKey: null,
              gatheringColumn: null,
              gatheringRow: null,
              gatheringStartedAt: null,
              gatheringCompletesAt: null,
              version: sql`${farms.version} + 1`,
              updatedAt: now
            })
            .where(eq(farms.id, farm.id))
            .returning();

          return updatedFarm === undefined
            ? { type: "rule_error", rule: { type: "farm_not_found" } }
            : {
                type: "success",
                snapshot: await readFarmSnapshot(
                  transaction,
                  updatedFarm,
                  false
                )
              };
        }),
      catch: cause => cause instanceof FarmerUnavailableError ? cause : new GatherResourcePersistenceError({ cause })
    });

    return yield* match(outcome)
      .with({ type: "success" }, ({ snapshot }) => Effect.succeed(snapshot))
      .with({ type: "rule_error" }, ({ rule }) =>
        Effect.fail(new GatherResourceRuleError({ rule }))
      )
      .exhaustive();
  });
