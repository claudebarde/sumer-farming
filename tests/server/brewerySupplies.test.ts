import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { Effect } from "effect";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createDatabase } from "../../src/server/db/client";
import { farmBuildings, farmImprovements, farmInventory, farms, players } from "../../src/server/db/schema";
import { dropCarriedItem, depositCarriedItem, withdrawInventoryItem } from "../../src/server/services/farmItemActions";
import { supplyBrewery } from "../../src/server/services/brewerySupplies";
import { readFarmSnapshot } from "../../src/server/services/farmSnapshot";
import { loadMarketItemStorage } from "../../src/server/services/marketItemStorage";
import { validateBrewerySupply } from "../../src/game-core/farm/brewerySupplies";
import type { BrewerySupplyAction } from "../../src/game-core/farm/brewerySupplies";
import { BEER_RECIPE } from "../../src/game-data/brewing";
import { getBrewingState, validateBrewing } from "../../src/game-core/farm/brewing";

const client = new Client({ connectionString: process.env.TEST_DATABASE_URL ?? "postgres://sumer:sumer_dev@localhost:5432/sumer_farming" });
const db = createDatabase(client);
const ids = new Set<string>();
beforeAll(() => client.connect());
afterEach(async () => {
  if (ids.size) await db.delete(players).where(inArray(players.id, [...ids]));
  ids.clear();
});
afterAll(() => client.end());

const fixture = async (complete = true) => {
  const playerId = randomUUID();
  ids.add(playerId);
  await db.insert(players).values({ id: playerId, displayName: "Brewery supplies test" });
  const [farm] = await db.insert(farms).values({ playerId }).returning();
  const [building] = await db.insert(farmBuildings).values({
    farmId: farm!.id, type: "brewery", column: 5, row: 3,
    startedAt: new Date(Date.now() - 180000),
    completesAt: new Date(Date.now() + (complete ? -1000 : 180000))
  }).returning();
  const command = (action: BrewerySupplyAction, version = 1, target = action === "deliver" || action === "stock_jars" || action === "start_brewing" || action === "collect_beer" ? { column: 5, row: 3 } : { column: 0, row: 10 }) => ({
    type: "brewery_supply" as const, action, playerId, expectedFarmVersion: version, target
  });
  return { farm: farm!, building: building!, command };
};

describe("persistent brewery supplies", () => {
  it("rejects over-capacity barley in direct database writes", async () => {
    const { farm, building } = await fixture();
    await expect(db.update(farmBuildings).set({ brewingBarley: 3 }).where(eq(farmBuildings.id, building.id)))
      .rejects.toMatchObject({ cause: { code: "23514", constraint: "farm_buildings_brewing_barley_capacity" } });
    await expect(db.insert(farmBuildings).values({
      farmId: farm.id, type: "brewery", column: 0, row: 4,
      brewingBarley: 3, startedAt: new Date(0), completesAt: new Date(1000)
    })).rejects.toMatchObject({ cause: { code: "23514", constraint: "farm_buildings_brewing_barley_capacity" } });
    expect((await db.select().from(farmBuildings).where(eq(farmBuildings.id, building.id)))[0]?.brewingBarley).toBe(0);
  });
  it.each([1, 2])("rejects a two-barley delivery with %i already stored without losing the carried barley", async stored => {
    const { farm, building, command } = await fixture();
    await db.update(farmBuildings).set({ brewingBarley: stored }).where(eq(farmBuildings.id, building.id));
    await db.update(farms).set({ carriedItemKey: "barley", carriedItemQuantity: 2 }).where(eq(farms.id, farm.id));
    await expect(Effect.runPromise(Effect.flip(supplyBrewery(db, command("deliver")))))
      .resolves.toMatchObject({ type: "brewery_full" });
    expect((await db.select().from(farmBuildings).where(eq(farmBuildings.id, building.id)))[0]?.brewingBarley).toBe(stored);
    expect((await db.select().from(farms).where(eq(farms.id, farm.id)))[0])
      .toMatchObject({ carriedItemKey: "barley", carriedItemQuantity: 2, version: 1 });
  });

  it("accepts a single barley into the last free slot and rejects further deliveries", async () => {
    const { farm, building, command } = await fixture();
    await db.update(farmBuildings).set({ brewingBarley: 1 }).where(eq(farmBuildings.id, building.id));
    await db.update(farms).set({ carriedItemKey: "barley", carriedItemQuantity: 1 }).where(eq(farms.id, farm.id));
    const result = await Effect.runPromise(supplyBrewery(db, command("deliver")));
    expect(result.buildings[0]?.brewingBarley).toBe(2);
    expect(result.farm.carriedItem).toBeNull();
    await db.update(farms).set({ carriedItemKey: "barley", carriedItemQuantity: 1 }).where(eq(farms.id, farm.id));
    await expect(Effect.runPromise(Effect.flip(supplyBrewery(db, command("deliver", 2)))))
      .resolves.toMatchObject({ type: "brewery_full" });
  });
  it("gives estate beer without a brewery and shares the daily cooldown", async () => {
    const { farm } = await fixture();
    await db.delete(farmBuildings).where(eq(farmBuildings.farmId, farm.id));
    await db.insert(farmInventory).values({ farmId: farm.id, itemKey: "beer", quantity: 2 });
    const input = { type: "give_farmer_beer" as const, playerId: farm.playerId, expectedFarmVersion: 1 };
    const result = await Effect.runPromise(supplyBrewery(db, input));
    expect(result.inventory.find(item => item.itemKey === "beer")?.quantity).toBe(1);
    expect(result.farm.household.happiness).toBe(85);
    await expect(Effect.runPromise(Effect.flip(supplyBrewery(db, { ...input, expectedFarmVersion: 2 }))))
      .resolves.toMatchObject({ type: "beer_cooldown" });
  });

  it("estate gifts never take beer from a ready brewery batch", async () => {
    const { farm, building } = await fixture();
    await db.update(farmBuildings).set({ beerReadyAt: new Date(Date.now() - 500) }).where(eq(farmBuildings.id, building.id));
    const input = { type: "give_farmer_beer" as const, playerId: farm.playerId, expectedFarmVersion: 1 };
    await expect(Effect.runPromise(Effect.flip(supplyBrewery(db, input))))
      .resolves.toMatchObject({ type: "no_beer" });
    await db.insert(farmInventory).values({ farmId: farm.id, itemKey: "beer", quantity: 1 });
    const result = await Effect.runPromise(supplyBrewery(db, input));
    expect(result.buildings[0]?.beerServed).toBe(0);
    expect(result.buildings[0]?.beerReadyAt).not.toBeNull();
    expect(result.inventory.find(item => item.itemKey === "beer")?.quantity).toBe(0);
  });
  it("serves ready brewery beer first and collects only the remaining jar", async () => {
    const { farm, building, command } = await fixture();
    const target = { column: 5, row: 3 };
    await db.update(farmBuildings).set({ beerReadyAt: new Date(Date.now() - 500) }).where(eq(farmBuildings.id, building.id));
    await db.insert(farmInventory).values({ farmId: farm.id, itemKey: "beer", quantity: 3 });
    const served = await Effect.runPromise(supplyBrewery(db, command("give_beer", 1, target)));
    expect(served.buildings[0]?.beerServed).toBe(1);
    expect(served.buildings[0]?.beerReadyAt).not.toBeNull();
    expect(served.inventory.find(item => item.itemKey === "beer")?.quantity).toBe(3);
    expect(served.farm.household.happiness).toBe(85);
    await expect(Effect.runPromise(Effect.flip(supplyBrewery(db, command("give_beer", 2, target)))))
      .resolves.toMatchObject({ type: "beer_cooldown" });
    const collected = await Effect.runPromise(supplyBrewery(db, command("collect_beer", 2, target)));
    expect(collected.inventory.find(item => item.itemKey === "beer")?.quantity).toBe(4);
    expect(collected.buildings[0]).toMatchObject({ beerServed: 0, beerReadyAt: null });
  });

  it("serves directly without estate beer and frees the brewery after the final serving", async () => {
    const { farm, building, command } = await fixture();
    const target = { column: 5, row: 3 };
    await db.update(farmBuildings).set({ beerReadyAt: new Date(Date.now() + 60000) }).where(eq(farmBuildings.id, building.id));
    await expect(Effect.runPromise(Effect.flip(supplyBrewery(db, command("give_beer", 1, target)))))
      .resolves.toMatchObject({ type: "no_beer" });
    await db.update(farmBuildings).set({ beerReadyAt: new Date(Date.now() - 500) }).where(eq(farmBuildings.id, building.id));
    await Effect.runPromise(supplyBrewery(db, command("give_beer", 1, target)));
    await db.update(farms).set({ lastBeerAt: new Date(Date.now() - 86400001) }).where(eq(farms.id, farm.id));
    const served = await Effect.runPromise(supplyBrewery(db, command("give_beer", 2, target)));
    expect(served.buildings[0]).toMatchObject({ beerServed: 0, beerReadyAt: null });
    expect(served.inventory.find(item => item.itemKey === "beer")).toBeUndefined();
    await expect(Effect.runPromise(Effect.flip(supplyBrewery(db, command("collect_beer", 3, target)))))
      .resolves.toMatchObject({ type: "no_batch" });
  });
  it("gives one stored beer, preserves hunger and carried items, and enforces the persistent cooldown", async () => {
    const { farm, command } = await fixture();
    const target = { column: 5, row: 3 };
    await db.insert(farmInventory).values({ farmId: farm.id, itemKey: "beer", quantity: 3 });
    await db.update(farms).set({ happiness: 50, hungrySince: new Date(Date.now() - 1000),
      carriedItemKey: "reed", carriedItemQuantity: 1 }).where(eq(farms.id, farm.id));
    const result = await Effect.runPromise(supplyBrewery(db, command("give_beer", 1, target)));
    expect(result.farm.household.happiness).toBe(65);
    expect(result.farm.household.hungrySince).not.toBeNull();
    expect(result.farm.household.lastBeerAt).not.toBeNull();
    expect(result.farm.carriedItem).toMatchObject({ itemKey: "reed", quantity: 1 });
    expect(result.inventory.find(item => item.itemKey === "beer")?.quantity).toBe(2);
    await expect(Effect.runPromise(Effect.flip(supplyBrewery(db, command("give_beer", 2, target)))))
      .resolves.toMatchObject({ type: "beer_cooldown" });
    const reloaded = await db.transaction(async tx => {
      const [record] = await tx.select().from(farms).where(eq(farms.id, farm.id));
      return readFarmSnapshot(tx, record!, false);
    });
    expect(reloaded.farm.household.happiness).toBe(65);
    expect(reloaded.farm.household.lastBeerAt).toBe(result.farm.household.lastBeerAt);
    await db.update(farms).set({ happiness: 95, lastBeerAt: new Date(Date.now() - 86400001) }).where(eq(farms.id, farm.id));
    const next = await Effect.runPromise(supplyBrewery(db, command("give_beer", 2, target)));
    expect(next.farm.household.happiness).toBe(100);
    expect(next.inventory.find(item => item.itemKey === "beer")?.quantity).toBe(1);
  });

  it("does not grant free beer happiness or consume beer at maximum happiness", async () => {
    const { farm, command } = await fixture();
    const target = { column: 5, row: 3 };
    await expect(Effect.runPromise(Effect.flip(supplyBrewery(db, command("give_beer", 1, target)))))
      .resolves.toMatchObject({ type: "no_beer" });
    await db.insert(farmInventory).values({ farmId: farm.id, itemKey: "beer", quantity: 1 });
    await db.update(farms).set({ happiness: 100 }).where(eq(farms.id, farm.id));
    await expect(Effect.runPromise(Effect.flip(supplyBrewery(db, command("give_beer", 1, target)))))
      .resolves.toMatchObject({ type: "happiness_full" });
    expect((await db.select().from(farmInventory).where(eq(farmInventory.farmId, farm.id)))[0]?.quantity).toBe(1);
  });
  it("brews for one hour, survives reloads and collects exactly once into estate inventory", async () => {
    const { farm, building, command } = await fixture();
    await db.update(farmBuildings).set({ brewingBarley: 2, brewingWater: 2, emptyBeerJars: 10 })
      .where(eq(farmBuildings.id, building.id));
    await db.update(farms).set({ carriedItemKey: "reed", carriedItemQuantity: 1 }).where(eq(farms.id, farm.id));
    const before = Date.now();
    const started = await Effect.runPromise(supplyBrewery(db, command("start_brewing")));
    expect(started.buildings[0]).toMatchObject({ brewingBarley: 0, brewingWater: 0, emptyBeerJars: 8 });
    const readyAt = Date.parse(started.buildings[0]!.beerReadyAt!);
    expect(readyAt).toBeGreaterThanOrEqual(before + BEER_RECIPE.durationMs);
    expect(readyAt).toBeLessThanOrEqual(Date.now() + BEER_RECIPE.durationMs);
    expect(started.farm.carriedItem).toMatchObject({ itemKey: "reed", quantity: 1 });
    const reloaded = await db.transaction(async tx => {
      const [record] = await tx.select().from(farms).where(eq(farms.id, farm.id));
      return readFarmSnapshot(tx, record!, false);
    });
    expect(reloaded.buildings).toEqual(started.buildings);
    await expect(Effect.runPromise(Effect.flip(supplyBrewery(db, command("start_brewing")))))
      .resolves.toMatchObject({ type: "farm_version_conflict" });
    await expect(Effect.runPromise(Effect.flip(supplyBrewery(db, command("start_brewing", 2)))))
      .resolves.toMatchObject({ type: "batch_active" });
    await expect(Effect.runPromise(Effect.flip(supplyBrewery(db, command("collect_beer", 2)))))
      .resolves.toMatchObject({ type: "beer_not_ready" });
    await db.update(farmBuildings).set({ beerReadyAt: new Date(Date.now() - 500) }).where(eq(farmBuildings.id, building.id));
    await db.insert(farmInventory).values({ farmId: farm.id, itemKey: "beer", quantity: 3 });
    const collected = await Effect.runPromise(supplyBrewery(db, command("collect_beer", 2)));
    expect(collected.inventory.find(item => item.itemKey === "beer")?.quantity).toBe(5);
    expect(collected.buildings[0]).toMatchObject({ beerReadyAt: null, emptyBeerJars: 8, brewingBarley: 0, storedBarley: 0 });
    expect(collected.farm.carriedItem).toEqual(started.farm.carriedItem);
    await expect(Effect.runPromise(Effect.flip(withdrawInventoryItem(db, {
      playerId: farm.playerId, itemKey: "beer", expectedFarmVersion: 3
    })))).resolves.toMatchObject({ rule: { type: "incompatible_carried_item" } });
    await expect(Effect.runPromise(Effect.flip(supplyBrewery(db, command("collect_beer", 2)))))
      .resolves.toMatchObject({ type: "farm_version_conflict" });
    await expect(Effect.runPromise(Effect.flip(supplyBrewery(db, command("collect_beer", 3)))))
      .resolves.toMatchObject({ type: "no_batch" });
  });

  it.each(["brewingBarley", "brewingWater", "emptyBeerJars"] as const)("rejects insufficient %s without spending supplies", async field => {
    const { farm, building, command } = await fixture();
    const supplies = { brewingBarley: 2, brewingWater: 2, emptyBeerJars: 2, [field]: 1 };
    await db.update(farmBuildings).set(supplies).where(eq(farmBuildings.id, building.id));
    await expect(Effect.runPromise(Effect.flip(supplyBrewery(db, command("start_brewing")))))
      .resolves.toMatchObject({ type: "missing_ingredients" });
    expect((await db.select().from(farmBuildings).where(eq(farmBuildings.id, building.id)))[0])
      .toMatchObject({ ...supplies, beerReadyAt: null });
    expect((await db.select().from(farms).where(eq(farms.id, farm.id)))[0]?.version).toBe(1);
  });

  it("serializes concurrent collections so the batch is credited only once", async () => {
    const { farm, building, command } = await fixture();
    await db.update(farmBuildings).set({ beerReadyAt: new Date(Date.now() - 500) }).where(eq(farmBuildings.id, building.id));
    const otherClient = new Client({ connectionString: process.env.TEST_DATABASE_URL ?? "postgres://sumer:sumer_dev@localhost:5432/sumer_farming" });
    await otherClient.connect();
    try {
      const results = await Promise.all([
        Effect.runPromise(Effect.either(supplyBrewery(db, command("collect_beer")))),
        Effect.runPromise(Effect.either(supplyBrewery(createDatabase(otherClient), command("collect_beer"))))
      ]);
      expect(results.filter(result => result._tag === "Right")).toHaveLength(1);
      expect(results.filter(result => result._tag === "Left")).toMatchObject([
        { left: { type: "farm_version_conflict" } }
      ]);
      expect((await db.select().from(farmInventory).where(eq(farmInventory.farmId, farm.id)))[0])
        .toMatchObject({ itemKey: "beer", quantity: 2 });
    } finally {
      await otherClient.end();
    }
  });

  it("rejects brewing at unfinished and other players' breweries", async () => {
    const { farm, command } = await fixture(false);
    await fixture();
    await expect(Effect.runPromise(Effect.flip(supplyBrewery(db, command("start_brewing")))))
      .resolves.toMatchObject({ type: "brewery_unavailable" });
    await db.delete(farmBuildings).where(eq(farmBuildings.farmId, farm.id));
    await expect(Effect.runPromise(Effect.flip(supplyBrewery(db, command("collect_beer")))))
      .resolves.toMatchObject({ type: "brewery_unavailable" });
  });

  it("stocks at most ten empty jars, leaves extras in inventory and prevents duplicate transfers", async () => {
    const { farm, command } = await fixture();
    await db.insert(farmInventory).values({ farmId: farm.id, itemKey: "emptyBeerJar", quantity: 12 });
    const result = await Effect.runPromise(supplyBrewery(db, command("stock_jars")));
    expect(result.buildings[0]?.emptyBeerJars).toBe(10);
    expect(result.inventory.find(item => item.itemKey === "emptyBeerJar")?.quantity).toBe(2);
    await expect(Effect.runPromise(Effect.flip(supplyBrewery(db, command("stock_jars"))))).resolves.toMatchObject({ type: "farm_version_conflict" });
    await expect(Effect.runPromise(Effect.flip(supplyBrewery(db, command("stock_jars", 2))))).resolves.toMatchObject({ type: "brewery_full" });
    expect((await db.select().from(farmBuildings).where(eq(farmBuildings.farmId, farm.id)))[0]?.emptyBeerJars).toBe(10);
    expect((await db.select().from(farmInventory).where(eq(farmInventory.farmId, farm.id)))[0]?.quantity).toBe(2);
  });

  it("requires purchased jars, a completed brewery and empty hands", async () => {
    const { farm, building, command } = await fixture(false);
    await expect(Effect.runPromise(Effect.flip(supplyBrewery(db, command("stock_jars"))))).resolves.toMatchObject({ type: "brewery_unavailable" });
    await db.update(farmBuildings).set({ completesAt: new Date(Date.now() - 1000) }).where(eq(farmBuildings.id, building.id));
    await expect(Effect.runPromise(Effect.flip(supplyBrewery(db, command("stock_jars"))))).resolves.toMatchObject({ type: "no_empty_jars" });
    await db.insert(farmInventory).values({ farmId: farm.id, itemKey: "emptyBeerJar", quantity: 3 });
    await db.update(farms).set({ carriedItemKey: "water", carriedItemQuantity: 1 }).where(eq(farms.id, farm.id));
    await expect(Effect.runPromise(Effect.flip(supplyBrewery(db, command("stock_jars"))))).resolves.toMatchObject({ type: "jar_transfer_hands_full" });
    expect((await db.select().from(farms).where(eq(farms.id, farm.id)))[0]?.carriedItemKey).toBe("water");
    await db.update(farms).set({ carriedItemKey: null, carriedItemQuantity: 0 }).where(eq(farms.id, farm.id));
    const result = await Effect.runPromise(supplyBrewery(db, command("stock_jars")));
    expect(result.buildings[0]?.emptyBeerJars).toBe(3);
    expect(result.inventory.find(item => item.itemKey === "emptyBeerJar")?.quantity).toBe(0);
  });

  it("pours onto a canal without changing it and prevents storing or dropping water as a normal item", async () => {
    const { farm, command } = await fixture();
    await Effect.runPromise(supplyBrewery(db, command("collect_water")));
    const input = { playerId: farm.playerId, expectedFarmVersion: 2, target: { column: 0, row: 7 } };
    await expect(Effect.runPromise(Effect.flip(dropCarriedItem(db, input)))).resolves.toMatchObject({ rule: { type: "incompatible_carried_item" } });
    await expect(Effect.runPromise(Effect.flip(depositCarriedItem(db, input)))).resolves.toMatchObject({ rule: { type: "incompatible_carried_item" } });
    const [canal] = await db.insert(farmImprovements).values({ farmId: farm.id, type: "irrigation", column: 0, row: 7,
      startedAt: new Date(Date.now() - 10000), completesAt: new Date(Date.now() - 5000) }).returning();
    const result = await Effect.runPromise(supplyBrewery(db, command("pour_water", 2, input.target)));
    expect(result.farm.carriedItem).toBeNull();
    expect(result.improvements).toHaveLength(1);
    expect(result.improvements[0]?.id).toBe(canal!.id);
  });

  it("fills a brewery with two separate water trips, persists supplies and rejects a duplicate command", async () => {
    const { farm, command } = await fixture();
    const first = await Effect.runPromise(supplyBrewery(db, command("collect_water")));
    expect(first.farm.carriedItem).toEqual({ itemKey: "water", quantity: 1, expiresAt: null });
    await expect(Effect.runPromise(Effect.flip(supplyBrewery(db, command("collect_water"))))).resolves.toMatchObject({ type: "farm_version_conflict" });
    const loaded = await db.transaction(async tx => {
      const [record] = await tx.select().from(farms).where(eq(farms.id, farm.id));
      return readFarmSnapshot(tx, record!, false);
    });
    expect(loaded.farm.carriedItem).toEqual(first.farm.carriedItem);
    await Effect.runPromise(supplyBrewery(db, command("deliver", 2)));
    await Effect.runPromise(supplyBrewery(db, command("collect_water", 3)));
    const second = await Effect.runPromise(supplyBrewery(db, command("deliver", 4)));
    expect(second.buildings[0]?.brewingWater).toBe(2);
    expect(second.farm.carriedItem).toBeNull();
    await Effect.runPromise(supplyBrewery(db, command("collect_water", 5)));
    await expect(Effect.runPromise(Effect.flip(supplyBrewery(db, command("deliver", 6))))).resolves.toMatchObject({ type: "brewery_full" });
    const [record] = await db.select().from(farms).where(eq(farms.id, farm.id));
    expect(record).toMatchObject({ carriedItemKey: "water", carriedItemQuantity: 1, version: 6 });
    const poured = await Effect.runPromise(supplyBrewery(db, command("pour_water", 6, { column: 0, row: 2 })));
    expect(poured.farm.carriedItem).toBeNull();
    expect(poured.groundItems).toHaveLength(0);
    expect(poured.improvements).toHaveLength(0);
    expect(poured.buildings[0]?.brewingWater).toBe(2);
  });

  it("requires a completed brewery and empty hands, and only collects at the river", async () => {
    const { farm, building, command } = await fixture(false);
    await expect(Effect.runPromise(Effect.flip(supplyBrewery(db, command("collect_water"))))).resolves.toMatchObject({ type: "brewery_unavailable" });
    await db.update(farmBuildings).set({ completesAt: new Date(Date.now() - 1000) }).where(eq(farmBuildings.id, building.id));
    await expect(Effect.runPromise(Effect.flip(supplyBrewery(db, command("collect_water", 1, { column: 0, row: 9 }))))).resolves.toMatchObject({ type: "not_at_river" });
    await db.update(farms).set({ carriedItemKey: "reed", carriedItemQuantity: 1 }).where(eq(farms.id, farm.id));
    await expect(Effect.runPromise(Effect.flip(supplyBrewery(db, command("collect_water"))))).resolves.toMatchObject({ type: "hands_not_empty" });
  });

  it("transfers carried barley to brewery-only stock, not market or household storage", async () => {
    const { farm, command } = await fixture();
    await db.update(farms).set({ carriedItemKey: "barley", carriedItemQuantity: 2 }).where(eq(farms.id, farm.id));
    const result = await Effect.runPromise(supplyBrewery(db, command("deliver")));
    expect(result.farm.carriedItem).toBeNull();
    expect(result.buildings[0]).toMatchObject({ brewingBarley: 2, storedBarley: 0, brewingWater: 0 });
    const storage = await db.transaction(tx => loadMarketItemStorage(tx, farm.id, "barley", new Date()));
    expect(storage.storedQuantity).toBe(0);
  });

  it("rejects deliveries to an unfinished, foreign or missing brewery without losing carried items", async () => {
    const { farm, command } = await fixture(false);
    await db.update(farms).set({ carriedItemKey: "water", carriedItemQuantity: 1 }).where(eq(farms.id, farm.id));
    await expect(Effect.runPromise(Effect.flip(supplyBrewery(db, command("deliver"))))).resolves.toMatchObject({ type: "brewery_unavailable" });
    const other = await fixture();
    await db.delete(farmBuildings).where(eq(farmBuildings.farmId, farm.id));
    await expect(Effect.runPromise(Effect.flip(supplyBrewery(db, command("deliver"))))).resolves.toMatchObject({ type: "brewery_unavailable" });
    const [record] = await db.select().from(farms).where(eq(farms.id, farm.id));
    expect(record?.carriedItemKey).toBe("water");
    expect((await db.select().from(farmBuildings).where(eq(farmBuildings.id, other.building.id)))[0]?.brewingWater).toBe(0);
  });
});

describe("pouring water rules", () => {
  const context = { action: "pour_water" as const, now: Date.now(), carriedItem: { itemKey: "water", quantity: 1 }, buildings: [], crops: [], groundItems: [], objects: [] };
  it.each([{ column: 0, row: 2 }, { column: -1, row: 2 }, { column: 0, row: 10 }])("allows empty ground and river at %o", target => {
    expect(validateBrewerySupply({ ...context, target })).toBeNull();
  });
  it.each(["crops", "groundItems", "objects"] as const)("rejects an occupied %s tile", field => {
    const target = { column: 0, row: 2 };
    expect(validateBrewerySupply({ ...context, target, [field]: [target] })).toBe("invalid_pour_target");
  });
  it("rejects the farm building and out-of-world targets", () => {
    expect(validateBrewerySupply({ ...context, target: { column: 3, row: 0 } })).toBe("invalid_pour_target");
    expect(validateBrewerySupply({ ...context, target: { column: 20, row: 10 } })).toBe("outside_world");
  });
});

describe("brewing deadlines", () => {
  it("becomes ready at the exact deadline, including after a long absence", () => {
    const readyAt = "2026-09-24T12:00:00.000Z";
    const now = Date.parse(readyAt);
    expect(getBrewingState(null, now)).toEqual({ type: "idle" });
    expect(getBrewingState(readyAt, now - 1)).toEqual({ type: "brewing", readyAt: now });
    expect(getBrewingState(readyAt, now)).toEqual({ type: "ready" });
    expect(getBrewingState(readyAt, now + 86400000)).toEqual({ type: "ready" });
    const building = { beerReadyAt: readyAt, brewingBarley: 2, brewingWater: 2, emptyBeerJars: 2 };
    expect(validateBrewing("start_brewing", building, now)).toBe("batch_active");
    expect(validateBrewing("collect_beer", building, now)).toBeNull();
  });
});
