import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { Clock, Data, Effect } from "effect";
import type { Database } from "../db/client";
import { farms, marketOrders, marketTrades, players, shekelTransactions } from "../db/schema";
import { advanceFarmLifecycle } from "./farmLifecycle";
import { readFarmSnapshot } from "./farmSnapshot";
import { addToMarketItemStorage, loadMarketItemStorage } from "./marketItemStorage";

export class PlayerMarketRuleError extends Data.TaggedError("PlayerMarketRuleError")<{
  readonly type: "order_unavailable" | "self_purchase" | "insufficient_quantity" | "insufficient_shekels" | "insufficient_storage" | "price_changed" | "farm_version_conflict" | "idempotency_conflict" | "invalid_amount";
  readonly message: string;
}> {}
export class PlayerMarketPersistenceError extends Data.TaggedError("PlayerMarketPersistenceError")<{ readonly cause: unknown }> {}

type PurchaseInput = {
  readonly playerId: string;
  readonly orderId: string;
  readonly quantity: number;
  readonly expectedUnitPrice: number;
  readonly expectedFarmVersion: number;
  readonly idempotencyKey: string;
};

export const buyMarketSellOrder = (database: Database, input: PurchaseInput) =>
  Effect.gen(function* () {
    const now = new Date(yield* Clock.currentTimeMillis);
    return yield* Effect.tryPromise({
      try: () => database.transaction(async tx => {
        const fail = (type: PlayerMarketRuleError["type"], message: string): never => {
          throw new PlayerMarketRuleError({ type, message });
        };
        if (!Number.isInteger(input.quantity) || input.quantity <= 0 || input.quantity > 2147483647)
          return fail("invalid_amount", "Choose a valid whole quantity");
        const [candidate] = await tx.select().from(marketOrders).where(eq(marketOrders.id, input.orderId));
        if (!candidate) return fail("order_unavailable", "This listing is no longer available");
        if (candidate.playerId === input.playerId) return fail("self_purchase", "You cannot buy your own listing");

        // All cross-player operations lock farms in the same order, before orders
        // and wallets. This also agrees with existing listing/NPC lock ordering.
        const participantIds = [input.playerId, candidate.playerId];
        const lockedFarms = await tx.select().from(farms).where(inArray(farms.playerId, participantIds)).orderBy(asc(farms.playerId)).for("update");
        const buyerFarm = lockedFarms.find(farm => farm.playerId === input.playerId);
        if (!buyerFarm || lockedFarms.length !== 2) return fail("order_unavailable", "Both players must have a farm");
        const [previous] = await tx.select().from(marketTrades).where(and(eq(marketTrades.buyerId, input.playerId), eq(marketTrades.idempotencyKey, input.idempotencyKey)));
        if (previous) {
          if (previous.orderId !== input.orderId || previous.quantity !== input.quantity || previous.unitPrice !== input.expectedUnitPrice)
            return fail("idempotency_conflict", "This purchase identifier was already used");
          return readFarmSnapshot(tx, buyerFarm, false);
        }
        const [ledgerConflict] = await tx.select().from(shekelTransactions).where(and(eq(shekelTransactions.playerId, input.playerId), eq(shekelTransactions.idempotencyKey, input.idempotencyKey)));
        if (ledgerConflict) return fail("idempotency_conflict", "This purchase identifier was already used");
        const [order] = await tx.select().from(marketOrders).where(eq(marketOrders.id, input.orderId)).for("update");
        if (!order || order.side !== "sell" || order.status !== "open") return fail("order_unavailable", "This listing is no longer available");
        if (order.remainingQuantity < input.quantity) return fail("insufficient_quantity", `Only ${order.remainingQuantity} remain in this listing`);
        if (order.unitPrice !== input.expectedUnitPrice) return fail("price_changed", "The price changed; review the listing again");
        const currentBuyerFarm = await advanceFarmLifecycle(tx, buyerFarm, now);
        if (currentBuyerFarm.version !== input.expectedFarmVersion) return fail("farm_version_conflict", "Your farm changed; review the refreshed balance and try again");
        const wallets = await tx.select().from(players).where(inArray(players.id, participantIds)).orderBy(asc(players.id)).for("update");
        const buyer = wallets.find(player => player.id === input.playerId);
        const seller = wallets.find(player => player.id === order.playerId);
        if (!buyer || !seller) return fail("order_unavailable", "The buyer or seller is unavailable");
        const total = input.quantity * order.unitPrice;
        if (!Number.isSafeInteger(total) || total > 2147483647 || seller.shekelBalance + total > 2147483647)
          return fail("invalid_amount", "This purchase exceeds the balance limit");
        if (buyer.shekelBalance < total) return fail("insufficient_shekels", `You need ${total} shekels for this purchase`);
        const storage = await loadMarketItemStorage(tx, buyerFarm.id, order.itemKey, now);
        if (storage.availableCapacity < input.quantity) return fail("insufficient_storage", `Only ${storage.availableCapacity} storage spaces are available`);

        await addToMarketItemStorage(tx, storage, input.quantity, now);
        const buyerBalance = buyer.shekelBalance - total;
        const sellerBalance = seller.shekelBalance + total;
        await tx.update(players).set({ shekelBalance: buyerBalance, updatedAt: now }).where(eq(players.id, buyer.id));
        await tx.update(players).set({ shekelBalance: sellerBalance, updatedAt: now }).where(eq(players.id, seller.id));
        const [buyerEntry, sellerEntry] = await tx.insert(shekelTransactions).values([
          { playerId: buyer.id, idempotencyKey: input.idempotencyKey, type: "market_purchase", source: "player", delta: -total, balanceAfter: buyerBalance, itemKey: order.itemKey, itemQuantity: input.quantity, unitPrice: order.unitPrice, createdAt: now },
          { playerId: seller.id, idempotencyKey: crypto.randomUUID(), type: "market_sale", source: "player", delta: total, balanceAfter: sellerBalance, itemKey: order.itemKey, itemQuantity: input.quantity, unitPrice: order.unitPrice, createdAt: now }
        ]).returning();
        await tx.insert(marketTrades).values({ orderId: order.id, buyerId: buyer.id, sellerId: seller.id, idempotencyKey: input.idempotencyKey, itemKey: order.itemKey, quantity: input.quantity, unitPrice: order.unitPrice, buyerTransactionId: buyerEntry!.id, sellerTransactionId: sellerEntry!.id, createdAt: now });
        const remainingQuantity = order.remainingQuantity - input.quantity;
        await tx.update(marketOrders).set({ remainingQuantity, status: remainingQuantity === 0 ? "filled" : "open", updatedAt: now }).where(eq(marketOrders.id, order.id));
        const updatedFarms = await tx.update(farms).set({ version: sql`${farms.version} + 1`, updatedAt: now }).where(inArray(farms.playerId, participantIds)).returning();
        return readFarmSnapshot(tx, updatedFarms.find(farm => farm.playerId === buyer.id)!, false);
      }),
      catch: cause => cause instanceof PlayerMarketRuleError ? cause : new PlayerMarketPersistenceError({ cause })
    });
  });
