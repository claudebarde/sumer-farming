import { randomUUID } from "node:crypto";
import { eq, inArray, sql } from "drizzle-orm";
import { Effect } from "effect";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createDatabase } from "../../src/server/db/client";
import { marketOrders, players } from "../../src/server/db/schema";
import { getMarketListings } from "../../src/server/services/marketListings";
import { getMarketQuotes } from "../../src/server/services/marketQuotes";
import { MarketListingsPageSchema, type MarketListingCursor } from "../../src/schemas/marketListings";

const client = new Client({ connectionString: process.env.TEST_DATABASE_URL ?? "postgres://sumer:sumer_dev@localhost:5432/sumer_farming" });
const db = createDatabase(client);
const ids = new Set<string>();
beforeAll(() => client.connect());
afterEach(async () => {
  if (ids.size) await db.delete(players).where(inArray(players.id, [...ids]));
  ids.clear();
});
afterAll(() => client.end());

// Use a catalog item that cannot yet be listed through the UI, isolating these
// synthetic order-book fixtures from the user's barley listings.
const itemKey = "brewingVessels" as const;
const makePlayer = async () => {
  const id = randomUUID();
  ids.add(id);
  await db.insert(players).values({ id, displayName: "Listing pagination test" });
  return id;
};
const fixture = async () => {
  const seller = await makePlayer();
  const buyer = await makePlayer();
  const orders = Array.from({ length: 12 }, (_, index) => ({
    id: randomUUID(), playerId: seller, idempotencyKey: randomUUID(),
    side: "sell" as const, itemKey, unitPrice: 3 - Math.floor(index / 4),
    originalQuantity: 1, remainingQuantity: 1,
    createdAt: new Date(Date.UTC(2000, 0, 1, 0, 0, index % 2))
  }));
  await db.insert(marketOrders).values(orders);
  await db.insert(marketOrders).values({
    playerId: buyer, idempotencyKey: randomUUID(), side: "sell",
    itemKey, unitPrice: 1, originalQuantity: 1, remainingQuantity: 1
  });
  const sorted = orders.toSorted((a, b) =>
    a.unitPrice - b.unitPrice || a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id)
  );
  return { seller, buyer, sorted };
};
function page(playerId: string, action: "buy" | "sell", after?: MarketListingCursor) {
  return Effect.runPromise(getMarketListings(db, playerId, { itemKey, action, after }));
}

describe("market listing pages", () => {
  it("returns 5/5/2 cheapest-first orders without duplicates and excludes the buyer's orders", async () => {
    const { buyer, sorted } = await fixture();
    const first = MarketListingsPageSchema.parse(await page(buyer, "buy"));
    const second = await page(buyer, "buy", first.nextCursor!);
    const third = await page(buyer, "buy", second.nextCursor!);
    expect([first.orders.length, second.orders.length, third.orders.length]).toEqual([5, 5, 2]);
    expect(third.nextCursor).toBeNull();
    expect([...first.orders, ...second.orders, ...third.orders].map(order => order.id)).toEqual(sorted.map(order => order.id));
    expect(await page(buyer, "buy")).toEqual(first);
    expect(await page(buyer, "buy", first.nextCursor!)).toEqual(second);
  });

  it("shows only the requesting player's orders on Sell", async () => {
    const { buyer, seller } = await fixture();
    const own = await page(buyer, "sell");
    expect(own.orders).toHaveLength(1);
    expect(own.nextCursor).toBeNull();
    const sellers = await page(seller, "sell");
    expect(sellers.orders).toHaveLength(5);
    expect(sellers.orders.some(order => order.id === own.orders[0]!.id)).toBe(false);
  });

  it("continues after a cancelled cursor order and excludes filled orders", async () => {
    const { buyer, sorted } = await fixture();
    const first = await page(buyer, "buy");
    await db.update(marketOrders).set({ status: "cancelled", remainingQuantity: 0 }).where(eq(marketOrders.id, first.nextCursor!.id));
    await db.update(marketOrders).set({ status: "filled", remainingQuantity: 0 }).where(eq(marketOrders.id, sorted[5]!.id));
    const second = await page(buyer, "buy", first.nextCursor!);
    expect(second.orders.map(order => order.id)).toEqual(sorted.slice(6, 11).map(order => order.id));
  });

  it("keeps market-wide totals independent of the five-row page", async () => {
    const { buyer } = await fixture();
    const quotes = await Effect.runPromise(getMarketQuotes(db, buyer));
    const market = quotes.items.find(item => item.itemKey === itemKey)!.playerMarket;
    expect(market.totalSellQuantity).toBe(13);
    expect(market.lowestSellPrice).toBe(1);
    expect(market.weightedAverageSellPrice).toBeCloseTo(25 / 13);
    expect(market).not.toHaveProperty("openSellOrders");
  });

  it("preserves timestamp precision in cursors", async () => {
    const { buyer, seller } = await fixture();
    await db.update(marketOrders).set({ createdAt: sql`'2000-01-01T00:00:00.123456Z'::timestamptz` }).where(eq(marketOrders.playerId, seller));
    const first = MarketListingsPageSchema.parse(await page(buyer, "buy"));
    expect(first.nextCursor!.createdAt).toContain(".123456Z");
    const second = await page(buyer, "buy", first.nextCursor!);
    expect(second.orders).toHaveLength(5);
    expect(second.orders.some(order => first.orders.some(previous => previous.id === order.id))).toBe(false);
  });
});
