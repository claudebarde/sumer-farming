import { and, eq, sql } from "drizzle-orm";
import { Clock, Data, Effect } from "effect";
import { match } from "ts-pattern";

import {
  MARKET_ITEM_DEFINITIONS,
  type MarketItemKey
} from "../../game-data/marketItems";
import type { FarmSnapshot } from "../../schemas/farm";
import type { Database } from "../db/client";
import { farms, marketOrders } from "../db/schema";
import { advanceFarmLifecycle } from "./farmLifecycle";
import { readFarmSnapshot } from "./farmSnapshot";
import {
  addToMarketItemStorage,
  loadMarketItemStorage,
  removeFromMarketItemStorage
} from "./marketItemStorage";

type MarketSellOrderRule =
  | { readonly type: "farm_not_found" }
  | {
      readonly type: "version_conflict";
      readonly expectedVersion: number;
      readonly actualVersion: number;
    }
  | { readonly type: "sell_order_unavailable"; readonly itemKey: MarketItemKey }
  | {
      readonly type: "insufficient_stored_item";
      readonly itemKey: MarketItemKey;
      readonly requested: number;
      readonly available: number;
    }
  | { readonly type: "order_not_found" }
  | { readonly type: "order_already_filled" }
  | {
      readonly type: "insufficient_storage";
      readonly itemKey: MarketItemKey;
      readonly requested: number;
      readonly available: number;
    }
  | { readonly type: "idempotency_conflict" };

export class MarketSellOrderRuleError extends Data.TaggedError(
  "MarketSellOrderRuleError"
)<{
  readonly rule: MarketSellOrderRule;
}> {}

export class MarketSellOrderPersistenceError extends Data.TaggedError(
  "MarketSellOrderPersistenceError"
)<{
  readonly cause: unknown;
}> {}

export type MarketSellOrderError =
  | MarketSellOrderRuleError
  | MarketSellOrderPersistenceError;

type CreateMarketSellOrderInput = {
  readonly playerId: string;
  readonly itemKey: MarketItemKey;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly idempotencyKey: string;
  readonly expectedFarmVersion: number;
};

type CancelMarketSellOrderInput = {
  readonly playerId: string;
  readonly orderId: string;
  readonly expectedFarmVersion: number;
};

type DatabaseOutcome =
  | { readonly type: "success"; readonly snapshot: FarmSnapshot }
  | { readonly type: "rule_error"; readonly rule: MarketSellOrderRule };

const incrementFarmVersion = async (
  transaction: Parameters<Parameters<Database["transaction"]>[0]>[0],
  farmId: string,
  now: Date
) =>
  (
    await transaction
      .update(farms)
      .set({ version: sql`${farms.version} + 1`, updatedAt: now })
      .where(eq(farms.id, farmId))
      .returning()
  )[0];

const resolveOutcome = (
  outcome: DatabaseOutcome
): Effect.Effect<FarmSnapshot, MarketSellOrderRuleError> =>
  match(outcome)
    .with({ type: "success" }, ({ snapshot }) => Effect.succeed(snapshot))
    .with({ type: "rule_error" }, ({ rule }) =>
      Effect.fail(new MarketSellOrderRuleError({ rule }))
    )
    .exhaustive();

export const createMarketSellOrder = (
  database: Database,
  input: CreateMarketSellOrderInput
): Effect.Effect<FarmSnapshot, MarketSellOrderError> =>
  Effect.gen(function* () {
    const now = new Date(yield* Clock.currentTimeMillis);
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
          const existingOrder = (
            await transaction
              .select()
              .from(marketOrders)
              .where(
                and(
                  eq(marketOrders.playerId, input.playerId),
                  eq(marketOrders.idempotencyKey, input.idempotencyKey)
                )
              )
              .limit(1)
          )[0];

          if (existingOrder !== undefined) {
            const isSameOrder =
              existingOrder.side === "sell" &&
              existingOrder.itemKey === input.itemKey &&
              existingOrder.originalQuantity === input.quantity &&
              existingOrder.unitPrice === input.unitPrice;

            return isSameOrder
              ? {
                  type: "success",
                  snapshot: await readFarmSnapshot(transaction, farm, false)
                }
              : {
                  type: "rule_error",
                  rule: { type: "idempotency_conflict" }
                };
          }

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
            !MARKET_ITEM_DEFINITIONS[input.itemKey].playerMarket
              .canCreateSellOrder
          ) {
            return {
              type: "rule_error",
              rule: {
                type: "sell_order_unavailable",
                itemKey: input.itemKey
              }
            };
          }

          const storage = await loadMarketItemStorage(
            transaction,
            farm.id,
            input.itemKey,
            now
          );

          if (storage.storedQuantity < input.quantity) {
            return {
              type: "rule_error",
              rule: {
                type: "insufficient_stored_item",
                itemKey: input.itemKey,
                requested: input.quantity,
                available: storage.storedQuantity
              }
            };
          }

          await removeFromMarketItemStorage(
            transaction,
            storage,
            input.quantity,
            now
          );
          await transaction.insert(marketOrders).values({
            playerId: input.playerId,
            idempotencyKey: input.idempotencyKey,
            side: "sell",
            status: "open",
            itemKey: input.itemKey,
            unitPrice: input.unitPrice,
            originalQuantity: input.quantity,
            remainingQuantity: input.quantity,
            createdAt: now,
            updatedAt: now
          });

          const updatedFarm = await incrementFarmVersion(
            transaction,
            farm.id,
            now
          );

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
      catch: cause => new MarketSellOrderPersistenceError({ cause })
    });

    return yield* resolveOutcome(outcome);
  });

export const cancelMarketSellOrder = (
  database: Database,
  input: CancelMarketSellOrderInput
): Effect.Effect<FarmSnapshot, MarketSellOrderError> =>
  Effect.gen(function* () {
    const now = new Date(yield* Clock.currentTimeMillis);
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
          const order = (
            await transaction
              .select()
              .from(marketOrders)
              .where(
                and(
                  eq(marketOrders.id, input.orderId),
                  eq(marketOrders.playerId, input.playerId),
                  eq(marketOrders.side, "sell")
                )
              )
              .limit(1)
              .for("update")
          )[0];

          if (order === undefined) {
            return { type: "rule_error", rule: { type: "order_not_found" } };
          }

          if (order.status === "cancelled") {
            return {
              type: "success",
              snapshot: await readFarmSnapshot(transaction, farm, false)
            };
          }

          if (order.status === "filled") {
            return {
              type: "rule_error",
              rule: { type: "order_already_filled" }
            };
          }

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

          const storage = await loadMarketItemStorage(
            transaction,
            farm.id,
            order.itemKey,
            now
          );

          if (storage.availableCapacity < order.remainingQuantity) {
            return {
              type: "rule_error",
              rule: {
                type: "insufficient_storage",
                itemKey: order.itemKey,
                requested: order.remainingQuantity,
                available: storage.availableCapacity
              }
            };
          }

          await addToMarketItemStorage(
            transaction,
            storage,
            order.remainingQuantity,
            now
          );
          await transaction
            .update(marketOrders)
            .set({
              status: "cancelled",
              remainingQuantity: 0,
              updatedAt: now
            })
            .where(eq(marketOrders.id, order.id));

          const updatedFarm = await incrementFarmVersion(
            transaction,
            farm.id,
            now
          );

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
      catch: cause => new MarketSellOrderPersistenceError({ cause })
    });

    return yield* resolveOutcome(outcome);
  });
