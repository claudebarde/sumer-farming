import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { Effect, Either } from "effect";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createDatabase } from "../../src/server/db/client";
import { farmInventory, farms, marketOrders, marketTrades, players, shekelTransactions } from "../../src/server/db/schema";
import { buyMarketSellOrder } from "../../src/server/services/buyMarketSellOrder";
import { cancelMarketSellOrder, createMarketSellOrder } from "../../src/server/services/marketSellOrders";
import { buyFromNpcMarket } from "../../src/server/services/tradeMarketItem";

const connectionString = process.env.TEST_DATABASE_URL ?? "postgres://sumer:sumer_dev@localhost:5432/sumer_farming";
const client = new Client({ connectionString });
const db = createDatabase(client);
const ids = new Set<string>();
beforeAll(() => client.connect());
afterEach(async () => {
  if (ids.size) await db.delete(players).where(inArray(players.id, [...ids]));
  ids.clear();
});
afterAll(() => client.end());

const player = async (barley = 0, shekels = 20) => {
  const id = randomUUID();
  ids.add(id);
  await db.insert(players).values({ id, displayName: "Purchase test", shekelBalance: shekels });
  const [farm] = await db.insert(farms).values({ playerId: id }).returning();
  if (barley) await db.insert(farmInventory).values({ farmId: farm!.id, itemKey: "barley", quantity: barley });
  return { id, farmId: farm!.id };
};
const fixture = async (quantity = 3) => {
  const seller = await player(quantity, 0);
  const buyer = await player();
  await Effect.runPromise(createMarketSellOrder(db, { playerId: seller.id, itemKey: "barley", quantity, unitPrice: 3, idempotencyKey: randomUUID(), expectedFarmVersion: 1 }));
  const [order] = await db.select().from(marketOrders).where(eq(marketOrders.playerId, seller.id));
  const input = { playerId: buyer.id, orderId: order!.id, quantity: 2, expectedUnitPrice: 3, expectedFarmVersion: 1, idempotencyKey: randomUUID() };
  return { seller, buyer, order: order!, input };
};

describe.sequential("player purchases", () => {
  it("transfers money and barley, records balanced entries and permits cancellation of the remainder", async () => {
    const { input, seller, buyer, order } = await fixture();
    const snapshot = await Effect.runPromise(buyMarketSellOrder(db, input));
    expect(snapshot.player.shekelBalance).toBe(14);
    expect(snapshot.inventory).toContainEqual({ itemKey: "barley", quantity: 2 });
    const [sellerRecord] = await db.select().from(players).where(eq(players.id, seller.id));
    expect(sellerRecord?.shekelBalance).toBe(6);
    const entries = await db.select().from(shekelTransactions).where(inArray(shekelTransactions.playerId, [seller.id, buyer.id]));
    expect(entries).toHaveLength(2);
    expect(entries.reduce((sum, entry) => sum + entry.delta, 0)).toBe(0);
    expect(entries.every(entry => entry.source === "player")).toBe(true);
    const [trade] = await db.select().from(marketTrades).where(eq(marketTrades.orderId, order.id));
    expect(trade).toMatchObject({ buyerId: buyer.id, sellerId: seller.id, quantity: 2, unitPrice: 3 });
    const cancelled = await Effect.runPromise(cancelMarketSellOrder(db, { playerId: seller.id, orderId: order.id, expectedFarmVersion: 3 }));
    expect(cancelled.inventory).toContainEqual({ itemKey: "barley", quantity: 1 });
  });

  it("fills an order and retries the same purchase without charging twice", async () => {
    const { input, buyer, order } = await fixture(2);
    await Effect.runPromise(buyMarketSellOrder(db, input));
    const retry = await Effect.runPromise(buyMarketSellOrder(db, input));
    expect(retry.player.shekelBalance).toBe(14);
    expect(retry.farm.version).toBe(2);
    const [record] = await db.select().from(marketOrders).where(eq(marketOrders.id, order.id));
    expect(record).toMatchObject({ status: "filled", remainingQuantity: 0 });
    const trades = await db.select().from(marketTrades).where(eq(marketTrades.buyerId, buyer.id));
    expect(trades).toHaveLength(1);
    const altered = await Effect.runPromise(Effect.either(buyMarketSellOrder(db, { ...input, quantity: 1 })));
    expect(Either.isLeft(altered) && altered.left).toMatchObject({ type: "idempotency_conflict" });
  });

  it.each([
    ["self_purchase", { self: true }],
    ["insufficient_quantity", { quantity: 4 }],
    ["price_changed", { expectedUnitPrice: 2 }],
    ["farm_version_conflict", { expectedFarmVersion: 9 }],
    ["insufficient_shekels", { balance: 1 }],
    ["insufficient_storage", { storage: 4 }],
    ["invalid_amount", { quantity: -1 }]
  ] as const)("rejects %s without changing money or escrow", async (reason, changes) => {
    const { input, seller, buyer, order } = await fixture();
    if ("balance" in changes) await db.update(players).set({ shekelBalance: changes.balance }).where(eq(players.id, buyer.id));
    if ("storage" in changes) await db.insert(farmInventory).values({ farmId: buyer.farmId, itemKey: "barley", quantity: changes.storage });
    const outcome = await Effect.runPromise(Effect.either(buyMarketSellOrder(db, { ...input, ...changes, playerId: "self" in changes ? seller.id : buyer.id })));
    expect(Either.isLeft(outcome) && outcome.left).toMatchObject({ _tag: "PlayerMarketRuleError", type: reason });
    const [remaining] = await db.select().from(marketOrders).where(eq(marketOrders.id, order.id));
    expect(remaining?.remainingQuantity).toBe(3);
    const ledger = await db.select().from(shekelTransactions).where(inArray(shekelTransactions.playerId, [seller.id, buyer.id]));
    expect(ledger).toHaveLength(0);
    const [buyerRecord] = await db.select().from(players).where(eq(players.id, buyer.id));
    expect(buyerRecord?.shekelBalance).toBe("balance" in changes ? changes.balance : 20);
  });

  it("does not confuse a player purchase retry with an NPC purchase", async () => {
    const { input } = await fixture();
    await Effect.runPromise(buyMarketSellOrder(db, input));
    const result = await Effect.runPromise(Effect.either(buyFromNpcMarket(db, { ...input, itemKey: "barley", expectedUnitPrice: 2 })));
    expect(Either.isLeft(result) && result.left).toMatchObject({ rule: { type: "idempotency_conflict" } });
  });

  it("serializes two buyers competing for the final barley", async () => {
    const { input, order, buyer } = await fixture(1);
    const other = await player();
    const connections = [new Client({ connectionString }), new Client({ connectionString })];
    await Promise.all(connections.map(connection => connection.connect()));
    try {
      const results = await Promise.all(connections.map((connection, index) => Effect.runPromise(Effect.either(buyMarketSellOrder(createDatabase(connection), { ...input, quantity: 1, playerId: index === 0 ? buyer.id : other.id, idempotencyKey: randomUUID() })))));
      expect(results.filter(Either.isRight)).toHaveLength(1);
      expect(results.filter(Either.isLeft)).toHaveLength(1);
      const trades = await db.select().from(marketTrades).where(eq(marketTrades.orderId, order.id));
      expect(trades).toHaveLength(1);
      const [remaining] = await db.select().from(marketOrders).where(eq(marketOrders.id, order.id));
      expect(remaining?.remainingQuantity).toBe(0);
    } finally {
      await Promise.all(connections.map(connection => connection.end()));
    }
  });

  it("settles a simultaneous retry only once", async () => {
    const { input, order } = await fixture();
    const connections = [new Client({ connectionString }), new Client({ connectionString })];
    await Promise.all(connections.map(connection => connection.connect()));
    try {
      const results = await Promise.all(connections.map(connection => Effect.runPromise(buyMarketSellOrder(createDatabase(connection), input))));
      expect(results.map(snapshot => snapshot.player.shekelBalance)).toEqual([14, 14]);
      const trades = await db.select().from(marketTrades).where(eq(marketTrades.orderId, order.id));
      expect(trades).toHaveLength(1);
    } finally {
      await Promise.all(connections.map(connection => connection.end()));
    }
  });

  it("conserves the final barley when cancellation competes with a purchase", async () => {
    const { input, order, seller, buyer } = await fixture(1);
    const connections = [new Client({ connectionString }), new Client({ connectionString })];
    await Promise.all(connections.map(connection => connection.connect()));
    try {
      const outcomes = await Promise.all([
        Effect.runPromise(Effect.either(buyMarketSellOrder(createDatabase(connections[0]!), { ...input, quantity: 1 }))),
        Effect.runPromise(Effect.either(cancelMarketSellOrder(createDatabase(connections[1]!), { playerId: seller.id, orderId: order.id, expectedFarmVersion: 2 })))
      ]);
      expect(outcomes.filter(Either.isRight)).toHaveLength(1);
      const inventory = await db.select().from(farmInventory).where(inArray(farmInventory.farmId, [seller.farmId, buyer.farmId]));
      expect(inventory.reduce((sum, entry) => sum + entry.quantity, 0)).toBe(1);
      const wallets = await db.select().from(players).where(inArray(players.id, [seller.id, buyer.id]));
      expect(wallets.reduce((sum, wallet) => sum + wallet.shekelBalance, 0)).toBe(20);
      const [finalOrder] = await db.select().from(marketOrders).where(eq(marketOrders.id, order.id));
      expect(finalOrder?.remainingQuantity).toBe(0);
    } finally {
      await Promise.all(connections.map(connection => connection.end()));
    }
  });
});
