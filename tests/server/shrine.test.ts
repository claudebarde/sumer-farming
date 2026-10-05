import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { Effect } from "effect";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createDatabase } from "../../src/server/db/client";
import { farmBuildings, farmGroundItems, farmInventory, farms, players } from "../../src/server/db/schema";
import { buildFarmBuilding } from "../../src/server/services/buildFarmBuilding";
import { productionAction } from "../../src/server/services/production";
import { readFarmSnapshot } from "../../src/server/services/farmSnapshot";
import { advanceFarmLifecycle } from "../../src/server/services/farmLifecycle";
import { emptyProductionState } from "../../src/game-data/production";
import { SHRINE_BLESSING_DURATION_MS } from "../../src/game-data/shrine";

const client = new Client({ connectionString: process.env.TEST_DATABASE_URL ?? "postgres://sumer:sumer_dev@localhost:5432/sumer_farming" });
const db = createDatabase(client);
const ids = new Set<string>();
beforeAll(() => client.connect());
afterEach(async () => { if (ids.size) await db.delete(players).where(inArray(players.id, [...ids])); ids.clear(); });
afterAll(() => client.end());
const fixture = async (level = 8, quantity = 4, complete = true) => {
  const playerId = randomUUID(); ids.add(playerId);
  await db.insert(players).values({ id: playerId, displayName: "Shrine test" });
  const [farm] = await db.insert(farms).values({ playerId, level, happiness: 80, happinessCheckedAt: new Date() }).returning();
  const [shrine] = await db.insert(farmBuildings).values({ farmId: farm!.id, type: "smallShrine", column: 7, row: 4,
    startedAt: new Date(0), completesAt: new Date(complete ? 1 : Date.now() + 60000) }).returning();
  await db.insert(farmInventory).values((["bread", "beer"] as const).map(itemKey => ({ farmId: farm!.id, itemKey, quantity })));
  const refresh = () => db.transaction(async tx => {
    const [record] = await tx.select().from(farms).where(eq(farms.id, farm!.id)).for("update");
    return readFarmSnapshot(tx, record!, false);
  });
  const offer = (item: "bread" | "beer", version = 1) => ({ type: "shrine_offering" as const, playerId, buildingId: shrine!.id, item, expectedFarmVersion: version });
  return { farm: farm!, shrine: shrine!, refresh, offer };
};

describe("shrine offerings", () => {
  it("constructs one 1×1 shrine beside the road and consumes its materials", async () => {
    const f = await fixture();
    await db.delete(farmBuildings).where(eq(farmBuildings.id, f.shrine.id));
    await db.insert(farmGroundItems).values([
      { farmId: f.farm.id, itemKey: "reed", quantity: 2, column: 5, row: 0 },
      { farmId: f.farm.id, itemKey: "clay", quantity: 4, column: 6, row: 0 }
    ]);
    const input = { playerId: f.farm.playerId, building: "smallShrine" as const, target: { column: 7, row: 4 }, expectedFarmVersion: 1 };
    expect(await Effect.runPromise(Effect.flip(buildFarmBuilding(db, { ...input, target: { column: 5, row: 2 } })))).toMatchObject({ rule: { type: "road_access_required" } });
    expect((await f.refresh()).groundItems.reduce((sum, item) => sum + item.quantity, 0)).toBe(6);
    const built = await Effect.runPromise(buildFarmBuilding(db, input));
    expect(built.buildings[0]).toMatchObject({ type: "smallShrine", column: 7, row: 4, loadingTile: { column: 7, row: 5 } });
    expect(Date.parse(built.buildings[0]!.completesAt) - Date.parse(built.buildings[0]!.startedAt)).toBe(120000);
    expect(built.groundItems).toHaveLength(0);
    expect(await Effect.runPromise(Effect.flip(buildFarmBuilding(db, { ...input, target: { column: 6, row: 4 }, expectedFarmVersion: built.farm.version })))).toMatchObject({ rule: { type: "building_limit", limit: 1 } });
  });
  it.each(["bread", "beer"] as const)("consumes exactly two %s once, persists the blessing and rejects stacking", async item => {
    const f = await fixture();
    const result = await Effect.runPromise(productionAction(db, f.offer(item)));
    expect(result.inventory.find(i => i.itemKey === item)?.quantity).toBe(2);
    expect(result.inventory.find(i => i.itemKey === (item === "bread" ? "beer" : "bread"))?.quantity).toBe(4);
    expect(result.farm.household).toMatchObject({ happiness: 80, lastBreadAt: null, lastBeerAt: null });
    const blessing = result.farm.production.shrineBlessing!;
    expect(Date.parse(blessing.expiresAt) - Date.parse(blessing.startedAt)).toBe(SHRINE_BLESSING_DURATION_MS);
    expect((await f.refresh()).farm.production.shrineBlessing).toEqual(blessing);
    expect(await Effect.runPromise(Effect.flip(productionAction(db, f.offer(item))))).toMatchObject({ _tag: "ProductionRuleError" });
    expect(await Effect.runPromise(Effect.flip(productionAction(db, f.offer(item === "beer" ? "bread" : "beer", result.farm.version))))).toMatchObject({ message: expect.stringContaining("already active") });
    expect((await f.refresh()).inventory).toEqual(result.inventory);
  });
  it.each([[7, 4, true], [8, 1, true], [8, 4, false]] as const)("rejects unavailable offerings (level %i, stock %i, completed %s)", async (level, stock, complete) => {
    const f = await fixture(level, stock, complete);
    expect(await Effect.runPromise(Effect.flip(productionAction(db, f.offer("bread"))))).toMatchObject({ _tag: "ProductionRuleError" });
    const snapshot = await f.refresh();
    expect(snapshot.inventory.find(i => i.itemKey === "bread")?.quantity).toBe(stock);
    expect(snapshot.farm.production.shrineBlessing).toBeUndefined();
  });
  it("requires this farm's completed shrine and an available farmer", async () => {
    const f = await fixture();
    expect(await Effect.runPromise(Effect.flip(productionAction(db, { ...f.offer("bread"), buildingId: randomUUID() })))).toMatchObject({ message: "Choose a completed Small shrine." });
    await db.update(farms).set({ carriedItemKey: "barley", carriedItemQuantity: 1, carriedItemExpiresAt: new Date(Date.now() + 60000) }).where(eq(farms.id, f.farm.id));
    expect(await Effect.runPromise(Effect.flip(productionAction(db, f.offer("bread"))))).toMatchObject({ message: expect.stringContaining("empty") });
    expect((await f.refresh()).inventory.find(i => i.itemKey === "bread")?.quantity).toBe(4);
  });
  it("allows a new offering after expiry and keeps fractional decay credit", async () => {
    const f = await fixture();
    const now = Date.now();
    await db.update(farms).set({ happiness: 50, happinessCheckedAt: new Date(now - 3 * 3600000), production: {
      ...emptyProductionState(), shrineBlessing: { buildingId: f.shrine.id, startedAt: new Date(now - 13 * 3600000).toISOString(), expiresAt: new Date(now - 3600000).toISOString() }
    } }).where(eq(farms.id, f.farm.id));
    const result = await Effect.runPromise(productionAction(db, f.offer("beer")));
    expect(result.farm.household.happiness).toBe(50);
    const [record] = await db.select().from(farms).where(eq(farms.id, f.farm.id));
    // Two blessed hours and one normal hour = 2.5 hours of decay credit.
    expect(Math.abs(record!.happinessCheckedAt.getTime() - (now - 2.5 * 3600000))).toBeLessThan(1000);
    expect(result.inventory.find(i => i.itemKey === "beer")?.quantity).toBe(2);
  });
  it("applies the blessing during offline lifecycle catch-up, then resumes normal decay", async () => {
    const f = await fixture();
    const start = Date.now();
    await db.update(farms).set({ happiness: 100, happinessCheckedAt: new Date(start), production: {
      ...emptyProductionState(), shrineBlessing: { buildingId: f.shrine.id, startedAt: new Date(start).toISOString(), expiresAt: new Date(start + 12 * 3600000).toISOString() }
    } }).where(eq(farms.id, f.farm.id));
    const at = (hours: number) => db.transaction(async tx => {
      const [record] = await tx.select().from(farms).where(eq(farms.id, f.farm.id)).for("update");
      return advanceFarmLifecycle(tx, record!, new Date(start + hours * 3600000));
    });
    expect((await at(4)).happiness).toBe(85);
    expect((await at(12)).happiness).toBe(55);
    expect((await at(13)).happiness).toBe(50);
    expect((await db.select().from(farmInventory).where(and(eq(farmInventory.farmId, f.farm.id), eq(farmInventory.itemKey, "bread"))))[0]?.quantity).toBe(4);
  });
});
