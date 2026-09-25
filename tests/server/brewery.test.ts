import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { Effect } from "effect";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createDatabase } from "../../src/server/db/client";
import { farmBuildings, farmGroundItems, farmInventory, farms, players, shekelTransactions } from "../../src/server/db/schema";
import { buildFarmBuilding } from "../../src/server/services/buildFarmBuilding";
import { buyFromNpcMarket, sellToNpcMarket } from "../../src/server/services/tradeMarketItem";
import { createMarketSellOrder } from "../../src/server/services/marketSellOrders";
import { validateBuildingPlacement } from "../../src/game-core/farm/buildings";
import { calculateFarmStorageCapacity } from "../../src/game-data/storage";

const client = new Client({ connectionString: process.env.TEST_DATABASE_URL ?? "postgres://sumer:sumer_dev@localhost:5432/sumer_farming" });
const db = createDatabase(client);
const ids = new Set<string>();
beforeAll(() => client.connect());
afterEach(async () => {
  if (ids.size) await db.delete(players).where(inArray(players.id, [...ids]));
  ids.clear();
});
afterAll(() => client.end());

const fixture = async (vessels = 2) => {
  const playerId = randomUUID();
  ids.add(playerId);
  await db.insert(players).values({ id: playerId, displayName: "Brewery test", shekelBalance: 20 });
  const [farm] = await db.insert(farms).values({ playerId }).returning();
  await db.insert(farmGroundItems).values([
    { farmId: farm!.id, itemKey: "reed", quantity: 4, column: 0, row: 0 },
    { farmId: farm!.id, itemKey: "clay", quantity: 6, column: 1, row: 0 }
  ]);
  await db.insert(farmInventory).values([
    { farmId: farm!.id, itemKey: "barley", quantity: 5 },
    { farmId: farm!.id, itemKey: "brewingVessels", quantity: vessels }
  ]);
  return { playerId, farmId: farm!.id, building: "brewery" as const, target: { column: 5, row: 4 }, expectedFarmVersion: 1 };
};

describe("brewery construction and equipment", () => {
  it("rejects a trapping layout on the server without spending materials or changing the farm version", async () => {
    const input = await fixture();
    await db.update(farmGroundItems).set({ row: 6 }).where(eq(farmGroundItems.farmId, input.farmId));
    await db.insert(farmBuildings).values({
      farmId: input.farmId, type: "granary", column: 0, row: 0,
      startedAt: new Date(), completesAt: new Date(Date.now() + 120000)
    });
    const before = await db.select().from(farmGroundItems).where(eq(farmGroundItems.farmId, input.farmId));
    const inventory = await db.select().from(farmInventory).where(eq(farmInventory.farmId, input.farmId));
    await expect(Effect.runPromise(Effect.flip(buildFarmBuilding(db, {
      ...input, target: { column: 1, row: 2 }
    })))).resolves.toMatchObject({ rule: { type: "access_blocked" } });
    expect(await db.select().from(farmGroundItems).where(eq(farmGroundItems.farmId, input.farmId))).toEqual(before);
    expect(await db.select().from(farmInventory).where(eq(farmInventory.farmId, input.farmId))).toEqual(inventory);
    expect(await db.select().from(farmBuildings).where(eq(farmBuildings.farmId, input.farmId))).toHaveLength(1);
    expect((await db.select().from(farms).where(eq(farms.id, input.farmId)))[0]?.version).toBe(1);
  });

  it("buys empty beer jars for two shekels each without using barley storage or charging retries twice", async () => {
    const input = await fixture();
    const purchase = { ...input, itemKey: "emptyBeerJar" as const, quantity: 3, expectedUnitPrice: 2, idempotencyKey: randomUUID() };
    const first = await Effect.runPromise(buyFromNpcMarket(db, purchase));
    const retry = await Effect.runPromise(buyFromNpcMarket(db, purchase));
    expect(first.player.shekelBalance).toBe(14);
    expect(retry.player.shekelBalance).toBe(14);
    expect(retry.inventory).toEqual(first.inventory);
    expect(first.inventory).toEqual(expect.arrayContaining([
      { itemKey: "emptyBeerJar", quantity: 3 },
      { itemKey: "brewingVessels", quantity: 2 },
      { itemKey: "barley", quantity: 5 }
    ]));
    expect(await db.select().from(farmInventory).where(eq(farmInventory.farmId, input.farmId)))
      .toEqual(expect.arrayContaining([expect.objectContaining({ itemKey: "emptyBeerJar", quantity: 3 })]));
    expect(await db.select().from(shekelTransactions).where(eq(shekelTransactions.playerId, input.playerId)))
      .toEqual([expect.objectContaining({ itemKey: "emptyBeerJar", itemQuantity: 3, delta: -6, unitPrice: 2 })]);
  });

  it.each(["price_changed", "insufficient_shekels"] as const)("rejects empty beer jar purchases with %s", async reason => {
    const input = await fixture();
    if (reason === "insufficient_shekels") await db.update(players).set({ shekelBalance: 0 }).where(eq(players.id, input.playerId));
    await expect(Effect.runPromise(Effect.flip(buyFromNpcMarket(db, {
      ...input, itemKey: "emptyBeerJar", quantity: 1,
      expectedUnitPrice: reason === "price_changed" ? 1 : 2, idempotencyKey: randomUUID()
    })))).resolves.toMatchObject({ rule: { type: reason } });
    expect(await db.select().from(shekelTransactions).where(eq(shekelTransactions.playerId, input.playerId))).toHaveLength(0);
  });

  it("does not substitute empty beer jars for brewery equipment or allow their resale", async () => {
    const input = await fixture(0);
    await db.insert(farmInventory).values({ farmId: input.farmId, itemKey: "emptyBeerJar", quantity: 2 });
    await expect(Effect.runPromise(Effect.flip(buildFarmBuilding(db, input))))
      .resolves.toMatchObject({ rule: { type: "missing_material", itemKey: "brewingVessels" } });
    const trade = { ...input, itemKey: "emptyBeerJar" as const, quantity: 1, expectedUnitPrice: 1, unitPrice: 1, idempotencyKey: randomUUID() };
    await expect(Effect.runPromise(Effect.flip(sellToNpcMarket(db, trade)))).resolves.toMatchObject({ rule: { type: "trade_unavailable" } });
    await expect(Effect.runPromise(Effect.flip(createMarketSellOrder(db, trade)))).resolves.toBeDefined();
  });

  it("preserves the granary cost, timer and storage bonus", async () => {
    const input = await fixture(0);
    const snapshot = await Effect.runPromise(buildFarmBuilding(db, { ...input, building: "granary" }));
    const building = snapshot.buildings[0]!;
    expect(Date.parse(building.completesAt) - Date.parse(building.startedAt)).toBe(120000);
    expect(snapshot.groundItems.map(item => item.quantity).sort()).toEqual([2, 3]);
    expect(calculateFarmStorageCapacity(snapshot.buildings, Date.parse(building.completesAt))).toBe(20);
  });

  it.each(["price_changed", "insufficient_shekels"] as const)("rejects equipment purchases with %s", async reason => {
    const input = await fixture(0);
    if (reason === "insufficient_shekels") await db.update(players).set({ shekelBalance: 5 }).where(eq(players.id, input.playerId));
    const result = await Effect.runPromise(Effect.flip(buyFromNpcMarket(db, {
      ...input, itemKey: "brewingVessels", quantity: 1,
      expectedUnitPrice: reason === "price_changed" ? 1 : 6, idempotencyKey: randomUUID()
    })));
    expect(result).toMatchObject({ rule: { type: reason } });
    expect(await db.select().from(shekelTransactions).where(eq(shekelTransactions.playerId, input.playerId))).toHaveLength(0);
  });

  it("buys equipment with full barley storage and charges a retry only once", async () => {
    const input = await fixture(0);
    const purchase = { ...input, itemKey: "brewingVessels" as const, quantity: 1, expectedUnitPrice: 6, idempotencyKey: randomUUID() };
    const first = await Effect.runPromise(buyFromNpcMarket(db, purchase));
    const retry = await Effect.runPromise(buyFromNpcMarket(db, purchase));
    expect(first.player.shekelBalance).toBe(14);
    expect(retry.inventory).toEqual(first.inventory);
    expect(first.inventory).toEqual(expect.arrayContaining([{ itemKey: "brewingVessels", quantity: 1 }, { itemKey: "barley", quantity: 5 }]));
    expect(await db.select().from(shekelTransactions).where(eq(shekelTransactions.playerId, input.playerId))).toHaveLength(1);
  });

  it("consumes 4 reed, 6 clay and two brewing jars and persists a 3-minute building", async () => {
    const input = await fixture();
    const snapshot = await Effect.runPromise(buildFarmBuilding(db, input));
    expect(snapshot.groundItems).toHaveLength(0);
    expect(snapshot.inventory.find(item => item.itemKey === "brewingVessels")?.quantity).toBe(0);
    expect(snapshot.buildings).toHaveLength(1);
    const building = snapshot.buildings[0]!;
    expect(building.type).toBe("brewery");
    expect(Date.parse(building.completesAt) - Date.parse(building.startedAt)).toBe(180000);
    expect(calculateFarmStorageCapacity(snapshot.buildings, Date.parse(building.completesAt))).toBe(5);
    await expect(Effect.runPromise(Effect.flip(buildFarmBuilding(db, input)))).resolves.toMatchObject({ rule: { type: "version_conflict" } });
    expect(await db.select().from(farmBuildings).where(eq(farmBuildings.farmId, input.farmId))).toHaveLength(1);
  });

  it.each([
    ["outside_arable_plot", { column: 7, row: 7 }],
    ["footprint_occupied", { column: 3, row: 0 }],
    ["footprint_occupied", { column: 0, row: 0 }]
  ] as const)("rejects %s without consuming materials", async (reason, target) => {
    const input = await fixture();
    await expect(Effect.runPromise(Effect.flip(buildFarmBuilding(db, { ...input, target })))).resolves.toMatchObject({ rule: { type: reason } });
    expect(await db.select().from(farmGroundItems).where(eq(farmGroundItems.farmId, input.farmId))).toHaveLength(2);
    expect(await db.select().from(farmBuildings).where(eq(farmBuildings.farmId, input.farmId))).toHaveLength(0);
  });

  it.each([0, 1])("rejects construction with only %i brewing jars", async quantity => {
    const input = await fixture(quantity);
    await expect(Effect.runPromise(Effect.flip(buildFarmBuilding(db, input)))).resolves.toMatchObject({ rule: { type: "missing_material", itemKey: "brewingVessels", required: 2, available: quantity } });
  });

  it("keeps equipment unavailable for NPC sales and player listings", async () => {
    const input = await fixture();
    const trade = { ...input, itemKey: "brewingVessels" as const, quantity: 1, expectedUnitPrice: 1, unitPrice: 6, idempotencyKey: randomUUID() };
    await expect(Effect.runPromise(Effect.flip(sellToNpcMarket(db, trade)))).resolves.toMatchObject({ rule: { type: "trade_unavailable" } });
    await expect(Effect.runPromise(Effect.flip(createMarketSellOrder(db, trade)))).resolves.toBeDefined();
    expect(await db.select().from(shekelTransactions).where(eq(shekelTransactions.playerId, input.playerId))).toHaveLength(0);
  });

  it("uses the same farmer-overlap and empty-hands placement rules", () => {
    const context = { building: "brewery" as const, target: { column: 5, row: 4 }, occupiedCoordinates: new Set(["6:5"]), carriedItem: null, availableMaterials: { reed: 4, clay: 6, brewingVessels: 2 } };
    expect(validateBuildingPlacement(context)).toEqual({ type: "footprint_occupied" });
    expect(validateBuildingPlacement({ ...context, occupiedCoordinates: new Set(), carriedItem: "barley" })).toEqual({ type: "hands_not_empty" });
  });
});
