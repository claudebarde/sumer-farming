import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { Effect } from "effect";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createDatabase } from "../../src/server/db/client";
import { farmInventory, farmGroundItems, farms, marketOrders, marketTrades, players, shekelTransactions } from "../../src/server/db/schema";
import { buildFarmBuilding } from "../../src/server/services/buildFarmBuilding";
import { marketIncludesItem } from "../../src/client/stores/marketUiStore";
import { buyFromNpcMarket, sellToNpcMarket } from "../../src/server/services/tradeMarketItem";
import { cancelMarketSellOrder, createMarketSellOrder } from "../../src/server/services/marketSellOrders";
import { buyMarketSellOrder } from "../../src/server/services/buyMarketSellOrder";
import { buildMarketQuotes } from "../../src/server/services/marketQuotes";
import { commandUnlockLevel } from "../../src/game-core/farm/commandUnlock";
import { GameCommandSchema } from "../../src/schemas/gameCommands";

const client = new Client({ connectionString: process.env.TEST_DATABASE_URL ?? "postgres://sumer:sumer_dev@localhost:5432/sumer_farming" });
const db = createDatabase(client);
const ids = new Set<string>();
beforeAll(() => client.connect());
afterEach(async () => {
  if (ids.size) await db.delete(players).where(inArray(players.id, [...ids]));
  ids.clear();
});
afterAll(() => client.end());

const fixture = async (bread = 4) => {
  const playerId = randomUUID();
  ids.add(playerId);
  await db.insert(players).values({ id: playerId, displayName: "Bread market test", shekelBalance: 20 });
  const [farm] = await db.insert(farms).values({ playerId, level: 6 }).returning();
  await db.insert(farmInventory).values([
    { farmId: farm!.id, itemKey: "bread", quantity: bread },
    { farmId: farm!.id, itemKey: "barley", quantity: 5 }
  ]);
  return { playerId, farmId: farm!.id, itemKey: "bread" as const, quantity: 2,
    expectedUnitPrice: 5, expectedFarmVersion: 1, idempotencyKey: randomUUID() };
};

describe("bread markets", () => {
  it.each(["flour", "brewersGroats"] as const)("trades %s through NPC and player markets without production credit", async itemKey => {
    const input = { ...await fixture(), itemKey, expectedUnitPrice: 4 };
    const bought = await Effect.runPromise(buyFromNpcMarket(db, input));
    expect(bought.player.shekelBalance).toBe(12);
    expect(bought.inventory.find(i => i.itemKey === itemKey)?.quantity).toBe(2);
    expect(bought.farm.progression?.stats.processedBarley ?? 0).toBe(0);
    const sold = await Effect.runPromise(sellToNpcMarket(db, { ...input, quantity: 1, expectedUnitPrice: 3, expectedFarmVersion: bought.farm.version, idempotencyKey: randomUUID() }));
    expect(sold.player.shekelBalance).toBe(15);
    const listed = await Effect.runPromise(createMarketSellOrder(db, { ...input, quantity: 1, unitPrice: 3, expectedFarmVersion: sold.farm.version, idempotencyKey: randomUUID() }));
    expect(listed).toBeDefined();
  });
  it("buys two baking tools for 12 shekels and consumes them when building an oven", async () => {
    const input = await fixture();
    await db.insert(farmGroundItems).values([
      { farmId: input.farmId, itemKey: "reed", quantity: 4, column: 0, row: 0 },
      { farmId: input.farmId, itemKey: "clay", quantity: 6, column: 1, row: 0 }
    ]);
    const construction = { playerId: input.playerId, expectedFarmVersion: 1, building: "breadOven" as const, target: { column: 5, row: 3 } };
    await expect(Effect.runPromise(Effect.flip(buildFarmBuilding(db, construction)))).resolves.toMatchObject({ rule: { type: "missing_material", itemKey: "bakingTools" } });
    const purchase = { ...input, itemKey: "bakingTools" as const, expectedUnitPrice: 6 };
    const bought = await Effect.runPromise(buyFromNpcMarket(db, purchase));
    expect(bought.player.shekelBalance).toBe(8);
    expect(bought.inventory.find(i => i.itemKey === "bakingTools")?.quantity).toBe(2);
    const retry = await Effect.runPromise(buyFromNpcMarket(db, purchase));
    expect(retry.player.shekelBalance).toBe(8);
    const built = await Effect.runPromise(buildFarmBuilding(db, { ...construction, expectedFarmVersion: bought.farm.version }));
    expect(built.buildings.some(b => b.type === "breadOven")).toBe(true);
    expect(built.inventory.find(i => i.itemKey === "bakingTools")?.quantity ?? 0).toBe(0);
  });

  it("offers baking tools only in the NPC bread buy tab at level 6", () => {
    expect(marketIncludesItem("bread", "bakingTools", { market: "npc", action: "buy" })).toBe(true);
    expect(marketIncludesItem("bread", "bakingTools", { market: "npc", action: "sell" })).toBe(false);
    expect(marketIncludesItem("bread", "bakingTools", { market: "player", action: "buy" })).toBe(false);
    expect(marketIncludesItem("beer", "bakingTools", { market: "npc", action: "buy" })).toBe(false);
    expect(commandUnlockLevel(GameCommandSchema.parse({ type: "buy_from_npc_market", itemKey: "bakingTools", quantity: 2, expectedUnitPrice: 6, expectedFarmVersion: 1, idempotencyKey: randomUUID() }))).toBe(6);
  });
  it("matches beer prices and enables NPC buying, selling, and player listings", () => {
    const quotes = buildMarketQuotes([], "player");
    const bread = quotes.items.find(i => i.itemKey === "bread")!;
    const beer = quotes.items.find(i => i.itemKey === "beer")!;
    expect(bread).toMatchObject({ storageType: "estate_inventory", npcMarket: { canBuy: true, canSell: true, buyPrice: 5, sellPrice: 5 },
      playerMarket: { canCreateSellOrder: true, suggestedSellPrice: 5 } });
    expect(beer.npcMarket.sellPrice).toBe(8);
    expect(bread.npcMarket.sellPrice).toBeLessThan(beer.npcMarket.sellPrice);
  });

  it.each(["buy_from_npc_market", "sell_to_npc_market", "create_market_sell_order"] as const)("accepts %s for bread and locks it until level 6", type => {
    const command = GameCommandSchema.parse({ type, itemKey: "bread", quantity: 1, expectedUnitPrice: 5,
      unitPrice: 5, idempotencyKey: randomUUID(), expectedFarmVersion: 1 });
    expect(commandUnlockLevel(command)).toBe(6);
  });

  it("buys bread with full barley storage and does not charge retries twice", async () => {
    const input = await fixture(0);
    const bought = await Effect.runPromise(buyFromNpcMarket(db, input));
    const retry = await Effect.runPromise(buyFromNpcMarket(db, input));
    expect(bought.player.shekelBalance).toBe(10);
    expect(retry.inventory).toEqual(bought.inventory);
    expect(retry.player.shekelBalance).toBe(10);
    expect(bought.inventory).toEqual(expect.arrayContaining([{ itemKey: "bread", quantity: 2 }, { itemKey: "barley", quantity: 5 }]));
    expect(await db.select().from(shekelTransactions).where(eq(shekelTransactions.playerId, input.playerId))).toHaveLength(1);
  });

  it("sells stored bread for five shekels each exactly once", async () => {
    const input = await fixture();
    const sold = await Effect.runPromise(sellToNpcMarket(db, input));
    const retry = await Effect.runPromise(sellToNpcMarket(db, input));
    expect(sold.player.shekelBalance).toBe(30);
    expect(retry.player.shekelBalance).toBe(30);
    expect(sold.inventory.find(i => i.itemKey === "bread")?.quantity).toBe(2);
    expect(await db.select().from(shekelTransactions).where(eq(shekelTransactions.playerId, input.playerId))).toHaveLength(1);
  });

  it("cannot sell uncollected baskets or accept stale prices", async () => {
    const input = await fixture(0);
    await db.update(farms).set({ production: { pending: { [randomUUID()]: { itemKey: "bread", quantity: 10 } }, baking: {}, delivery: null } }).where(eq(farms.id, input.farmId));
    await expect(Effect.runPromise(Effect.flip(sellToNpcMarket(db, input)))).resolves.toMatchObject({ rule: { type: "insufficient_stored_item" } });
    await expect(Effect.runPromise(Effect.flip(buyFromNpcMarket(db, { ...input, expectedUnitPrice: 6 })))).resolves.toMatchObject({ rule: { type: "price_changed" } });
    expect(await db.select().from(shekelTransactions).where(eq(shekelTransactions.playerId, input.playerId))).toHaveLength(0);
  });

  it("escrows bread, transfers it to another player and returns unsold bread on cancellation", async () => {
    const seller = await fixture();
    const buyer = await fixture(0);
    const listing = { ...seller, quantity: 3, unitPrice: 5 };
    const listed = await Effect.runPromise(createMarketSellOrder(db, listing));
    expect(listed.inventory.find(i => i.itemKey === "bread")?.quantity).toBe(1);
    expect((await Effect.runPromise(createMarketSellOrder(db, listing))).inventory).toEqual(listed.inventory);
    const [order] = await db.select().from(marketOrders).where(eq(marketOrders.playerId, seller.playerId));
    const purchase = { ...buyer, orderId: order!.id, quantity: 2 };
    const bought = await Effect.runPromise(buyMarketSellOrder(db, purchase));
    expect(bought.inventory.find(i => i.itemKey === "bread")?.quantity).toBe(2);
    expect(bought.player.shekelBalance).toBe(10);
    expect((await Effect.runPromise(buyMarketSellOrder(db, purchase))).inventory).toEqual(bought.inventory);
    const cancelled = await Effect.runPromise(cancelMarketSellOrder(db, { playerId: seller.playerId, orderId: order!.id, expectedFarmVersion: 3 }));
    expect(cancelled.inventory.find(i => i.itemKey === "bread")?.quantity).toBe(2);
    expect(cancelled.player.shekelBalance).toBe(30);
    const ledger = await db.select().from(shekelTransactions).where(inArray(shekelTransactions.playerId, [seller.playerId, buyer.playerId]));
    expect(ledger.reduce((sum, entry) => sum + entry.delta, 0)).toBe(0);
    expect(await db.select().from(marketTrades).where(eq(marketTrades.orderId, order!.id))).toHaveLength(1);
  });
});
