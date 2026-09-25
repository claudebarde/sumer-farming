import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { Effect } from "effect";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { createDatabase, type Database } from "../../src/server/db/client";
import {
  farmBuildings,
  farmInventory,
  farms,
  marketOrders,
  players
} from "../../src/server/db/schema";
import { getMarketQuotes } from "../../src/server/services/marketQuotes";
import { getMarketListings } from "../../src/server/services/marketListings";
import {
  cancelMarketSellOrder,
  createMarketSellOrder
} from "../../src/server/services/marketSellOrders";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgres://sumer:sumer_dev@localhost:5432/sumer_farming";

describe.sequential("player market sell orders", () => {
  let client: Client;
  let database: Database;
  const testPlayerIds = new Set<string>();

  const createFixture = async (): Promise<{
    readonly playerId: string;
    readonly farmId: string;
  }> => {
    const playerId = randomUUID();
    const farmId = randomUUID();
    const now = Date.now();
    testPlayerIds.add(playerId);

    await database.insert(players).values({
      id: playerId,
      displayName: `Sell order test ${playerId.slice(0, 8)}`
    });
    await database.insert(farms).values({ id: farmId, playerId });
    await database.insert(farmInventory).values({
      farmId,
      itemKey: "barley",
      quantity: 2
    });
    await database.insert(farmBuildings).values({
      farmId,
      type: "granary",
      column: 0,
      row: 0,
      storedBarley: 3,
      startedAt: new Date(now - 120_000),
      completesAt: new Date(now - 60_000)
    });

    return { playerId, farmId };
  };

  beforeAll(async () => {
    client = new Client({ connectionString: TEST_DATABASE_URL });
    await client.connect();
    database = createDatabase(client);
  });

  afterEach(async () => {
    for (const playerId of testPlayerIds) {
      await database.delete(players).where(eq(players.id, playerId));
    }
    testPlayerIds.clear();
  });

  afterAll(async () => {
    await client.end();
  });

  it("escrows stored barley and includes it in market statistics", async () => {
    const fixture = await createFixture();

    const snapshot = await Effect.runPromise(
      createMarketSellOrder(database, {
        playerId: fixture.playerId,
        itemKey: "barley",
        quantity: 4,
        unitPrice: 3,
        idempotencyKey: randomUUID(),
        expectedFarmVersion: 1
      })
    );

    expect(snapshot.inventory).not.toContainEqual(
      expect.objectContaining({ itemKey: "barley" })
    );
    expect(snapshot.buildings[0]?.storedBarley).toBe(1);
    expect(snapshot.farm.version).toBe(2);

    const quotes = await Effect.runPromise(
      getMarketQuotes(database, fixture.playerId)
    );
    expect(quotes.items[0]?.playerMarket.totalSellQuantity).toBeGreaterThanOrEqual(4);
    const listings = await Effect.runPromise(getMarketListings(database, fixture.playerId, { itemKey: "barley", action: "sell" }));
    expect(listings).toMatchObject({
      orders: expect.arrayContaining([
        expect.objectContaining({
          unitPrice: 3,
          remainingQuantity: 4
        })
      ])
    });
  });

  it("returns escrowed barley when its owner cancels an order", async () => {
    const fixture = await createFixture();
    const listed = await Effect.runPromise(
      createMarketSellOrder(database, {
        playerId: fixture.playerId,
        itemKey: "barley",
        quantity: 4,
        unitPrice: 3,
        idempotencyKey: randomUUID(),
        expectedFarmVersion: 1
      })
    );
    const [order] = await database
      .select({ id: marketOrders.id })
      .from(marketOrders)
      .where(eq(marketOrders.playerId, fixture.playerId));

    const cancelled = await Effect.runPromise(
      cancelMarketSellOrder(database, {
        playerId: fixture.playerId,
        orderId: order!.id,
        expectedFarmVersion: listed.farm.version
      })
    );

    expect(cancelled.inventory).toContainEqual({
      itemKey: "barley",
      quantity: 4
    });
    expect(cancelled.buildings[0]?.storedBarley).toBe(1);
    expect(cancelled.farm.version).toBe(3);

    const [cancelledOrder] = await database
      .select()
      .from(marketOrders)
      .where(eq(marketOrders.id, order!.id));
    expect(cancelledOrder).toMatchObject({
      status: "cancelled",
      remainingQuantity: 0
    });
  });

  it("applies a retried listing only once", async () => {
    const fixture = await createFixture();
    const command = {
      playerId: fixture.playerId,
      itemKey: "barley",
      quantity: 1,
      unitPrice: 2,
      idempotencyKey: randomUUID(),
      expectedFarmVersion: 1
    } as const;

    await Effect.runPromise(createMarketSellOrder(database, command));
    const retry = await Effect.runPromise(
      createMarketSellOrder(database, command)
    );
    const orders = await database
      .select()
      .from(marketOrders)
      .where(eq(marketOrders.playerId, fixture.playerId));

    expect(orders).toHaveLength(1);
    expect(retry.farm.version).toBe(2);
    expect(
      retry.inventory.find(item => item.itemKey === "barley")?.quantity
    ).toBe(1);
  });
});
