import { eq, sql } from "drizzle-orm";
import { Clock, Data, Effect } from "effect";
import { match } from "ts-pattern";

import {
  validateCultivation,
  type CultivationValidation
} from "../../game-core/farm/cultivation";
import type { FarmCoordinate } from "../../game-core/farm/irrigation";
import { getBuildingFootprint } from "../../game-core/farm/buildings";
import {
  CROP_DEFINITIONS,
  type CropKey
} from "../../game-data/crops";
import { INITIAL_FARM_CONFIG } from "../../game-data/initialFarm";
import { BARLEY_CONSUMPTION_INTERVAL_MS } from "../../game-data/household";
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
import { removeCompletedImprovementDestructions } from "./farmImprovementLifecycle";
import { readFarmSnapshot } from "./farmSnapshot";
import { advanceFarmLifecycle } from "./farmLifecycle";

type CultivationRuleViolation = Exclude<
  CultivationValidation,
  { readonly type: "valid" }
>;

export type PlantCropRule =
  | { readonly type: "farm_not_found" }
  | {
      readonly type: "version_conflict";
      readonly expectedVersion: number;
      readonly actualVersion: number;
    }
  | CultivationRuleViolation;

export class PlantCropRuleError extends Data.TaggedError(
  "PlantCropRuleError"
)<{
  readonly rule: PlantCropRule;
}> {}

export class PlantCropPersistenceError extends Data.TaggedError(
  "PlantCropPersistenceError"
)<{
  readonly cause: unknown;
}> {}

export type PlantCropError = PlantCropRuleError | PlantCropPersistenceError;

type PlantCropInput = {
  readonly playerId: string;
  readonly crop: CropKey;
  readonly target: FarmCoordinate;
  readonly expectedFarmVersion: number;
};

type DatabaseOutcome =
  | { readonly type: "success"; readonly snapshot: FarmSnapshot }
  | { readonly type: "rule_error"; readonly rule: PlantCropRule };

const farmBuildingCoordinates = (): readonly FarmCoordinate[] => {
  const coordinates: FarmCoordinate[] = [];
  const { buildingBounds } = INITIAL_FARM_CONFIG;

  for (
    let row = buildingBounds.minimumRow;
    row <= buildingBounds.maximumRow;
    row += 1
  ) {
    for (
      let column = buildingBounds.minimumColumn;
      column <= buildingBounds.maximumColumn;
      column += 1
    ) {
      coordinates.push({ column, row });
    }
  }

  return coordinates;
};

export const plantCrop = (
  database: Database,
  input: PlantCropInput
): Effect.Effect<FarmSnapshot, PlantCropError> =>
  Effect.gen(function* () {
    const currentTimeMillis = yield* Clock.currentTimeMillis;
    const sowingStartedAt = new Date(currentTimeMillis);
    const plantedAt = new Date(
      currentTimeMillis + CROP_DEFINITIONS[input.crop].sowingDurationMs
    );
    const growthCompletesAt = new Date(
      plantedAt.getTime() + CROP_DEFINITIONS[input.crop].growthDurationMs
    );

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
            sowingStartedAt
          );

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

          await removeCompletedImprovementDestructions(
            transaction,
            farm.id,
            sowingStartedAt
          );

          const [groundItems, objects, improvements, crops, buildings] =
            await Promise.all([
              transaction
                .select({
                  column: farmGroundItems.column,
                  row: farmGroundItems.row
                })
                .from(farmGroundItems)
                .where(eq(farmGroundItems.farmId, farm.id)),
              transaction
                .select({
                  column: farmObjects.column,
                  row: farmObjects.row
                })
                .from(farmObjects)
                .where(eq(farmObjects.farmId, farm.id)),
              transaction
                .select({
                  type: farmImprovements.type,
                  column: farmImprovements.column,
                  row: farmImprovements.row,
                  completesAt: farmImprovements.completesAt,
                  destroyCompletesAt: farmImprovements.destroyCompletesAt
                })
                .from(farmImprovements)
                .where(eq(farmImprovements.farmId, farm.id)),
              transaction
                .select({
                  column: farmCrops.column,
                  row: farmCrops.row
                })
                .from(farmCrops)
                .where(eq(farmCrops.farmId, farm.id)),
              transaction
                .select({
                  type: farmBuildings.type,
                  column: farmBuildings.column,
                  row: farmBuildings.row
                })
                .from(farmBuildings)
                .where(eq(farmBuildings.farmId, farm.id))
            ]);

          const occupiedCoordinates = [
            ...farmBuildingCoordinates(),
            ...groundItems,
            ...objects,
            ...improvements,
            ...crops,
            ...buildings.flatMap(building =>
              getBuildingFootprint(building.type, building)
            )
          ];
          const activeCanals = improvements.filter(
            improvement =>
              improvement.type === "irrigation" &&
              improvement.completesAt <= sowingStartedAt &&
              improvement.destroyCompletesAt === null
          );
          const validation = validateCultivation({
            target: input.target,
            crop: input.crop,
            carriedItem: farm.carriedItemKey,
            occupiedCoordinates,
            activeCanals
          });

          if (validation.type !== "valid") {
            return { type: "rule_error", rule: validation };
          }

          const [createdCrop] = await transaction
            .insert(farmCrops)
            .values({
              farmId: farm.id,
              cropKey: input.crop,
              column: input.target.column,
              row: input.target.row,
              sowingStartedAt,
              plantedAt,
              growthCompletesAt
            })
            .onConflictDoNothing()
            .returning({ id: farmCrops.id });

          if (createdCrop === undefined) {
            return { type: "rule_error", rule: { type: "tile_occupied" } };
          }

          const [updatedFarm] = await transaction
            .update(farms)
            .set({
              carriedItemKey:
                farm.carriedItemQuantity === 1
                  ? null
                  : farm.carriedItemKey,
              carriedItemQuantity: farm.carriedItemQuantity - 1,
              carriedItemExpiresAt:
                farm.carriedItemQuantity === 1
                  ? null
                  : farm.carriedItemExpiresAt,
              cultivationStartedAt:
                farm.cultivationStartedAt ?? sowingStartedAt,
              nextBarleyConsumptionAt:
                farm.nextBarleyConsumptionAt ??
                new Date(
                  sowingStartedAt.getTime() +
                    BARLEY_CONSUMPTION_INTERVAL_MS
                ),
              version: sql`${farms.version} + 1`,
              updatedAt: sowingStartedAt
            })
            .where(eq(farms.id, farm.id))
            .returning();

          if (updatedFarm === undefined) {
            return { type: "rule_error", rule: { type: "farm_not_found" } };
          }

          return {
            type: "success",
            snapshot: await readFarmSnapshot(transaction, updatedFarm, false)
          };
        }),
      catch: cause => new PlantCropPersistenceError({ cause })
    });

    return yield* match(outcome)
      .with({ type: "success" }, ({ snapshot }) => Effect.succeed(snapshot))
      .with({ type: "rule_error" }, ({ rule }) =>
        Effect.fail(new PlantCropRuleError({ rule }))
      )
      .exhaustive();
  });
