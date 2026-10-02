import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { Effect } from "effect";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createDatabase } from "../../src/server/db/client";
import { farmBuildings, farmInventory, farms, players, shekelTransactions } from "../../src/server/db/schema";
import { buyFromNpcMarket, sellToNpcMarket } from "../../src/server/services/tradeMarketItem";
import { createMarketSellOrder } from "../../src/server/services/marketSellOrders";
import { startMilling } from "../../src/server/services/milling";
import { productionAction } from "../../src/server/services/production";
import { readFarmSnapshot } from "../../src/server/services/farmSnapshot";
import { farmerProductionJob } from "../../src/game-core/farm/farmerProduction";
import { millSprite } from "../../src/game-core/farm/milling";
import { assertFarmerAvailable } from "../../src/server/services/farmerAvailability";
import { MarketQuotesSchema } from "../../src/schemas/market";
import { buildMarketQuotes } from "../../src/server/services/marketQuotes";
import { withdrawInventoryItem } from "../../src/server/services/farmItemActions";

const client = new Client({ connectionString: process.env.TEST_DATABASE_URL ?? "postgres://sumer:sumer_dev@localhost:5432/sumer_farming" });
const db = createDatabase(client);
const ids = new Set<string>();
beforeAll(() => client.connect());
afterEach(async () => { if (ids.size) await db.delete(players).where(inArray(players.id, [...ids])); ids.clear(); });
afterAll(() => client.end());
const fixture = async (level = 7, balance = 100) => {
  const playerId = randomUUID(); ids.add(playerId);
  await db.insert(players).values({ id: playerId, displayName: "Donkey test", shekelBalance: balance });
  const [farm] = await db.insert(farms).values({ playerId, level }).returning();
  const [mill] = await db.insert(farmBuildings).values({ farmId: farm!.id, type: "mill", column: 2, row: 2, startedAt: new Date(0), completesAt: new Date(1) }).returning();
  const read = () => db.transaction(async tx => {
    const [current] = await tx.select().from(farms).where(eq(farms.id, farm!.id)).for("update");
    return readFarmSnapshot(tx, current!, false);
  });
  const purchase = { playerId, itemKey: "donkey" as const, quantity: 1, expectedUnitPrice: 30, expectedFarmVersion: 1, idempotencyKey: randomUUID() };
  return { playerId, farm: farm!, mill: mill!, read, purchase };
};

describe("mill donkey", () => {
  it("quotes a 30-shekel NPC-only purchase and charges exactly once", async () => {
    const quotes = MarketQuotesSchema.parse(buildMarketQuotes([], "test"));
    expect(quotes.items.find(i => i.itemKey === "donkey")).toMatchObject({ npcMarket: { buyPrice: 30, canSell: false }, playerMarket: { canCreateSellOrder: false } });
    const f = await fixture();
    const bought = await Effect.runPromise(buyFromNpcMarket(db, f.purchase));
    expect(bought.player.shekelBalance).toBe(70);
    expect(bought.inventory.find(i => i.itemKey === "donkey")?.quantity).toBe(1);
    const retry = await Effect.runPromise(buyFromNpcMarket(db, f.purchase));
    expect(retry.player.shekelBalance).toBe(70);
    expect((await db.select().from(shekelTransactions).where(eq(shekelTransactions.playerId, f.playerId)))).toHaveLength(1);
    await expect(Effect.runPromise(Effect.flip(buyFromNpcMarket(db, { ...f.purchase, expectedFarmVersion: bought.farm.version, idempotencyKey: randomUUID() })))).resolves.toMatchObject({ rule: { type: "insufficient_storage" } });
    await expect(Effect.runPromise(Effect.flip(sellToNpcMarket(db, { ...f.purchase, expectedUnitPrice: 1, expectedFarmVersion: bought.farm.version, idempotencyKey: randomUUID() })))).resolves.toMatchObject({ rule: { type: "trade_unavailable" } });
    const listed = await Effect.runPromise(Effect.flip(createMarketSellOrder(db, { ...f.purchase, unitPrice: 30, expectedFarmVersion: bought.farm.version, idempotencyKey: randomUUID() })));
    expect(listed._tag).toBe("MarketSellOrderRuleError");
    await expect(Effect.runPromise(Effect.flip(withdrawInventoryItem(db, {
      playerId: f.playerId, itemKey: "donkey", expectedFarmVersion: bought.farm.version
    })))).resolves.toMatchObject({ rule: { type: "incompatible_carried_item" } });
    expect((await f.read()).inventory.find(i => i.itemKey === "donkey")?.quantity).toBe(1);
  });

  it.each(["low_level", "funds", "quantity", "price", "version"] as const)("rejects %s purchases without granting a donkey", async reason => {
    const f = await fixture(reason === "low_level" ? 6 : 7, reason === "funds" ? 29 : 100);
    const result = await Effect.runPromise(Effect.flip(buyFromNpcMarket(db, { ...f.purchase,
      quantity: reason === "quantity" ? 2 : 1, expectedUnitPrice: reason === "price" ? 1 : 30,
      expectedFarmVersion: reason === "version" ? 2 : 1 })));
    expect(result._tag).toBe("MarketTradeRuleError");
    expect((await f.read()).inventory.some(i => i.itemKey === "donkey")).toBe(false);
  });

  it.each(["flour", "brewersGroats"] as const)("processes six barley into three %s in 15 minutes while allowing baking", async recipe => {
    const f = await fixture();
    await Effect.runPromise(buyFromNpcMarket(db, f.purchase));
    await db.insert(farmInventory).values([{ farmId: f.farm.id, itemKey: "barley", quantity: 3 }, { farmId: f.farm.id, itemKey: "flour", quantity: 2 }]);
    await db.insert(farmBuildings).values({ farmId: f.farm.id, type: "granary", column: 5, row: 0, storedBarley: 3, startedAt: new Date(0), completesAt: new Date(1) });
    const [oven] = await db.insert(farmBuildings).values({ farmId: f.farm.id, type: "breadOven", column: 0, row: 0, startedAt: new Date(0), completesAt: new Date(1) }).returning();
    const input = { type: "start_milling" as const, playerId: f.playerId, target: f.mill, worker: "donkey" as const, recipe, expectedFarmVersion: (await f.read()).farm.version };
    const active = await Effect.runPromise(startMilling(db, input));
    const job = active.farm.milling!;
    expect(job).toMatchObject({ worker: "donkey", barley: 6, output: 3 });
    expect(Date.parse(job.completesAt) - Date.parse(job.startedAt)).toBe(15 * 60000);
    expect(active.inventory.find(i => i.itemKey === "barley")?.quantity).toBe(0);
    expect(active.buildings.find(b => b.type === "granary")?.storedBarley).toBe(0);
    expect(millSprite(f.mill.id, job)).toBe("millDonkey");
    expect(farmerProductionJob(active.farm)).toBeNull();
    expect(() => assertFarmerAvailable({ ...f.farm, milling: job })).not.toThrow();
    expect((await f.read()).farm.milling).toEqual(job);
    await expect(Effect.runPromise(Effect.flip(startMilling(db, { ...input, expectedFarmVersion: active.farm.version })))).resolves.toMatchObject({ _tag: "MillingRuleError" });
    const baking = await Effect.runPromise(productionAction(db, { type: "start_baking", playerId: f.playerId, buildingId: oven!.id, expectedFarmVersion: active.farm.version }));
    expect(farmerProductionJob(baking.farm)?.type).toBe("baking");
    await db.update(farms).set({ milling: { ...job, completesAt: new Date(Date.now() - 1).toISOString() } }).where(eq(farms.id, f.farm.id));
    const finished = await f.read();
    expect(finished.farm.milling).toBeNull();
    expect(finished.farm.millGoods.pending[f.mill.id]?.[recipe]).toBe(3);
    expect((await f.read()).farm.millGoods.pending[f.mill.id]?.[recipe]).toBe(3);
    expect(farmerProductionJob(finished.farm)?.type).toBe("baking");
    expect(finished.inventory.find(i => i.itemKey === recipe)?.quantity ?? 0).toBe(0);
    expect(finished.inventory.find(i => i.itemKey === "donkey")?.quantity).toBe(1);
  });

  it.each(["unowned", "low_level", "barley", "version"] as const)("rejects %s donkey milling without consuming barley", async reason => {
    const f = await fixture(reason === "low_level" ? 6 : 7);
    await db.insert(farmInventory).values({ farmId: f.farm.id, itemKey: "barley", quantity: reason === "barley" ? 5 : 6 });
    if (reason !== "unowned") await db.insert(farmInventory).values({ farmId: f.farm.id, itemKey: "donkey", quantity: 1 });
    await expect(Effect.runPromise(Effect.flip(startMilling(db, { type: "start_milling", playerId: f.playerId, recipe: "flour", worker: "donkey", target: f.mill, expectedFarmVersion: reason === "version" ? 2 : 1 })))).resolves.toMatchObject({ _tag: "MillingRuleError" });
    const snapshot = await f.read();
    expect(snapshot.farm.milling).toBeNull();
    expect(snapshot.inventory.find(i => i.itemKey === "barley")?.quantity).toBe(reason === "barley" ? 5 : 6);
  });
});
