import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { Effect } from "effect";
import { Client } from "pg";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it
} from "vitest";

import { createDatabase, type Database } from "../../src/server/db/client";
import {
  farmBuildings,
  farmGroundItems,
  farmInventory,
  farms,
  players
} from "../../src/server/db/schema";
import { advanceFarmLifecycle } from "../../src/server/services/farmLifecycle";
import {
  depositCarriedItem,
  depositCarriedItemInGranary,
  withdrawBarleyFromGranary,
  withdrawInventoryItem
} from "../../src/server/services/farmItemActions";
import type { InventoryItemKey } from "../../src/game-data/inventoryItems";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgres://sumer:sumer_dev@localhost:5432/sumer_farming";

type FixtureOptions = {
  readonly carriedItem?: {
    readonly itemKey: InventoryItemKey;
    readonly quantity: number;
    readonly expiresAt?: Date;
  };
  readonly farmBarley?: number;
  readonly granaryBarley?: number;
};

type Fixture = {
  readonly playerId: string;
  readonly farmId: string;
  readonly granaryTarget: {
    readonly column: number;
    readonly row: number;
  };
};

describe.sequential("farm item storage actions", () => {
  let client: Client;
  let database: Database;
  const testPlayerIds = new Set<string>();

  const createFixture = async (
    options: FixtureOptions = {}
  ): Promise<Fixture> => {
    const playerId = randomUUID();
    const farmId = randomUUID();
    const granaryTarget = { column: 0, row: 0 } as const;
    const now = Date.now();

    testPlayerIds.add(playerId);

    await database.insert(players).values({
      id: playerId,
      displayName: `Storage test ${playerId.slice(0, 8)}`
    });
    await database.insert(farms).values({
      id: farmId,
      playerId,
      carriedItemKey: options.carriedItem?.itemKey ?? null,
      carriedItemQuantity: options.carriedItem?.quantity ?? 0,
      carriedItemExpiresAt: options.carriedItem?.expiresAt ?? null
    });

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
        ...granaryTarget,
        storedBarley: options.granaryBarley,
        startedAt: new Date(now - 120_000),
        completesAt: new Date(now - 60_000)
      });
    }

    return { playerId, farmId, granaryTarget };
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

  it("deposits carried barley into the farm building", async () => {
    const fixture = await createFixture({
      carriedItem: { itemKey: "barley", quantity: 2 }
    });

    const snapshot = await Effect.runPromise(
      depositCarriedItem(database, {
        playerId: fixture.playerId,
        expectedFarmVersion: 1
      })
    );

    expect(snapshot.farm.carriedItem).toBeNull();
    expect(snapshot.player.shekelBalance).toBe(0);
    expect(snapshot.inventory).toContainEqual({
      itemKey: "barley",
      quantity: 2
    });
    expect(snapshot.farm.version).toBe(2);
  });

  it("withdraws one barley from the farm building", async () => {
    const fixture = await createFixture({ farmBarley: 2 });

    const snapshot = await Effect.runPromise(
      withdrawInventoryItem(database, {
        playerId: fixture.playerId,
        itemKey: "barley",
        expectedFarmVersion: 1
      })
    );

    expect(snapshot.farm.carriedItem).toMatchObject({
      itemKey: "barley",
      quantity: 1
    });
    expect(snapshot.inventory).toContainEqual({
      itemKey: "barley",
      quantity: 1
    });
    expect(snapshot.farm.version).toBe(2);
  });

  it("deposits carried barley into a completed granary", async () => {
    const fixture = await createFixture({
      carriedItem: { itemKey: "barley", quantity: 2 },
      granaryBarley: 3
    });

    const snapshot = await Effect.runPromise(
      depositCarriedItemInGranary(database, {
        playerId: fixture.playerId,
        target: fixture.granaryTarget,
        expectedFarmVersion: 1
      })
    );

    expect(snapshot.farm.carriedItem).toBeNull();
    expect(snapshot.buildings[0]?.storedBarley).toBe(5);
    expect(snapshot.farm.version).toBe(2);
  });

  it("withdraws one barley from a completed granary", async () => {
    const fixture = await createFixture({ granaryBarley: 5 });

    const snapshot = await Effect.runPromise(
      withdrawBarleyFromGranary(database, {
        playerId: fixture.playerId,
        target: fixture.granaryTarget,
        expectedFarmVersion: 1
      })
    );

    expect(snapshot.farm.carriedItem).toMatchObject({
      itemKey: "barley",
      quantity: 1
    });
    expect(snapshot.buildings[0]?.storedBarley).toBe(4);
    expect(snapshot.farm.version).toBe(2);
  });

  it("rejects a granary withdrawal when the granary is empty", async () => {
    const fixture = await createFixture({ granaryBarley: 0 });

    const error = await Effect.runPromise(
      Effect.flip(
        withdrawBarleyFromGranary(database, {
          playerId: fixture.playerId,
          target: fixture.granaryTarget,
          expectedFarmVersion: 1
        })
      )
    );

    expect(error).toMatchObject({
      _tag: "FarmItemRuleError",
      rule: { type: "granary_empty" }
    });
  });

  it("rejects withdrawals while the farmer is carrying an item", async () => {
    const fixture = await createFixture({
      carriedItem: { itemKey: "clay", quantity: 1 },
      farmBarley: 1,
      granaryBarley: 1
    });

    const farmError = await Effect.runPromise(
      Effect.flip(
        withdrawInventoryItem(database, {
          playerId: fixture.playerId,
          itemKey: "barley",
          expectedFarmVersion: 1
        })
      )
    );
    const granaryError = await Effect.runPromise(
      Effect.flip(
        withdrawBarleyFromGranary(database, {
          playerId: fixture.playerId,
          target: fixture.granaryTarget,
          expectedFarmVersion: 1
        })
      )
    );

    expect(farmError).toMatchObject({
      _tag: "FarmItemRuleError",
      rule: { type: "farmer_hands_not_empty" }
    });
    expect(granaryError).toMatchObject({
      _tag: "FarmItemRuleError",
      rule: { type: "farmer_hands_not_empty" }
    });
  });

  it("consumes farm barley before granary barley", async () => {
    const fixture = await createFixture({ farmBarley: 1, granaryBarley: 2 });
    const now = new Date();
    await database
      .update(farms)
      .set({
        cultivationStartedAt: new Date(now.getTime() - 172_800_000),
        nextBarleyConsumptionAt: new Date(now.getTime() - 90_000_000)
      })
      .where(eq(farms.id, fixture.farmId));

    const updatedFarm = await database.transaction(async transaction => {
      const farm = (
        await transaction
          .select()
          .from(farms)
          .where(eq(farms.id, fixture.farmId))
          .limit(1)
      )[0];
      if (farm === undefined) {
        throw new Error("Test farm was not created");
      }
      return advanceFarmLifecycle(transaction, farm, now);
    });
    const inventory = await database
      .select()
      .from(farmInventory)
      .where(eq(farmInventory.farmId, fixture.farmId));
    const [granary] = await database
      .select()
      .from(farmBuildings)
      .where(eq(farmBuildings.farmId, fixture.farmId));

    expect(inventory).toHaveLength(0);
    expect(granary?.storedBarley).toBe(1);
    expect(updatedFarm.hungrySince).toBeNull();
    expect(updatedFarm.nextBarleyConsumptionAt?.getTime()).toBeGreaterThan(
      now.getTime()
    );
  });

  it("expires barley carried or left on the ground after three days", async () => {
    const now = new Date();
    const fixture = await createFixture({
      carriedItem: {
        itemKey: "barley",
        quantity: 1,
        expiresAt: new Date(now.getTime() - 1)
      }
    });
    await database.insert(farmGroundItems).values({
      farmId: fixture.farmId,
      itemKey: "barley",
      quantity: 1,
      column: 0,
      row: 1,
      expiresAt: new Date(now.getTime() - 1)
    });

    const updatedFarm = await database.transaction(async transaction => {
      const farm = (
        await transaction
          .select()
          .from(farms)
          .where(eq(farms.id, fixture.farmId))
          .limit(1)
      )[0];
      if (farm === undefined) {
        throw new Error("Test farm was not created");
      }
      return advanceFarmLifecycle(transaction, farm, now);
    });
    const exposedBarley = await database
      .select()
      .from(farmGroundItems)
      .where(eq(farmGroundItems.farmId, fixture.farmId));

    expect(updatedFarm.carriedItemKey).toBeNull();
    expect(updatedFarm.carriedItemQuantity).toBe(0);
    expect(exposedBarley).toHaveLength(0);
  });

  it("marks the household hungry without accumulating ration debt", async () => {
    const fixture = await createFixture();
    const now = new Date();
    await database
      .update(farms)
      .set({
        cultivationStartedAt: new Date(now.getTime() - 864_000_000),
        nextBarleyConsumptionAt: new Date(now.getTime() - 864_000_000)
      })
      .where(eq(farms.id, fixture.farmId));

    const updatedFarm = await database.transaction(async transaction => {
      const farm = (
        await transaction
          .select()
          .from(farms)
          .where(eq(farms.id, fixture.farmId))
          .limit(1)
      )[0];

      if (farm === undefined) {
        throw new Error("Test farm was not created");
      }

      return advanceFarmLifecycle(transaction, farm, now);
    });

    expect(updatedFarm.hungrySince).not.toBeNull();
    expect(updatedFarm.nextBarleyConsumptionAt?.getTime()).toBe(
      now.getTime() + 86_400_000
    );
  });
});
