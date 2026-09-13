import { and, eq, isNotNull, sql } from "drizzle-orm";
import { Clock, Data, Effect } from "effect";
import { match } from "ts-pattern";

import {
  validateHarvestCompletion,
  validateHarvestStart,
  type HarvestCompletionValidation,
  type HarvestStartValidation
} from "../../game-core/farm/harvesting";
import type { FarmCoordinate } from "../../game-core/farm/irrigation";
import { CROP_DEFINITIONS } from "../../game-data/crops";
import { EXPOSED_BARLEY_LIFETIME_MS } from "../../game-data/household";
import type { FarmSnapshot } from "../../schemas/farm";
import type { Database } from "../db/client";
import { farmCrops, farms } from "../db/schema";
import { readFarmSnapshot } from "./farmSnapshot";
import { advanceFarmLifecycle } from "./farmLifecycle";

type HarvestValidationViolation = Exclude<
  HarvestStartValidation | HarvestCompletionValidation,
  { readonly type: "valid" }
>;

export type HarvestCropRule =
  | { readonly type: "farm_not_found" }
  | { readonly type: "crop_not_found" }
  | { readonly type: "harvest_in_progress" }
  | {
      readonly type: "version_conflict";
      readonly expectedVersion: number;
      readonly actualVersion: number;
    }
  | HarvestValidationViolation;

export class HarvestCropRuleError extends Data.TaggedError(
  "HarvestCropRuleError"
)<{
  readonly rule: HarvestCropRule;
}> {}

export class HarvestCropPersistenceError extends Data.TaggedError(
  "HarvestCropPersistenceError"
)<{
  readonly cause: unknown;
}> {}

export type HarvestCropError =
  | HarvestCropRuleError
  | HarvestCropPersistenceError;

type HarvestCropInput = {
  readonly playerId: string;
  readonly target: FarmCoordinate;
  readonly expectedFarmVersion: number;
};

type HarvestAction =
  | { readonly type: "start"; readonly input: HarvestCropInput }
  | { readonly type: "complete"; readonly input: HarvestCropInput };

type DatabaseOutcome =
  | { readonly type: "success"; readonly snapshot: FarmSnapshot }
  | { readonly type: "rule_error"; readonly rule: HarvestCropRule };

const executeHarvestAction = (
  database: Database,
  action: HarvestAction
): Effect.Effect<FarmSnapshot, HarvestCropError> =>
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
              .where(eq(farms.playerId, action.input.playerId))
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

          if (farm.version !== action.input.expectedFarmVersion) {
            return {
              type: "rule_error",
              rule: {
                type: "version_conflict",
                expectedVersion: action.input.expectedFarmVersion,
                actualVersion: farm.version
              }
            };
          }

          const crop = (
            await transaction
              .select()
              .from(farmCrops)
              .where(
                and(
                  eq(farmCrops.farmId, farm.id),
                  eq(farmCrops.column, action.input.target.column),
                  eq(farmCrops.row, action.input.target.row)
                )
              )
              .limit(1)
              .for("update")
          )[0];

          if (crop === undefined) {
            return { type: "rule_error", rule: { type: "crop_not_found" } };
          }

          return match(action)
            .returnType<Promise<DatabaseOutcome>>()
            .with({ type: "start" }, async () => {
              const otherHarvest = (
                await transaction
                  .select({ id: farmCrops.id })
                  .from(farmCrops)
                  .where(
                    and(
                      eq(farmCrops.farmId, farm.id),
                      isNotNull(farmCrops.harvestStartedAt)
                    )
                  )
                  .limit(1)
              )[0];

              if (otherHarvest !== undefined && otherHarvest.id !== crop.id) {
                return {
                  type: "rule_error",
                  rule: { type: "harvest_in_progress" }
                };
              }

              const validation = validateHarvestStart({
                now: currentTimeMillis,
                growthCompletesAt: crop.growthCompletesAt.getTime(),
                harvestStartedAt: crop.harvestStartedAt?.getTime() ?? null,
                carriedItemQuantity: farm.carriedItemQuantity
              });

              if (validation.type !== "valid") {
                return { type: "rule_error", rule: validation };
              }

              const harvestCompletesAt = new Date(
                currentTimeMillis +
                  CROP_DEFINITIONS[crop.cropKey].harvestDurationMs
              );

              await transaction
                .update(farmCrops)
                .set({
                  harvestStartedAt: now,
                  harvestCompletesAt
                })
                .where(eq(farmCrops.id, crop.id));

              const [updatedFarm] = await transaction
                .update(farms)
                .set({
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
            })
            .with({ type: "complete" }, async () => {
              const validation = validateHarvestCompletion({
                now: currentTimeMillis,
                harvestCompletesAt:
                  crop.harvestCompletesAt?.getTime() ?? null,
                carriedItemQuantity: farm.carriedItemQuantity
              });

              if (validation.type !== "valid") {
                return { type: "rule_error", rule: validation };
              }

              const cropDefinition = CROP_DEFINITIONS[crop.cropKey];

              await transaction
                .delete(farmCrops)
                .where(eq(farmCrops.id, crop.id));

              const [updatedFarm] = await transaction
                .update(farms)
                .set({
                  carriedItemKey: cropDefinition.harvestItemKey,
                  carriedItemQuantity: cropDefinition.harvestYield,
                  carriedItemExpiresAt: new Date(
                    now.getTime() + EXPOSED_BARLEY_LIFETIME_MS
                  ),
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
            })
            .exhaustive();
        }),
      catch: cause => new HarvestCropPersistenceError({ cause })
    });

    return yield* match(outcome)
      .with({ type: "success" }, ({ snapshot }) => Effect.succeed(snapshot))
      .with({ type: "rule_error" }, ({ rule }) =>
        Effect.fail(new HarvestCropRuleError({ rule }))
      )
      .exhaustive();
  });

export const startHarvestCrop = (
  database: Database,
  input: HarvestCropInput
): Effect.Effect<FarmSnapshot, HarvestCropError> =>
  executeHarvestAction(database, { type: "start", input });

export const completeHarvestCrop = (
  database: Database,
  input: HarvestCropInput
): Effect.Effect<FarmSnapshot, HarvestCropError> =>
  executeHarvestAction(database, { type: "complete", input });
