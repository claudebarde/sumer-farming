import { and, eq, sql } from "drizzle-orm";
import { Clock, Data, Effect } from "effect";
import { match } from "ts-pattern";

import { isInsideArablePlot } from "../../game-core/farm/cultivation";
import { getBuildingFootprint } from "../../game-core/farm/buildings";
import type { FarmCoordinate } from "../../game-core/farm/irrigation";
import { INITIAL_FARM_CONFIG } from "../../game-data/initialFarm";
import type { InventoryItemKey } from "../../game-data/inventoryItems";
import { FARM_BUILDING_DEFINITIONS } from "../../game-data/buildings";
import { EXPOSED_BARLEY_LIFETIME_MS } from "../../game-data/household";
import {
  FARMER_CARRY_CAPACITY,
  FARM_STORAGE_CAPACITY
} from "../../game-data/storage";
import type { FarmSnapshot } from "../../schemas/farm";
import type { Database, DatabaseTransaction } from "../db/client";
import {
  farmCrops,
  farmBuildings,
  farmGroundItems,
  farmImprovements,
  farmInventory,
  farmObjects,
  farms
} from "../db/schema";
import { removeCompletedImprovementDestructions } from "./farmImprovementLifecycle";
import { readFarmSnapshot } from "./farmSnapshot";
import { advanceFarmLifecycle } from "./farmLifecycle";

type FarmItemRule =
  | { readonly type: "farm_not_found" }
  | {
      readonly type: "version_conflict";
      readonly expectedVersion: number;
      readonly actualVersion: number;
    }
  | { readonly type: "carrying_capacity_reached" }
  | { readonly type: "incompatible_carried_item" }
  | { readonly type: "farmer_hands_not_empty" }
  | { readonly type: "ground_item_not_found" }
  | { readonly type: "not_carrying" }
  | { readonly type: "outside_arable_plot" }
  | { readonly type: "ground_tile_occupied" }
  | { readonly type: "farm_storage_full" }
  | { readonly type: "granary_not_found" }
  | { readonly type: "granary_not_complete" }
  | { readonly type: "granary_storage_full" }
  | { readonly type: "granary_empty" }
  | { readonly type: "granary_stores_barley_only" }
  | { readonly type: "inventory_item_not_found" };

export class FarmItemRuleError extends Data.TaggedError("FarmItemRuleError")<{
  readonly rule: FarmItemRule;
}> {}

export class FarmItemPersistenceError extends Data.TaggedError(
  "FarmItemPersistenceError"
)<{
  readonly cause: unknown;
}> {}

export type FarmItemActionError =
  | FarmItemRuleError
  | FarmItemPersistenceError;

type TargetedFarmItemActionInput = {
  readonly playerId: string;
  readonly target: FarmCoordinate;
  readonly expectedFarmVersion: number;
};

type DepositCarriedItemInput = {
  readonly playerId: string;
  readonly expectedFarmVersion: number;
};

type WithdrawInventoryItemInput = {
  readonly playerId: string;
  readonly itemKey: InventoryItemKey;
  readonly expectedFarmVersion: number;
};

type DatabaseOutcome =
  | { readonly type: "success"; readonly snapshot: FarmSnapshot }
  | { readonly type: "rule_error"; readonly rule: FarmItemRule };

const isInsideFarmBuilding = (coordinate: FarmCoordinate): boolean => {
  const { buildingBounds } = INITIAL_FARM_CONFIG;

  return (
    coordinate.column >= buildingBounds.minimumColumn &&
    coordinate.column <= buildingBounds.maximumColumn &&
    coordinate.row >= buildingBounds.minimumRow &&
    coordinate.row <= buildingBounds.maximumRow
  );
};

const isGroundTileOccupied = async (
  transaction: DatabaseTransaction,
  farmId: string,
  coordinate: FarmCoordinate
): Promise<boolean> => {
  if (isInsideFarmBuilding(coordinate)) {
    return true;
  }

  const [groundItems, crops, improvements, objects, buildings] =
    await Promise.all([
    transaction
      .select({ id: farmGroundItems.id })
      .from(farmGroundItems)
      .where(
        and(
          eq(farmGroundItems.farmId, farmId),
          eq(farmGroundItems.column, coordinate.column),
          eq(farmGroundItems.row, coordinate.row)
        )
      )
      .limit(1),
    transaction
      .select({ id: farmCrops.id })
      .from(farmCrops)
      .where(
        and(
          eq(farmCrops.farmId, farmId),
          eq(farmCrops.column, coordinate.column),
          eq(farmCrops.row, coordinate.row)
        )
      )
      .limit(1),
    transaction
      .select({ id: farmImprovements.id })
      .from(farmImprovements)
      .where(
        and(
          eq(farmImprovements.farmId, farmId),
          eq(farmImprovements.column, coordinate.column),
          eq(farmImprovements.row, coordinate.row)
        )
      )
      .limit(1),
    transaction
      .select({ id: farmObjects.id })
      .from(farmObjects)
      .where(
        and(
          eq(farmObjects.farmId, farmId),
          eq(farmObjects.column, coordinate.column),
          eq(farmObjects.row, coordinate.row)
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
    [groundItems, crops, improvements, objects].some(
      occupants => occupants.length > 0
    ) ||
    buildings.some(building =>
      getBuildingFootprint(building.type, building).some(
        position =>
          position.column === coordinate.column &&
          position.row === coordinate.row
      )
    )
  );
};

type FarmItemAction =
  | { readonly type: "pickup"; readonly input: TargetedFarmItemActionInput }
  | { readonly type: "drop"; readonly input: TargetedFarmItemActionInput }
  | { readonly type: "deposit"; readonly input: DepositCarriedItemInput }
  | {
      readonly type: "deposit_granary";
      readonly input: TargetedFarmItemActionInput;
    }
  | {
      readonly type: "withdraw_granary";
      readonly input: TargetedFarmItemActionInput;
    }
  | { readonly type: "withdraw"; readonly input: WithdrawInventoryItemInput };

const executeFarmItemAction = (
  database: Database,
  action: FarmItemAction
): Effect.Effect<FarmSnapshot, FarmItemActionError> =>
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

          await removeCompletedImprovementDestructions(
            transaction,
            farm.id,
            now
          );

          return match(action)
            .returnType<Promise<DatabaseOutcome>>()
            .with({ type: "pickup" }, async ({ input }) => {
              const groundItem = (
                await transaction
                  .select()
                  .from(farmGroundItems)
                  .where(
                    and(
                      eq(farmGroundItems.farmId, farm.id),
                      eq(farmGroundItems.column, input.target.column),
                      eq(farmGroundItems.row, input.target.row)
                    )
                  )
                  .limit(1)
              )[0];

              if (groundItem === undefined) {
                return {
                  type: "rule_error",
                  rule: { type: "ground_item_not_found" }
                };
              }

              if (
                farm.carriedItemKey !== null &&
                farm.carriedItemKey !== groundItem.itemKey
              ) {
                return {
                  type: "rule_error",
                  rule: { type: "incompatible_carried_item" }
                };
              }

              if (farm.carriedItemQuantity >= FARMER_CARRY_CAPACITY) {
                return {
                  type: "rule_error",
                  rule: { type: "carrying_capacity_reached" }
                };
              }

              if (groundItem.quantity === 1) {
                await transaction
                  .delete(farmGroundItems)
                  .where(eq(farmGroundItems.id, groundItem.id));
              } else {
                await transaction
                  .update(farmGroundItems)
                  .set({ quantity: groundItem.quantity - 1 })
                  .where(eq(farmGroundItems.id, groundItem.id));
              }

              const [updatedFarm] = await transaction
                .update(farms)
                .set({
                  carriedItemKey: groundItem.itemKey,
                  carriedItemQuantity: farm.carriedItemQuantity + 1,
                  carriedItemExpiresAt:
                    groundItem.itemKey === "barley"
                      ? new Date(
                          Math.min(
                            farm.carriedItemExpiresAt?.getTime() ?? Infinity,
                            groundItem.expiresAt?.getTime() ??
                              now.getTime() + EXPOSED_BARLEY_LIFETIME_MS
                          )
                        )
                      : null,
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
            .with({ type: "drop" }, async ({ input }) => {
              if (
                farm.carriedItemKey === null ||
                farm.carriedItemQuantity === 0
              ) {
                return {
                  type: "rule_error",
                  rule: { type: "not_carrying" }
                };
              }

              if (!isInsideArablePlot(input.target)) {
                return {
                  type: "rule_error",
                  rule: { type: "outside_arable_plot" }
                };
              }

              if (
                await isGroundTileOccupied(
                  transaction,
                  farm.id,
                  input.target
                )
              ) {
                return {
                  type: "rule_error",
                  rule: { type: "ground_tile_occupied" }
                };
              }

              const [droppedItem] = await transaction
                .insert(farmGroundItems)
                .values({
                  farmId: farm.id,
                  itemKey: farm.carriedItemKey,
                  quantity: 1,
                  column: input.target.column,
                  row: input.target.row,
                  expiresAt:
                    farm.carriedItemKey === "barley"
                      ? (farm.carriedItemExpiresAt ??
                        new Date(
                          now.getTime() + EXPOSED_BARLEY_LIFETIME_MS
                        ))
                      : null
                })
                .onConflictDoNothing()
                .returning({ id: farmGroundItems.id });

              if (droppedItem === undefined) {
                return {
                  type: "rule_error",
                  rule: { type: "ground_tile_occupied" }
                };
              }

              const remainingQuantity = farm.carriedItemQuantity - 1;
              const [updatedFarm] = await transaction
                .update(farms)
                .set({
                  carriedItemKey:
                    remainingQuantity === 0 ? null : farm.carriedItemKey,
                  carriedItemQuantity: remainingQuantity,
                  carriedItemExpiresAt:
                    remainingQuantity === 0
                      ? null
                      : farm.carriedItemExpiresAt,
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
            .with({ type: "deposit" }, async () => {
              if (
                farm.carriedItemKey === null ||
                farm.carriedItemQuantity === 0
              ) {
                return {
                  type: "rule_error",
                  rule: { type: "not_carrying" }
                };
              }

              const inventory = await transaction
                .select({ quantity: farmInventory.quantity })
                .from(farmInventory)
                .where(
                  and(
                    eq(farmInventory.farmId, farm.id),
                    eq(farmInventory.itemKey, "barley")
                  )
                );
              const storedQuantity = inventory.reduce(
                (total, item) => total + item.quantity,
                0
              );
              const availableCapacity = Math.max(
                0,
                FARM_STORAGE_CAPACITY - storedQuantity
              );

              if (availableCapacity === 0) {
                return {
                  type: "rule_error",
                  rule: { type: "farm_storage_full" }
                };
              }

              const depositedQuantity = Math.min(
                availableCapacity,
                farm.carriedItemQuantity
              );

              await transaction
                .insert(farmInventory)
                .values({
                  farmId: farm.id,
                  itemKey: farm.carriedItemKey,
                  quantity: depositedQuantity,
                  updatedAt: now
                })
                .onConflictDoUpdate({
                  target: [farmInventory.farmId, farmInventory.itemKey],
                  set: {
                    quantity: sql`${farmInventory.quantity} + ${depositedQuantity}`,
                    updatedAt: now
                  }
                });

              const remainingQuantity =
                farm.carriedItemQuantity - depositedQuantity;
              const [updatedFarm] = await transaction
                .update(farms)
                .set({
                  carriedItemKey:
                    remainingQuantity === 0 ? null : farm.carriedItemKey,
                  carriedItemQuantity: remainingQuantity,
                  carriedItemExpiresAt:
                    remainingQuantity === 0
                      ? null
                      : farm.carriedItemExpiresAt,
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
            .with({ type: "deposit_granary" }, async ({ input }) => {
              if (
                farm.carriedItemKey === null ||
                farm.carriedItemQuantity === 0
              ) {
                return {
                  type: "rule_error",
                  rule: { type: "not_carrying" }
                };
              }

              if (farm.carriedItemKey !== "barley") {
                return {
                  type: "rule_error",
                  rule: { type: "granary_stores_barley_only" }
                };
              }

              const granary = (
                await transaction
                  .select()
                  .from(farmBuildings)
                  .where(
                    and(
                      eq(farmBuildings.farmId, farm.id),
                      eq(farmBuildings.type, "granary"),
                      eq(farmBuildings.column, input.target.column),
                      eq(farmBuildings.row, input.target.row)
                    )
                  )
                  .limit(1)
              )[0];

              if (granary === undefined) {
                return {
                  type: "rule_error",
                  rule: { type: "granary_not_found" }
                };
              }

              if (granary.completesAt > now) {
                return {
                  type: "rule_error",
                  rule: { type: "granary_not_complete" }
                };
              }

              const capacity =
                FARM_BUILDING_DEFINITIONS.granary.barleyStorageBonus;
              const availableCapacity = Math.max(
                0,
                capacity - granary.storedBarley
              );

              if (availableCapacity === 0) {
                return {
                  type: "rule_error",
                  rule: { type: "granary_storage_full" }
                };
              }

              const depositedQuantity = Math.min(
                availableCapacity,
                farm.carriedItemQuantity
              );
              await transaction
                .update(farmBuildings)
                .set({
                  storedBarley: sql`${farmBuildings.storedBarley} + ${depositedQuantity}`
                })
                .where(eq(farmBuildings.id, granary.id));

              const remainingQuantity =
                farm.carriedItemQuantity - depositedQuantity;
              const [updatedFarm] = await transaction
                .update(farms)
                .set({
                  carriedItemKey:
                    remainingQuantity === 0 ? null : farm.carriedItemKey,
                  carriedItemQuantity: remainingQuantity,
                  carriedItemExpiresAt:
                    remainingQuantity === 0
                      ? null
                      : farm.carriedItemExpiresAt,
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
            .with({ type: "withdraw_granary" }, async ({ input }) => {
              if (
                farm.carriedItemKey !== null ||
                farm.carriedItemQuantity !== 0
              ) {
                return {
                  type: "rule_error",
                  rule: { type: "farmer_hands_not_empty" }
                };
              }

              const granary = (
                await transaction
                  .select()
                  .from(farmBuildings)
                  .where(
                    and(
                      eq(farmBuildings.farmId, farm.id),
                      eq(farmBuildings.type, "granary"),
                      eq(farmBuildings.column, input.target.column),
                      eq(farmBuildings.row, input.target.row)
                    )
                  )
                  .limit(1)
              )[0];

              if (granary === undefined) {
                return {
                  type: "rule_error",
                  rule: { type: "granary_not_found" }
                };
              }

              if (granary.completesAt > now) {
                return {
                  type: "rule_error",
                  rule: { type: "granary_not_complete" }
                };
              }

              if (granary.storedBarley === 0) {
                return {
                  type: "rule_error",
                  rule: { type: "granary_empty" }
                };
              }

              await transaction
                .update(farmBuildings)
                .set({
                  storedBarley: sql`${farmBuildings.storedBarley} - 1`
                })
                .where(eq(farmBuildings.id, granary.id));

              const [updatedFarm] = await transaction
                .update(farms)
                .set({
                  carriedItemKey: "barley",
                  carriedItemQuantity: 1,
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
            .with({ type: "withdraw" }, async ({ input }) => {
              if (
                farm.carriedItemKey !== null ||
                farm.carriedItemQuantity !== 0
              ) {
                return {
                  type: "rule_error",
                  rule: { type: "farmer_hands_not_empty" }
                };
              }

              const inventoryItem = (
                await transaction
                  .select()
                  .from(farmInventory)
                  .where(
                    and(
                      eq(farmInventory.farmId, farm.id),
                      eq(farmInventory.itemKey, input.itemKey)
                    )
                  )
                  .limit(1)
              )[0];

              if (
                inventoryItem === undefined ||
                inventoryItem.quantity === 0
              ) {
                return {
                  type: "rule_error",
                  rule: { type: "inventory_item_not_found" }
                };
              }

              if (inventoryItem.quantity === 1) {
                await transaction
                  .delete(farmInventory)
                  .where(
                    and(
                      eq(farmInventory.farmId, farm.id),
                      eq(farmInventory.itemKey, input.itemKey)
                    )
                  );
              } else {
                await transaction
                  .update(farmInventory)
                  .set({
                    quantity: inventoryItem.quantity - 1,
                    updatedAt: now
                  })
                  .where(
                    and(
                      eq(farmInventory.farmId, farm.id),
                      eq(farmInventory.itemKey, input.itemKey)
                    )
                  );
              }

              const [updatedFarm] = await transaction
                .update(farms)
                .set({
                  carriedItemKey: input.itemKey,
                  carriedItemQuantity: 1,
                  carriedItemExpiresAt:
                    input.itemKey === "barley"
                      ? new Date(
                          now.getTime() + EXPOSED_BARLEY_LIFETIME_MS
                        )
                      : null,
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
      catch: cause => new FarmItemPersistenceError({ cause })
    });

    return yield* match(outcome)
      .with({ type: "success" }, ({ snapshot }) => Effect.succeed(snapshot))
      .with({ type: "rule_error" }, ({ rule }) =>
        Effect.fail(new FarmItemRuleError({ rule }))
      )
      .exhaustive();
  });

export const pickupGroundItem = (
  database: Database,
  input: TargetedFarmItemActionInput
): Effect.Effect<FarmSnapshot, FarmItemActionError> =>
  executeFarmItemAction(database, { type: "pickup", input });

export const dropCarriedItem = (
  database: Database,
  input: TargetedFarmItemActionInput
): Effect.Effect<FarmSnapshot, FarmItemActionError> =>
  executeFarmItemAction(database, { type: "drop", input });

export const depositCarriedItem = (
  database: Database,
  input: DepositCarriedItemInput
): Effect.Effect<FarmSnapshot, FarmItemActionError> =>
  executeFarmItemAction(database, { type: "deposit", input });

export const depositCarriedItemInGranary = (
  database: Database,
  input: TargetedFarmItemActionInput
): Effect.Effect<FarmSnapshot, FarmItemActionError> =>
  executeFarmItemAction(database, { type: "deposit_granary", input });

export const withdrawBarleyFromGranary = (
  database: Database,
  input: TargetedFarmItemActionInput
): Effect.Effect<FarmSnapshot, FarmItemActionError> =>
  executeFarmItemAction(database, { type: "withdraw_granary", input });

export const withdrawInventoryItem = (
  database: Database,
  input: WithdrawInventoryItemInput
): Effect.Effect<FarmSnapshot, FarmItemActionError> =>
  executeFarmItemAction(database, { type: "withdraw", input });
