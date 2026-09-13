import { and, eq, isNull, lte, sql } from "drizzle-orm";
import { Clock, Data, Effect } from "effect";
import { match } from "ts-pattern";

import {
  isConnectedToIrrigationSource,
  validateIrrigationLocation,
  type FarmCoordinate
} from "../../game-core/farm/irrigation";
import { getBuildingFootprint } from "../../game-core/farm/buildings";
import { FARM_IMPROVEMENT_DEFINITIONS } from "../../game-data/farmImprovements";
import type { FarmSnapshot } from "../../schemas/farm";
import type { Database } from "../db/client";
import {
  farmCrops,
  farmBuildings,
  farmGroundItems,
  farmImprovements,
  farmObjects,
  farms
} from "../db/schema";
import { readFarmSnapshot } from "./farmSnapshot";
import { advanceFarmLifecycle } from "./farmLifecycle";
import { removeCompletedImprovementDestructions } from "./farmImprovementLifecycle";

export class IrrigationFarmNotFoundError extends Data.TaggedError(
  "IrrigationFarmNotFoundError"
)<Record<string, never>> {}

export class FarmVersionConflictError extends Data.TaggedError(
  "FarmVersionConflictError"
)<{
  readonly expectedVersion: number;
  readonly actualVersion: number;
}> {}

export class InvalidIrrigationLocationError extends Data.TaggedError(
  "InvalidIrrigationLocationError"
)<{
  readonly reason: "outside_world" | "river";
}> {}

export class IrrigationNotConnectedError extends Data.TaggedError(
  "IrrigationNotConnectedError"
)<Record<string, never>> {}

export class IrrigationTileOccupiedError extends Data.TaggedError(
  "IrrigationTileOccupiedError"
)<Record<string, never>> {}

export class IrrigationAlreadyExistsError extends Data.TaggedError(
  "IrrigationAlreadyExistsError"
)<Record<string, never>> {}

export class IrrigationPersistenceError extends Data.TaggedError(
  "IrrigationPersistenceError"
)<{
  readonly cause: unknown;
}> {}

export type BuildIrrigationError =
  | IrrigationFarmNotFoundError
  | FarmVersionConflictError
  | InvalidIrrigationLocationError
  | IrrigationNotConnectedError
  | IrrigationTileOccupiedError
  | IrrigationAlreadyExistsError
  | IrrigationPersistenceError;

type BuildIrrigationInput = {
  readonly playerId: string;
  readonly target: FarmCoordinate;
  readonly expectedFarmVersion: number;
};

type BuildDatabaseOutcome =
  | { readonly type: "success"; readonly snapshot: FarmSnapshot }
  | { readonly type: "farm_not_found" }
  | {
      readonly type: "version_conflict";
      readonly actualVersion: number;
    }
  | {
      readonly type: "invalid_location";
      readonly reason: "outside_world" | "river";
    }
  | { readonly type: "not_connected" }
  | { readonly type: "occupied" }
  | { readonly type: "already_exists" };

export const buildIrrigation = (
  database: Database,
  input: BuildIrrigationInput
): Effect.Effect<FarmSnapshot, BuildIrrigationError> =>
  Effect.gen(function* () {
    const currentTimeMillis = yield* Clock.currentTimeMillis;
    const startedAt = new Date(currentTimeMillis);
    const completesAt = new Date(
      currentTimeMillis +
        FARM_IMPROVEMENT_DEFINITIONS.irrigation.constructionDurationMs
    );

    const outcome = yield* Effect.tryPromise({
      try: (): Promise<BuildDatabaseOutcome> =>
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
            return { type: "farm_not_found" };
          }
          const farm = await advanceFarmLifecycle(
            transaction,
            loadedFarm,
            startedAt
          );

          if (farm.version !== input.expectedFarmVersion) {
            return {
              type: "version_conflict",
              actualVersion: farm.version
            };
          }

          await removeCompletedImprovementDestructions(
            transaction,
            farm.id,
            startedAt
          );

          const location = validateIrrigationLocation(input.target);

          if (location.type !== "valid") {
            return { type: "invalid_location", reason: location.type };
          }

          const [
            existingImprovement,
            occupyingGroundItem,
            occupyingObject,
            occupyingCrop,
            completedCanals,
            buildings
          ] =
            await Promise.all([
              transaction
                .select({ id: farmImprovements.id })
                .from(farmImprovements)
                .where(
                  and(
                    eq(farmImprovements.farmId, farm.id),
                    eq(farmImprovements.column, input.target.column),
                    eq(farmImprovements.row, input.target.row)
                  )
                )
                .limit(1),
              transaction
                .select({ id: farmGroundItems.id })
                .from(farmGroundItems)
                .where(
                  and(
                    eq(farmGroundItems.farmId, farm.id),
                    eq(farmGroundItems.column, input.target.column),
                    eq(farmGroundItems.row, input.target.row)
                  )
                )
                .limit(1),
              transaction
                .select({ id: farmObjects.id })
                .from(farmObjects)
                .where(
                  and(
                    eq(farmObjects.farmId, farm.id),
                    eq(farmObjects.column, input.target.column),
                    eq(farmObjects.row, input.target.row)
                  )
                )
                .limit(1),
              transaction
                .select({ id: farmCrops.id })
                .from(farmCrops)
                .where(
                  and(
                    eq(farmCrops.farmId, farm.id),
                    eq(farmCrops.column, input.target.column),
                    eq(farmCrops.row, input.target.row)
                  )
                )
                .limit(1),
              transaction
                .select({
                  column: farmImprovements.column,
                  row: farmImprovements.row
                })
                .from(farmImprovements)
                .where(
                  and(
                    eq(farmImprovements.farmId, farm.id),
                    eq(farmImprovements.type, "irrigation"),
                    lte(farmImprovements.completesAt, startedAt),
                    isNull(farmImprovements.destroyCompletesAt)
                  )
                ),
              transaction
                .select({
                  type: farmBuildings.type,
                  column: farmBuildings.column,
                  row: farmBuildings.row
                })
                .from(farmBuildings)
                .where(eq(farmBuildings.farmId, farm.id))
            ]);

          if (existingImprovement.length > 0) {
            return { type: "already_exists" };
          }

          if (
            occupyingObject.length > 0 ||
            occupyingGroundItem.length > 0 ||
            occupyingCrop.length > 0 ||
            buildings.some(building =>
              getBuildingFootprint(building.type, building).some(
                coordinate =>
                  coordinate.column === input.target.column &&
                  coordinate.row === input.target.row
              )
            )
          ) {
            return { type: "occupied" };
          }

          if (!isConnectedToIrrigationSource(input.target, completedCanals)) {
            return { type: "not_connected" };
          }

          const [createdImprovement] = await transaction
            .insert(farmImprovements)
            .values({
              farmId: farm.id,
              type: "irrigation",
              column: input.target.column,
              row: input.target.row,
              startedAt,
              completesAt
            })
            .onConflictDoNothing()
            .returning({ id: farmImprovements.id });

          if (createdImprovement === undefined) {
            return { type: "already_exists" };
          }

          const [updatedFarm] = await transaction
            .update(farms)
            .set({
              version: sql`${farms.version} + 1`,
              updatedAt: startedAt
            })
            .where(eq(farms.id, farm.id))
            .returning();

          if (updatedFarm === undefined) {
            return { type: "farm_not_found" };
          }

          return {
            type: "success",
            snapshot: await readFarmSnapshot(transaction, updatedFarm, false)
          };
        }),
      catch: cause => new IrrigationPersistenceError({ cause })
    });

    return yield* match(outcome)
      .with({ type: "success" }, ({ snapshot }) => Effect.succeed(snapshot))
      .with({ type: "farm_not_found" }, () =>
        Effect.fail(new IrrigationFarmNotFoundError({}))
      )
      .with({ type: "version_conflict" }, ({ actualVersion }) =>
        Effect.fail(
          new FarmVersionConflictError({
            expectedVersion: input.expectedFarmVersion,
            actualVersion
          })
        )
      )
      .with({ type: "invalid_location" }, ({ reason }) =>
        Effect.fail(new InvalidIrrigationLocationError({ reason }))
      )
      .with({ type: "not_connected" }, () =>
        Effect.fail(new IrrigationNotConnectedError({}))
      )
      .with({ type: "occupied" }, () =>
        Effect.fail(new IrrigationTileOccupiedError({}))
      )
      .with({ type: "already_exists" }, () =>
        Effect.fail(new IrrigationAlreadyExistsError({}))
      )
      .exhaustive();
  });
