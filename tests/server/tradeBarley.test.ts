import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { Effect } from "effect";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { MARKET_ITEM_DEFINITIONS } from "../../src/game-data/marketItems";
import { createDatabase, type Database } from "../../src/server/db/client";
import {
  farmBuildings,
  farmInventory,
  farms,
  players,
  shekelTransactions
} from "../../src/server/db/schema";
import {
  buyFromNpcMarket,
  sellToNpcMarket
} from "../../src/server/services/tradeMarketItem";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgres://sumer:sumer_dev@localhost:5432/sumer_farming";

type FixtureOptions = {
  readonly shekelBalance?: number;
  readonly farmBarley?: number;
  readonly granaryBarley?: number;
};

type Fixture = {
  readonly playerId: string;
  readonly farmId: string;
};

describe.sequential("NPC barley market", () => {
  let client: Client;
  let database: Database;
  const testPlayerIds = new Set<string>();

  const createFixture = async (
    options: FixtureOptions = {}
  ): Promise<Fixture> => {
    const playerId = randomUUID();
    const farmId = randomUUID();
    const now = Date.now();
    testPlayerIds.add(playerId);

    await database.insert(players).values({
      id: playerId,
      displayName: `Market test ${playerId.slice(0, 8)}`,
      shekelBalance: options.shekelBalance ?? 0
    });
    await database.insert(farms).values({ id: farmId, playerId });

    if (options.farmBarley !== undefined) {
      await database.insert(farmInventory).values({
        farmId,
        itemKey: "barley",
        quantity: options.farmBarley
      });
    }

    if (options.granaryBarley !== undefined) {
      await database.insert(farmBuildings).values({
        farmId,
        type: "granary",
        column: 0,
        row: 0,
        storedBarley: options.granaryBarley,
        startedAt: new Date(now - 120_000),
        completesAt: new Date(now - 60_000)
      });
    }

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

  it("sells safely stored barley and records the proceeds", async () => {
    const fixture = await createFixture({ farmBarley: 2, granaryBarley: 3 });

    const snapshot = await Effect.runPromise(
      sellToNpcMarket(database, {
        playerId: fixture.playerId,
        itemKey: "barley",
        quantity: 4,
        expectedUnitPrice: MARKET_ITEM_DEFINITIONS.barley.npcMarket.sellPrice,
        idempotencyKey: randomUUID(),
        expectedFarmVersion: 1
      })
    );

    expect(snapshot.player.shekelBalance).toBe(
      4 * MARKET_ITEM_DEFINITIONS.barley.npcMarket.sellPrice
    );
    expect(snapshot.inventory).not.toContainEqual(
      expect.objectContaining({ itemKey: "barley" })
    );
    expect(snapshot.buildings[0]?.storedBarley).toBe(1);
    expect(snapshot.farm.version).toBe(2);

    const [ledgerEntry] = await database
      .select()
      .from(shekelTransactions)
      .where(eq(shekelTransactions.playerId, fixture.playerId));
    expect(ledgerEntry).toMatchObject({
      type: "market_sale",
      delta: 4,
      balanceAfter: 4,
      itemKey: "barley",
      itemQuantity: 4,
      unitPrice: MARKET_ITEM_DEFINITIONS.barley.npcMarket.sellPrice
    });
  });

  it("buys barley and fills the farm before completed granaries", async () => {
    const fixture = await createFixture({
      shekelBalance: 10,
      farmBarley: 4,
      granaryBarley: 14
    });

    const snapshot = await Effect.runPromise(
      buyFromNpcMarket(database, {
        playerId: fixture.playerId,
        itemKey: "barley",
        quantity: 2,
        expectedUnitPrice: MARKET_ITEM_DEFINITIONS.barley.npcMarket.buyPrice,
        idempotencyKey: randomUUID(),
        expectedFarmVersion: 1
      })
    );

    expect(snapshot.player.shekelBalance).toBe(
      10 - 2 * MARKET_ITEM_DEFINITIONS.barley.npcMarket.buyPrice
    );
    expect(snapshot.inventory).toContainEqual({
      itemKey: "barley",
      quantity: 5
    });
    expect(snapshot.buildings[0]?.storedBarley).toBe(15);
  });

  it("rejects sales that include carried or exposed barley", async () => {
    const fixture = await createFixture({ farmBarley: 1 });
    await database
      .update(farms)
      .set({ carriedItemKey: "barley", carriedItemQuantity: 1 })
      .where(eq(farms.id, fixture.farmId));

    const error = await Effect.runPromise(
      Effect.flip(
        sellToNpcMarket(database, {
          playerId: fixture.playerId,
          itemKey: "barley",
          quantity: 2,
          expectedUnitPrice:
            MARKET_ITEM_DEFINITIONS.barley.npcMarket.sellPrice,
          idempotencyKey: randomUUID(),
          expectedFarmVersion: 1
        })
      )
    );

    expect(error).toMatchObject({
      _tag: "MarketTradeRuleError",
      rule: {
        type: "insufficient_stored_item",
        itemKey: "barley",
        requested: 2,
        available: 1
      }
    });
  });

  it("rejects purchases without enough shekels or storage", async () => {
    const noMoney = await createFixture({ shekelBalance: 1 });
    const noMoneyError = await Effect.runPromise(
      Effect.flip(
        buyFromNpcMarket(database, {
          playerId: noMoney.playerId,
          itemKey: "barley",
          quantity: 1,
          expectedUnitPrice:
            MARKET_ITEM_DEFINITIONS.barley.npcMarket.buyPrice,
          idempotencyKey: randomUUID(),
          expectedFarmVersion: 1
        })
      )
    );
    expect(noMoneyError).toMatchObject({
      _tag: "MarketTradeRuleError",
      rule: { type: "insufficient_shekels" }
    });

    const noSpace = await createFixture({ shekelBalance: 10, farmBarley: 5 });
    const noSpaceError = await Effect.runPromise(
      Effect.flip(
        buyFromNpcMarket(database, {
          playerId: noSpace.playerId,
          itemKey: "barley",
          quantity: 1,
          expectedUnitPrice:
            MARKET_ITEM_DEFINITIONS.barley.npcMarket.buyPrice,
          idempotencyKey: randomUUID(),
          expectedFarmVersion: 1
        })
      )
    );
    expect(noSpaceError).toMatchObject({
      _tag: "MarketTradeRuleError",
      rule: { type: "insufficient_storage" }
    });
  });

  it("applies a retried trade only once", async () => {
    const fixture = await createFixture({ farmBarley: 2 });
    const command = {
      playerId: fixture.playerId,
      itemKey: "barley",
      quantity: 1,
      expectedUnitPrice: MARKET_ITEM_DEFINITIONS.barley.npcMarket.sellPrice,
      idempotencyKey: randomUUID(),
      expectedFarmVersion: 1
    } as const;

    await Effect.runPromise(sellToNpcMarket(database, command));
    const retrySnapshot = await Effect.runPromise(
      sellToNpcMarket(database, command)
    );

    expect(retrySnapshot.player.shekelBalance).toBe(1);
    expect(retrySnapshot.inventory).toContainEqual({
      itemKey: "barley",
      quantity: 1
    });
    expect(retrySnapshot.farm.version).toBe(2);

    const ledgerEntries = await database
      .select()
      .from(shekelTransactions)
      .where(
        and(
          eq(shekelTransactions.playerId, fixture.playerId),
          eq(shekelTransactions.idempotencyKey, command.idempotencyKey)
        )
      );
    expect(ledgerEntries).toHaveLength(1);
  });

  it("rejects a trade submitted with a stale or manipulated quote", async () => {
    const fixture = await createFixture({ farmBarley: 1 });

    const error = await Effect.runPromise(
      Effect.flip(
        sellToNpcMarket(database, {
          playerId: fixture.playerId,
          itemKey: "barley",
          quantity: 1,
          expectedUnitPrice: 99,
          idempotencyKey: randomUUID(),
          expectedFarmVersion: 1
        })
      )
    );

    expect(error).toMatchObject({
      _tag: "MarketTradeRuleError",
      rule: {
        type: "price_changed",
        expectedUnitPrice: 99,
        currentUnitPrice: MARKET_ITEM_DEFINITIONS.barley.npcMarket.sellPrice
      }
    });
  });
});
