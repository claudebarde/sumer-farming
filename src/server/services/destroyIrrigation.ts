import { assertFarmerAvailable, FarmerUnavailableError } from "./farmerAvailability";
import { and, eq, isNull, sql } from "drizzle-orm";
import { Clock, Data, Effect } from "effect";
import { match } from "ts-pattern";

import {
  areAllCanalsConnectedToRiver,
  type FarmCoordinate
} from "../../game-core/farm/irrigation";
import { isIrrigatedByCanals } from "../../game-core/farm/cultivation";
import { FARM_IMPROVEMENT_DEFINITIONS } from "../../game-data/farmImprovements";
import type { FarmSnapshot } from "../../schemas/farm";
import type { Database } from "../db/client";
import { farmCrops, farmImprovements, farms } from "../db/schema";
import {
  FarmVersionConflictError,
  IrrigationFarmNotFoundError
} from "./buildIrrigation";
import { removeCompletedImprovementDestructions } from "./farmImprovementLifecycle";
import { readFarmSnapshot } from "./farmSnapshot";
import { advanceFarmLifecycle } from "./farmLifecycle";

export class IrrigationNotFoundError extends Data.TaggedError(
  "IrrigationNotFoundError"
)<Record<string, never>> {}

export class IrrigationNotCompleteError extends Data.TaggedError(
  "IrrigationNotCompleteError"
)<Record<string, never>> {}

export class IrrigationAlreadyBeingDestroyedError extends Data.TaggedError(
  "IrrigationAlreadyBeingDestroyedError"
)<Record<string, never>> {}

export class IrrigationHasDependentsError extends Data.TaggedError(
  "IrrigationHasDependentsError"
)<Record<string, never>> {}

export class IrrigationDestructionPersistenceError extends Data.TaggedError(
  "IrrigationDestructionPersistenceError"
)<{
  readonly cause: unknown;
}> {}

export type DestroyIrrigationError = FarmerUnavailableError
  | IrrigationFarmNotFoundError
  | FarmVersionConflictError
  | IrrigationNotFoundError
  | IrrigationNotCompleteError
  | IrrigationAlreadyBeingDestroyedError
  | IrrigationHasDependentsError
  | IrrigationDestructionPersistenceError;

type DestroyIrrigationInput = {
  readonly playerId: string;
  readonly target: FarmCoordinate;
  readonly expectedFarmVersion: number;
};

type DestroyDatabaseOutcome =
  | { readonly type: "success"; readonly snapshot: FarmSnapshot }
  | { readonly type: "farm_not_found" }
  | { readonly type: "version_conflict"; readonly actualVersion: number }
  | { readonly type: "irrigation_not_found" }
  | { readonly type: "irrigation_not_complete" }
  | { readonly type: "already_being_destroyed" }
  | { readonly type: "has_dependents" };

const isSameCoordinate = (
  first: FarmCoordinate,
  second: FarmCoordinate
): boolean => first.column === second.column && first.row === second.row;

export const destroyIrrigation = (
  database: Database,
  input: DestroyIrrigationInput
): Effect.Effect<FarmSnapshot, DestroyIrrigationError> =>
  Effect.gen(function* () {
    const currentTimeMillis = yield* Clock.currentTimeMillis;
    const startedAt = new Date(currentTimeMillis);
    const completesAt = new Date(
      currentTimeMillis +
        FARM_IMPROVEMENT_DEFINITIONS.irrigation.destructionDurationMs
    );

    const outcome = yield* Effect.tryPromise({
      try: (): Promise<DestroyDatabaseOutcome> =>
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
          assertFarmerAvailable(farm);

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

          const irrigation = (
            await transaction
              .select()
              .from(farmImprovements)
              .where(
                and(
                  eq(farmImprovements.farmId, farm.id),
                  eq(farmImprovements.type, "irrigation"),
                  eq(farmImprovements.column, input.target.column),
                  eq(farmImprovements.row, input.target.row)
                )
              )
              .limit(1)
          )[0];

          if (irrigation === undefined) {
            return { type: "irrigation_not_found" };
          }

          if (irrigation.destroyCompletesAt !== null) {
            return { type: "already_being_destroyed" };
          }

          if (irrigation.completesAt > startedAt) {
            return { type: "irrigation_not_complete" };
          }

          const [activeCanals, crops] = await Promise.all([
            transaction
              .select({
                column: farmImprovements.column,
                row: farmImprovements.row,
                completesAt: farmImprovements.completesAt
              })
              .from(farmImprovements)
              .where(
                and(
                  eq(farmImprovements.farmId, farm.id),
                  eq(farmImprovements.type, "irrigation"),
                  isNull(farmImprovements.destroyCompletesAt)
                )
              ),
            transaction
              .select({
                column: farmCrops.column,
                row: farmCrops.row
              })
              .from(farmCrops)
              .where(eq(farmCrops.farmId, farm.id))
          ]);
          const remainingCanals = activeCanals.filter(
            canal => !isSameCoordinate(canal, input.target)
          );
          const completedRemainingCanals = remainingCanals.filter(
            canal => canal.completesAt <= startedAt
          );

          if (
            !areAllCanalsConnectedToRiver(remainingCanals) ||
            crops.some(
              crop => !isIrrigatedByCanals(crop, completedRemainingCanals)
            )
          ) {
            return { type: "has_dependents" };
          }

          const [updatedIrrigation] = await transaction
            .update(farmImprovements)
            .set({
              destroyStartedAt: startedAt,
              destroyCompletesAt: completesAt
            })
            .where(
              and(
                eq(farmImprovements.id, irrigation.id),
                isNull(farmImprovements.destroyCompletesAt)
              )
            )
            .returning({ id: farmImprovements.id });

          if (updatedIrrigation === undefined) {
            return { type: "already_being_destroyed" };
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
      catch: cause => cause instanceof FarmerUnavailableError ? cause : new IrrigationDestructionPersistenceError({ cause })
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
      .with({ type: "irrigation_not_found" }, () =>
        Effect.fail(new IrrigationNotFoundError({}))
      )
      .with({ type: "irrigation_not_complete" }, () =>
        Effect.fail(new IrrigationNotCompleteError({}))
      )
      .with({ type: "already_being_destroyed" }, () =>
        Effect.fail(new IrrigationAlreadyBeingDestroyedError({}))
      )
      .with({ type: "has_dependents" }, () =>
        Effect.fail(new IrrigationHasDependentsError({}))
      )
      .exhaustive();
  });
