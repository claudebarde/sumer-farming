import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { Effect } from "effect";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { INITIAL_PROGRESSION_STATS } from "../../src/game-data/progression";
import { evaluateProgression } from "../../src/game-core/farm/progression";
import { createDatabase } from "../../src/server/db/client";
import { farmBuildings, farmCrops, farmGroundItems, farmInventory, farms, players, shekelTransactions } from "../../src/server/db/schema";
import { claimFarmLevel } from "../../src/server/services/claimFarmLevel";
import { readFarmSnapshot } from "../../src/server/services/farmSnapshot";

const connectionString = process.env.TEST_DATABASE_URL ?? "postgres://sumer:sumer_dev@localhost:5432/sumer_farming";
const client = new Client({ connectionString });
const db = createDatabase(client);
const ids = new Set<string>();
beforeAll(() => client.connect());
afterEach(async () => { if (ids.size) await db.delete(players).where(inArray(players.id, [...ids])); ids.clear(); });
afterAll(() => client.end());
const fixture = async (quantity = 5) => {
  const playerId = randomUUID(); ids.add(playerId);
  await db.insert(players).values({ id: playerId, displayName: "Progression test" });
  const [farm] = await db.insert(farms).values({ playerId, progressionStats: { ...INITIAL_PROGRESSION_STATS, harvestedBarley: 6, harvests: 3 } }).returning();
  await db.insert(farmGroundItems).values({ farmId: farm!.id, itemKey: "barley", quantity, column: 2, row: 2, expiresAt: new Date(Date.now() + 86400000) });
  const input = { playerId, expectedLevel: 1, expectedFarmVersion: 1 };
  const snapshot = () => db.transaction(async tx => {
    const [current] = await tx.select().from(farms).where(eq(farms.id, farm!.id)).for("update");
    return readFarmSnapshot(tx, current!, false);
  });
  return { farmId: farm!.id, input, snapshot };
};
describe("manual farm levels", () => {
  it("protects existing introductory farms while still consuming automatic rations", async () => {
    const f = await fixture();
    await db.update(farms).set({ happiness: 20, happinessCheckedAt: new Date(0),
      nextBarleyConsumptionAt: new Date(Date.now() - 1000) }).where(eq(farms.id, f.farmId));
    await db.insert(farmInventory).values({ farmId: f.farmId, itemKey: "barley", quantity: 1 });
    const snapshot = await f.snapshot();
    expect(snapshot.farm.household.happiness).toBe(80);
    expect(snapshot.inventory.find(i => i.itemKey === "barley")?.quantity ?? 0).toBe(0);
    expect(snapshot.farm.household.hungrySince).toBeNull();
  });
  it("starts level 4 decay without introductory debt or a fish cooldown", async () => {
    const f = await fixture();
    await db.update(farms).set({ level: 3, progressionStats: { ...INITIAL_PROGRESSION_STATS, harvests: 50 }, happiness: 70, happinessCheckedAt: new Date(0), hungrySince: new Date(0) }).where(eq(farms.id, f.farmId));
    await db.insert(shekelTransactions).values({ playerId: f.input.playerId, idempotencyKey: randomUUID(), type: "market_sale", itemKey: "barley", itemQuantity: 5, unitPrice: 1, delta: 5, balanceAfter: 5 });
    const result = await Effect.runPromise(claimFarmLevel(db, { ...f.input, expectedLevel: 3 }));
    expect(result.farm.household.happiness).toBe(70);
    expect(result.farm.household.lastFishAt).toBeNull();
    await db.update(farms).set({ happinessCheckedAt: new Date(Date.now() - 3600000) }).where(eq(farms.id, f.farmId));
    expect((await f.snapshot()).farm.household.happiness).toBe(65);
  });
  it("refuses to consume the last five barley without a field", async () => {
    const f = await fixture();
    expect(evaluateProgression(await f.snapshot(), Date.now())).toMatchObject({ canClaim: false, seedSafe: false });
    expect(await Effect.runPromise(Effect.flip(claimFarmLevel(db, f.input)))).toMatchObject({ _tag: "LevelClaimRuleError" });
    expect((await f.snapshot()).groundItems[0]?.quantity).toBe(5);
  });
  it("consumes five and preserves a sixth barley, even on repeated claims", async () => {
    const f = await fixture(6);
    const result = await Effect.runPromise(claimFarmLevel(db, f.input));
    expect(result.farm.progression?.level).toBe(2);
    expect(result.groundItems[0]?.quantity).toBe(1);
    const retry = await Effect.runPromise(claimFarmLevel(db, f.input));
    expect(retry.farm.progression?.level).toBe(2);
    expect(retry.groundItems[0]?.quantity).toBe(1);
  });
  it("allows five barley when another field is planted", async () => {
    const f = await fixture();
    await db.insert(farmCrops).values({ farmId: f.farmId, cropKey: "barley", column: 4, row: 7,
      sowingStartedAt: new Date(Date.now() - 20000), plantedAt: new Date(Date.now() - 10000), growthCompletesAt: new Date(Date.now() + 1800000) });
    const result = await Effect.runPromise(claimFarmLevel(db, f.input));
    expect(result.farm.progression?.level).toBe(2);
    expect(result.groundItems).toHaveLength(0);
    expect(result.crops).toHaveLength(1);
  });
  it("counts carried or stored seed but not expired barley or brewing supplies", async () => {
    const f = await fixture();
    await db.insert(farmGroundItems).values({ farmId: f.farmId, itemKey: "barley", quantity: 1, column: 3, row: 2, expiresAt: new Date(0) });
    expect(evaluateProgression(await f.snapshot(), Date.now()).seedSafe).toBe(false);
    await db.update(farms).set({ carriedItemKey: "barley", carriedItemQuantity: 1, carriedItemExpiresAt: new Date(Date.now() + 86400000) }).where(eq(farms.id, f.farmId));
    expect(evaluateProgression(await f.snapshot(), Date.now()).seedSafe).toBe(true);
    const result = await Effect.runPromise(claimFarmLevel(db, f.input));
    expect(result.farm.carriedItem?.quantity).toBe(1);
  });
  it("does not mistake starter bundles for a harvest or allow skipping levels", async () => {
    const f = await fixture(6);
    await db.update(farms).set({ progressionStats: INITIAL_PROGRESSION_STATS }).where(eq(farms.id, f.farmId));
    expect(evaluateProgression(await f.snapshot(), Date.now()).canClaim).toBe(false);
    expect(await Effect.runPromise(Effect.flip(claimFarmLevel(db, { ...f.input, expectedLevel: 2 })))).toMatchObject({ _tag: "LevelClaimRuleError" });
  });
  it("serializes simultaneous claims so the offering is spent only once", async () => {
    const f = await fixture(6);
    const second = new Client({ connectionString }); await second.connect();
    try {
      const results = await Promise.all([Effect.runPromise(claimFarmLevel(db, f.input)), Effect.runPromise(claimFarmLevel(createDatabase(second), f.input))]);
      expect(results.map(r => r.farm.progression?.level)).toEqual([2, 2]);
      expect((await f.snapshot()).groundItems[0]?.quantity).toBe(1);
    } finally { await second.end(); }
  });
  it("supports every playable level and stops before the unbuilt expansion", async () => {
    const f = await fixture(6);
    let snapshot = await Effect.runPromise(claimFarmLevel(db, f.input));
    const claim = () => Effect.runPromise(claimFarmLevel(db, { ...f.input, expectedLevel: snapshot.farm.progression!.level, expectedFarmVersion: snapshot.farm.version }));
    await db.insert(farmBuildings).values({ farmId: f.farmId, type: "granary", column: 5, row: 0, storedBarley: 10, startedAt: new Date(0), completesAt: new Date(1000) });
    snapshot = await claim();
    expect(snapshot.farm.progression?.level).toBe(3);
    expect(snapshot.buildings[0]?.storedBarley).toBe(0);
    await db.insert(shekelTransactions).values({ playerId: f.input.playerId, idempotencyKey: randomUUID(), type: "market_sale", itemKey: "barley", itemQuantity: 5, unitPrice: 1, delta: 5, balanceAfter: 5 });
    await db.update(farms).set({ progressionStats: { ...snapshot.farm.progression!.stats, harvests: 49 } }).where(eq(farms.id, f.farmId));
    expect(await Effect.runPromise(Effect.flip(claimFarmLevel(db, { ...f.input, expectedLevel: 3, expectedFarmVersion: snapshot.farm.version })))).toMatchObject({ _tag: "LevelClaimRuleError" });
    const beforeUnlock = evaluateProgression(await f.snapshot(), Date.now());
    expect(beforeUnlock.requirements.find(r => r.label === "Crop plantings harvested")).toMatchObject({ current: 49, required: 50, met: false });
    await db.update(farms).set({ progressionStats: { ...snapshot.farm.progression!.stats, harvests: 50 } }).where(eq(farms.id, f.farmId));
    snapshot = await claim(); expect(snapshot.farm.progression?.level).toBe(4);
    await db.insert(farmInventory).values({ farmId: f.farmId, itemKey: "fish", quantity: 3 });
    await db.update(farms).set({ progressionStats: { ...snapshot.farm.progression!.stats, fishFed: 1 } }).where(eq(farms.id, f.farmId));
    snapshot = await claim(); expect(snapshot.farm.progression?.level).toBe(5);
    expect(snapshot.inventory.find(i => i.itemKey === "fish")?.quantity).toBe(0);
    await db.insert(farmBuildings).values({ farmId: f.farmId, type: "brewery", column: 2, row: 2, startedAt: new Date(0), completesAt: new Date(1000) });
    await db.update(farms).set({ progressionStats: { ...snapshot.farm.progression!.stats, beerProduced: 6 } }).where(eq(farms.id, f.farmId));
    snapshot = await claim(); expect(snapshot.farm.progression?.level).toBe(6);
    await db.insert(shekelTransactions).values({ playerId: f.input.playerId, idempotencyKey: randomUUID(), type: "market_sale", itemKey: "beer", itemQuantity: 2, unitPrice: 5, delta: 10, balanceAfter: 15 });
    snapshot = await claim(); expect(snapshot.farm.progression?.level).toBe(7);
    await db.insert(shekelTransactions).values([0, 1, 2].map(() => ({ playerId: f.input.playerId, idempotencyKey: randomUUID(), type: "request_reward" as const, requestCustomer: "Test", delta: 5, balanceAfter: 20 })));
    snapshot = await claim(); expect(snapshot.farm.progression?.level).toBe(8);
    expect(evaluateProgression(snapshot, Date.now())).toMatchObject({ upcoming: true, canClaim: false });
    expect((await db.select().from(farmGroundItems).where(and(eq(farmGroundItems.farmId, f.farmId), eq(farmGroundItems.itemKey, "barley"))))[0]?.quantity).toBe(1);
  });
});
