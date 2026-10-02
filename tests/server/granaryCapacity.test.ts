import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { Effect } from "effect";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createDatabase } from "../../src/server/db/client";
import { farms, players, farmBuildings, farmInventory } from "../../src/server/db/schema";
import { depositCarriedItemInGranary } from "../../src/server/services/farmItemActions";
import { loadMarketItemStorage, addToMarketItemStorage } from "../../src/server/services/marketItemStorage";
import { granaryCapacityForLevel, calculateFarmStorageCapacity } from "../../src/game-data/storage";
import { INITIAL_PROGRESSION_STATS, LEVEL_UNLOCKS } from "../../src/game-data/progression";

const client = new Client({ connectionString: process.env.TEST_DATABASE_URL ?? "postgres://sumer:sumer_dev@localhost:5432/sumer_farming" });
const db = createDatabase(client);
const ids = new Set<string>();
beforeAll(() => client.connect());
afterEach(async () => { if (ids.size) await db.delete(players).where(inArray(players.id, [...ids])); ids.clear(); });
afterAll(() => client.end());
const fixture = async (level: number, storedBarley: number) => {
  const playerId = randomUUID(); ids.add(playerId);
  await db.insert(players).values({ id: playerId, displayName: "Granary capacity test" });
  const [farm] = await db.insert(farms).values({ playerId, level,
    progressionStats: { ...INITIAL_PROGRESSION_STATS, level6Baseline: { produced: 0, sold: 0 } }
  }).returning();
  const [granary] = await db.insert(farmBuildings).values({ farmId: farm!.id, type: "granary", column: 5, row: 3, storedBarley, startedAt: new Date(0), completesAt: new Date(1000) }).returning();
  return { playerId, farmId: farm!.id, granary: granary! };
};

describe("level-seven granary capacity", () => {
  it("uses 15 before level 7 and 20 thereafter, excluding unfinished granaries", () => {
    expect(granaryCapacityForLevel(6)).toBe(15);
    expect(granaryCapacityForLevel(7)).toBe(20);
    expect(granaryCapacityForLevel(8)).toBe(20);
    const buildings = [{ type: "granary" as const, completesAt: new Date(0) }, { type: "granary" as const, completesAt: new Date(2000) }];
    expect(calculateFarmStorageCapacity(buildings, 1000, 6)).toBe(20);
    expect(calculateFarmStorageCapacity(buildings, 1000, 7)).toBe(25);
    expect(calculateFarmStorageCapacity(buildings, 3000, 8)).toBe(45);
    expect(LEVEL_UNLOCKS[7]).toContain("Merchant requests");
    expect(LEVEL_UNLOCKS[7]).toContain("20 barley per granary");
  });
  it("upgrades an existing full granary without rebuilding and still rejects deposits above 20", async () => {
    const f = await fixture(6, 15);
    await db.update(farms).set({ carriedItemKey: "barley", carriedItemQuantity: 5, carriedItemExpiresAt: new Date(Date.now() + 60000) }).where(eq(farms.id, f.farmId));
    const input = { playerId: f.playerId, target: { column: 5, row: 3 }, expectedFarmVersion: 1 };
    await expect(Effect.runPromise(Effect.flip(depositCarriedItemInGranary(db, input)))).resolves.toMatchObject({ rule: { type: "granary_storage_full" } });
    await db.update(farms).set({ level: 7 }).where(eq(farms.id, f.farmId));
    const result = await Effect.runPromise(depositCarriedItemInGranary(db, input));
    expect(result.buildings[0]!.storedBarley).toBe(20);
    expect(result.farm.carriedItem).toBeNull();
    await db.update(farms).set({ carriedItemKey: "barley", carriedItemQuantity: 1, carriedItemExpiresAt: new Date(Date.now() + 60000) }).where(eq(farms.id, f.farmId));
    await expect(Effect.runPromise(Effect.flip(depositCarriedItemInGranary(db, { ...input, expectedFarmVersion: result.farm.version })))).resolves.toMatchObject({ rule: { type: "granary_storage_full" } });
  });
  it.each([6, 7, 8])("uses the same capacity for market purchases at level %i", async level => {
    const f = await fixture(level, 14);
    await db.insert(farmInventory).values({ farmId: f.farmId, itemKey: "barley", quantity: 5 });
    await db.transaction(async tx => {
      const storage = await loadMarketItemStorage(tx, f.farmId, "barley", new Date());
      expect(storage.totalCapacity).toBe(level < 7 ? 20 : 25);
      expect(storage.availableCapacity).toBe(level < 7 ? 1 : 6);
      await addToMarketItemStorage(tx, storage, storage.availableCapacity, new Date());
      const full = await loadMarketItemStorage(tx, f.farmId, "barley", new Date());
      expect(full.availableCapacity).toBe(0);
      expect(full.granaries[0]!.storedBarley).toBe(granaryCapacityForLevel(level));
    });
  });
});
