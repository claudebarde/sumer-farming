import { eq, sql } from "drizzle-orm";
import { Clock, Data, Effect } from "effect";
import { match } from "ts-pattern";

import {
  getBuildingFootprint,
  validateBuildingPlacement,
  type BuildingCoordinate,
  type BuildingPlacementRule
} from "../../game-core/farm/buildings";
import { FARM_BUILDING_DEFINITIONS } from "../../game-data/buildings";
import { INITIAL_FARM_CONFIG } from "../../game-data/initialFarm";
import type { InventoryItemKey } from "../../game-data/inventoryItems";
import type { FarmSnapshot } from "../../schemas/farm";
import type { Database } from "../db/client";
import {
  farmBuildings,
  farmCrops,
  farmGroundItems,
  farmImprovements,
  farmObjects,
  farms
} from "../db/schema";
import { removeCompletedImprovementDestructions } from "./farmImprovementLifecycle";
import { readFarmSnapshot } from "./farmSnapshot";
import { advanceFarmLifecycle } from "./farmLifecycle";

type BuildGranaryRule =
  | { readonly type: "farm_not_found" }
  | {
      readonly type: "version_conflict";
      readonly expectedVersion: number;
      readonly actualVersion: number;
    }
  | { readonly type: "farmer_busy" }
  | Exclude<BuildingPlacementRule, { readonly type: "valid" }>;

export class BuildGranaryRuleError extends Data.TaggedError(
  "BuildGranaryRuleError"
)<{
  readonly rule: BuildGranaryRule;
}> {}

export class BuildGranaryPersistenceError extends Data.TaggedError(
  "BuildGranaryPersistenceError"
)<{
  readonly cause: unknown;
}> {}

export type BuildGranaryError =
  | BuildGranaryRuleError
  | BuildGranaryPersistenceError;

type BuildGranaryInput = {
  readonly playerId: string;
  readonly target: BuildingCoordinate;
  readonly expectedFarmVersion: number;
};

type DatabaseOutcome =
  | { readonly type: "success"; readonly snapshot: FarmSnapshot }
  | { readonly type: "rule_error"; readonly rule: BuildGranaryRule };

const coordinateKey = ({ column, row }: BuildingCoordinate): string =>
  `${column}:${row}`;

const addInitialFarmBuildingCoordinates = (coordinates: Set<string>): void => {
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
      coordinates.add(coordinateKey({ column, row }));
    }
  }
};

const consumeGroundMaterial = async (
  transaction: Parameters<Parameters<Database["transaction"]>[0]>[0],
  items: readonly (typeof farmGroundItems.$inferSelect)[],
  itemKey: InventoryItemKey,
  requiredQuantity: number
): Promise<void> => {
  let remaining = requiredQuantity;

  for (const item of items.filter(candidate => candidate.itemKey === itemKey)) {
    if (remaining === 0) {
      break;
    }

    const consumed = Math.min(remaining, item.quantity);

    if (consumed === item.quantity) {
      await transaction
        .delete(farmGroundItems)
        .where(eq(farmGroundItems.id, item.id));
    } else {
      await transaction
        .update(farmGroundItems)
        .set({ quantity: item.quantity - consumed })
        .where(eq(farmGroundItems.id, item.id));
    }

    remaining -= consumed;
  }
};

export const buildGranary = (
  database: Database,
  input: BuildGranaryInput
): Effect.Effect<FarmSnapshot, BuildGranaryError> =>
  Effect.gen(function* () {
    const currentTimeMillis = yield* Clock.currentTimeMillis;
    const startedAt = new Date(currentTimeMillis);
    const completesAt = new Date(
      currentTimeMillis +
        FARM_BUILDING_DEFINITIONS.granary.constructionDurationMs
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
            startedAt
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

          if (farm.gatheringItemKey !== null) {
            return { type: "rule_error", rule: { type: "farmer_busy" } };
          }

          await removeCompletedImprovementDestructions(
            transaction,
            farm.id,
            startedAt
          );

          const [groundItems, crops, improvements, objects, buildings] =
            await Promise.all([
              transaction
                .select()
                .from(farmGroundItems)
                .where(eq(farmGroundItems.farmId, farm.id)),
              transaction
                .select({ column: farmCrops.column, row: farmCrops.row })
                .from(farmCrops)
                .where(eq(farmCrops.farmId, farm.id)),
              transaction
                .select({
                  column: farmImprovements.column,
                  row: farmImprovements.row
                })
                .from(farmImprovements)
                .where(eq(farmImprovements.farmId, farm.id)),
              transaction
                .select({ column: farmObjects.column, row: farmObjects.row })
                .from(farmObjects)
                .where(eq(farmObjects.farmId, farm.id)),
              transaction
                .select({
                  type: farmBuildings.type,
                  column: farmBuildings.column,
                  row: farmBuildings.row
                })
                .from(farmBuildings)
                .where(eq(farmBuildings.farmId, farm.id))
            ]);
          const occupiedCoordinates = new Set<string>();
          addInitialFarmBuildingCoordinates(occupiedCoordinates);

          for (const occupant of [
            ...groundItems,
            ...crops,
            ...improvements,
            ...objects
          ]) {
            occupiedCoordinates.add(coordinateKey(occupant));
          }

          for (const building of buildings) {
            for (const coordinate of getBuildingFootprint(
              building.type,
              building
            )) {
              occupiedCoordinates.add(coordinateKey(coordinate));
            }
          }

          const availableMaterials = groundItems.reduce<
            Partial<Record<InventoryItemKey, number>>
          >(
            (quantities, item) => ({
              ...quantities,
              [item.itemKey]:
                (quantities[item.itemKey] ?? 0) + item.quantity
            }),
            {}
          );
          const placement = validateBuildingPlacement({
            building: "granary",
            target: input.target,
            occupiedCoordinates,
            carriedItem: farm.carriedItemKey,
            availableMaterials
          });

          if (placement.type !== "valid") {
            return { type: "rule_error", rule: placement };
          }

          for (const [itemKey, quantity] of Object.entries(
            FARM_BUILDING_DEFINITIONS.granary.materials
          ) as [InventoryItemKey, number][]) {
            await consumeGroundMaterial(
              transaction,
              groundItems,
              itemKey,
              quantity
            );
          }

          const [building] = await transaction
            .insert(farmBuildings)
            .values({
              farmId: farm.id,
              type: "granary",
              column: input.target.column,
              row: input.target.row,
              startedAt,
              completesAt
            })
            .onConflictDoNothing()
            .returning({ id: farmBuildings.id });

          if (building === undefined) {
            return {
              type: "rule_error",
              rule: { type: "footprint_occupied" }
            };
          }

          const [updatedFarm] = await transaction
            .update(farms)
            .set({
              version: sql`${farms.version} + 1`,
              updatedAt: startedAt
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
      catch: cause => new BuildGranaryPersistenceError({ cause })
    });

    return yield* match(outcome)
      .with({ type: "success" }, ({ snapshot }) => Effect.succeed(snapshot))
      .with({ type: "rule_error" }, ({ rule }) =>
        Effect.fail(new BuildGranaryRuleError({ rule }))
      )
      .exhaustive();
  });
