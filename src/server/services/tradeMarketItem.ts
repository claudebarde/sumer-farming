import { and, eq, sql } from "drizzle-orm";
import { Clock, Data, Effect } from "effect";
import { match } from "ts-pattern";

import {
  MARKET_ITEM_DEFINITIONS,
  type MarketItemKey
} from "../../game-data/marketItems";
import type { FarmSnapshot } from "../../schemas/farm";
import type { Database } from "../db/client";
import { farms, players, shekelTransactions } from "../db/schema";
import { advanceFarmLifecycle } from "./farmLifecycle";
import { readFarmSnapshot } from "./farmSnapshot";
import {
  addToMarketItemStorage,
  loadMarketItemStorage,
  removeFromMarketItemStorage
} from "./marketItemStorage";

type MarketTradeRule =
  | { readonly type: "farm_not_found" }
  | { readonly type: "player_not_found" }
  | {
      readonly type: "version_conflict";
      readonly expectedVersion: number;
      readonly actualVersion: number;
    }
  | {
      readonly type: "insufficient_stored_item";
      readonly itemKey: MarketItemKey;
      readonly requested: number;
      readonly available: number;
    }
  | {
      readonly type: "insufficient_shekels";
      readonly required: number;
      readonly available: number;
    }
  | {
      readonly type: "insufficient_storage";
      readonly itemKey: MarketItemKey;
      readonly requested: number;
      readonly available: number;
    }
  | {
      readonly type: "price_changed";
      readonly expectedUnitPrice: number;
      readonly currentUnitPrice: number;
    }
  | {
      readonly type: "trade_unavailable";
      readonly itemKey: MarketItemKey;
      readonly direction: "buy" | "sell";
    }
  | { readonly type: "idempotency_conflict" };

export class MarketTradeRuleError extends Data.TaggedError(
  "MarketTradeRuleError"
)<{
  readonly rule: MarketTradeRule;
}> {}

export class MarketTradePersistenceError extends Data.TaggedError(
  "MarketTradePersistenceError"
)<{
  readonly cause: unknown;
}> {}

export type MarketTradeError =
  | MarketTradeRuleError
  | MarketTradePersistenceError;

type MarketTradeInput = {
  readonly playerId: string;
  readonly itemKey: MarketItemKey;
  readonly quantity: number;
  readonly expectedUnitPrice: number;
  readonly idempotencyKey: string;
  readonly expectedFarmVersion: number;
};

type MarketTrade =
  | { readonly type: "buy"; readonly input: MarketTradeInput }
  | { readonly type: "sell"; readonly input: MarketTradeInput };

type DatabaseOutcome =
  | { readonly type: "success"; readonly snapshot: FarmSnapshot }
  | { readonly type: "rule_error"; readonly rule: MarketTradeRule };

const executeStorageTrade = (
  database: Database,
  trade: MarketTrade
): Effect.Effect<FarmSnapshot, MarketTradeError> =>
  Effect.gen(function* () {
    const now = new Date(yield* Clock.currentTimeMillis);
    const outcome = yield* Effect.tryPromise({
      try: (): Promise<DatabaseOutcome> =>
        database.transaction(async transaction => {
          const input = trade.input;
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
          const transactionType =
            trade.type === "buy" ? "market_purchase" : "market_sale";
          const marketDefinition =
            MARKET_ITEM_DEFINITIONS[input.itemKey].npcMarket;
          const unitPrice =
            trade.type === "buy"
              ? marketDefinition.buyPrice
              : marketDefinition.sellPrice;
          const delta =
            input.quantity * unitPrice * (trade.type === "buy" ? -1 : 1);
          const existingTransaction = (
            await transaction
              .select()
              .from(shekelTransactions)
              .where(
                and(
                  eq(shekelTransactions.playerId, input.playerId),
                  eq(shekelTransactions.idempotencyKey, input.idempotencyKey)
                )
              )
              .limit(1)
          )[0];

          if (existingTransaction !== undefined) {
            const isSameTrade =
              existingTransaction.source === "npc" &&
              existingTransaction.type === transactionType &&
              existingTransaction.itemKey === input.itemKey &&
              existingTransaction.itemQuantity === input.quantity &&
              existingTransaction.unitPrice === unitPrice &&
              existingTransaction.delta === delta;

            return isSameTrade
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

          const tradeIsAvailable =
            trade.type === "buy"
              ? marketDefinition.canBuy
              : marketDefinition.canSell;

          if (!tradeIsAvailable) {
            return {
              type: "rule_error",
              rule: {
                type: "trade_unavailable",
                itemKey: input.itemKey,
                direction: trade.type
              }
            };
          }

          if (input.expectedUnitPrice !== unitPrice) {
            return {
              type: "rule_error",
              rule: {
                type: "price_changed",
                expectedUnitPrice: input.expectedUnitPrice,
                currentUnitPrice: unitPrice
              }
            };
          }

          const player = (
            await transaction
              .select()
              .from(players)
              .where(eq(players.id, input.playerId))
              .limit(1)
              .for("update")
          )[0];

          if (player === undefined) {
            return { type: "rule_error", rule: { type: "player_not_found" } };
          }

          const storage = await loadMarketItemStorage(
            transaction,
            farm.id,
            input.itemKey,
            now
          );

          if (
            trade.type === "sell" &&
            storage.storedQuantity < input.quantity
          ) {
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

          if (trade.type === "buy" && player.shekelBalance < -delta) {
            return {
              type: "rule_error",
              rule: {
                type: "insufficient_shekels",
                required: -delta,
                available: player.shekelBalance
              }
            };
          }

          if (
            trade.type === "buy" &&
            storage.availableCapacity < input.quantity
          ) {
            return {
              type: "rule_error",
              rule: {
                type: "insufficient_storage",
                itemKey: input.itemKey,
                requested: input.quantity,
                available: storage.availableCapacity
              }
            };
          }

          if (trade.type === "sell") {
            await removeFromMarketItemStorage(
              transaction,
              storage,
              input.quantity,
              now
            );
          } else {
            await addToMarketItemStorage(
              transaction,
              storage,
              input.quantity,
              now
            );
          }

          const nextBalance = player.shekelBalance + delta;
          await transaction
            .update(players)
            .set({ shekelBalance: nextBalance, updatedAt: now })
            .where(eq(players.id, player.id));
          await transaction.insert(shekelTransactions).values({
            playerId: player.id,
            idempotencyKey: input.idempotencyKey,
            type: transactionType,
            delta,
            balanceAfter: nextBalance,
            itemKey: input.itemKey,
            itemQuantity: input.quantity,
            unitPrice,
            createdAt: now
          });

          const updatedFarm = (
            await transaction
              .update(farms)
              .set({
                version: sql`${farms.version} + 1`,
                updatedAt: now
              })
              .where(eq(farms.id, farm.id))
              .returning()
          )[0];

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
      catch: cause => new MarketTradePersistenceError({ cause })
    });

    return yield* match(outcome)
      .with({ type: "success" }, ({ snapshot }) => Effect.succeed(snapshot))
      .with({ type: "rule_error" }, ({ rule }) =>
        Effect.fail(new MarketTradeRuleError({ rule }))
      )
      .exhaustive();
  });

const executeTrade = (
  database: Database,
  trade: MarketTrade
): Effect.Effect<FarmSnapshot, MarketTradeError> =>
  match(trade.input.itemKey)
    .returnType<Effect.Effect<FarmSnapshot, MarketTradeError>>()
    .with("barley", "brewingVessels", "emptyBeerJar", "beer", () => executeStorageTrade(database, trade))
    .exhaustive();

export const buyFromNpcMarket = (
  database: Database,
  input: MarketTradeInput
): Effect.Effect<FarmSnapshot, MarketTradeError> =>
  executeTrade(database, { type: "buy", input });

export const sellToNpcMarket = (
  database: Database,
  input: MarketTradeInput
): Effect.Effect<FarmSnapshot, MarketTradeError> =>
  executeTrade(database, { type: "sell", input });
