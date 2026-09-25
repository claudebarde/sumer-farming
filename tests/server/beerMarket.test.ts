import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { Effect } from "effect";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createDatabase } from "../../src/server/db/client";
import { farmInventory, farms, marketOrders, marketTrades, players, shekelTransactions } from "../../src/server/db/schema";
import { buyFromNpcMarket, sellToNpcMarket } from "../../src/server/services/tradeMarketItem";
import { cancelMarketSellOrder, createMarketSellOrder } from "../../src/server/services/marketSellOrders";
import { buyMarketSellOrder } from "../../src/server/services/buyMarketSellOrder";
import { buildMarketQuotes } from "../../src/server/services/marketQuotes";

const client = new Client({ connectionString: process.env.TEST_DATABASE_URL ?? "postgres://sumer:sumer_dev@localhost:5432/sumer_farming" });
const db = createDatabase(client);
const ids = new Set<string>();
beforeAll(() => client.connect());
afterEach(async () => {
  if (ids.size) await db.delete(players).where(inArray(players.id, [...ids]));
  ids.clear();
});
afterAll(() => client.end());

const fixture = async (beer = 4) => {
  const playerId = randomUUID();
  ids.add(playerId);
  await db.insert(players).values({ id: playerId, displayName: "Beer market test", shekelBalance: 20 });
  const [farm] = await db.insert(farms).values({ playerId }).returning();
  await db.insert(farmInventory).values([
    { farmId: farm!.id, itemKey: "beer", quantity: beer },
    { farmId: farm!.id, itemKey: "barley", quantity: 5 },
    { farmId: farm!.id, itemKey: "emptyBeerJar", quantity: 3 }
  ]);
  return { playerId, farmId: farm!.id, itemKey: "beer" as const, quantity: 2,
    expectedUnitPrice: 5, expectedFarmVersion: 1, idempotencyKey: randomUUID() };
};

describe("beer markets", () => {
  it("offers NPC sales only and player listings with a five-shekel initial suggestion", () => {
    const beer = buildMarketQuotes([], "player").items.find(item => item.itemKey === "beer");
    expect(beer).toMatchObject({
      storageType: "estate_inventory",
      npcMarket: { canBuy: false, canSell: true, sellPrice: 5 },
      playerMarket: { canCreateSellOrder: true, suggestedSellPrice: 5 }
    });
  });

  it("sells filled jars for five shekels each and does not pay a retry twice", async () => {
    const input = await fixture();
    const sold = await Effect.runPromise(sellToNpcMarket(db, input));
    const retry = await Effect.runPromise(sellToNpcMarket(db, input));
    expect(sold.player.shekelBalance).toBe(30);
    expect(retry.player.shekelBalance).toBe(30);
    expect(retry.inventory).toEqual(expect.arrayContaining([
      { itemKey: "beer", quantity: 2 }, { itemKey: "emptyBeerJar", quantity: 3 }, { itemKey: "barley", quantity: 5 }
    ]));
    const ledger = await db.select().from(shekelTransactions).where(eq(shekelTransactions.playerId, input.playerId));
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({ itemKey: "beer", delta: 10, itemQuantity: 2, source: "npc" });
  });

  it("rejects NPC purchases, insufficient stock and stale prices without changing inventory", async () => {
    const input = await fixture(1);
    await expect(Effect.runPromise(Effect.flip(buyFromNpcMarket(db, input))))
      .resolves.toMatchObject({ rule: { type: "trade_unavailable" } });
    await expect(Effect.runPromise(Effect.flip(sellToNpcMarket(db, input))))
      .resolves.toMatchObject({ rule: { type: "insufficient_stored_item" } });
    await expect(Effect.runPromise(Effect.flip(sellToNpcMarket(db, { ...input, quantity: 1, expectedUnitPrice: 6 }))))
      .resolves.toMatchObject({ rule: { type: "price_changed" } });
    expect((await db.select().from(farms).where(eq(farms.id, input.farmId)))[0]?.version).toBe(1);
    expect(await db.select().from(shekelTransactions).where(eq(shekelTransactions.playerId, input.playerId))).toHaveLength(0);
  });

  it("escrows beer, transfers it to a buyer with full barley storage and returns unsold jars on cancellation", async () => {
    const seller = await fixture();
    const buyer = await fixture(0);
    const listing = { ...seller, quantity: 3, unitPrice: 7 };
    const listed = await Effect.runPromise(createMarketSellOrder(db, listing));
    const retried = await Effect.runPromise(createMarketSellOrder(db, listing));
    expect(listed.inventory.find(item => item.itemKey === "beer")?.quantity).toBe(1);
    expect(retried.inventory).toEqual(listed.inventory);
    const [order] = await db.select().from(marketOrders).where(eq(marketOrders.playerId, seller.playerId));
    const purchase = { ...buyer, orderId: order!.id, quantity: 2, expectedUnitPrice: 7 };
    const bought = await Effect.runPromise(buyMarketSellOrder(db, purchase));
    const retry = await Effect.runPromise(buyMarketSellOrder(db, purchase));
    expect(bought.player.shekelBalance).toBe(6);
    expect(retry.inventory).toEqual(bought.inventory);
    expect(bought.inventory).toEqual(expect.arrayContaining([
      { itemKey: "beer", quantity: 2 }, { itemKey: "barley", quantity: 5 }, { itemKey: "emptyBeerJar", quantity: 3 }
    ]));
    const cancelled = await Effect.runPromise(cancelMarketSellOrder(db, {
      playerId: seller.playerId, orderId: order!.id, expectedFarmVersion: 3
    }));
    expect(cancelled.player.shekelBalance).toBe(34);
    expect(cancelled.inventory.find(item => item.itemKey === "beer")?.quantity).toBe(2);
    const ledger = await db.select().from(shekelTransactions).where(inArray(shekelTransactions.playerId, [seller.playerId, buyer.playerId]));
    expect(ledger).toHaveLength(2);
    expect(ledger.reduce((sum, entry) => sum + entry.delta, 0)).toBe(0);
    const trades = await db.select().from(marketTrades).where(eq(marketTrades.orderId, order!.id));
    expect(trades).toHaveLength(1);
    expect(trades[0]).toMatchObject({ itemKey: "beer", quantity: 2, unitPrice: 7 });
  });
});
