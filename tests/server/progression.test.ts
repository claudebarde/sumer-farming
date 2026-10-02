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
  it.each([
    { barley: 19, donkey: 1, requests: 3, complete: true, succeeds: false },
    { barley: 20, donkey: 0, requests: 3, complete: true, succeeds: false },
    { barley: 20, donkey: 1, requests: 2, complete: true, succeeds: false },
    { barley: 20, donkey: 1, requests: 3, complete: false, succeeds: false },
    { barley: 20, donkey: 1, requests: 3, complete: true, succeeds: true }
  ])("checks all level-8 requirements without consuming stock: %j", async scenario => {
    const f = await fixture();
    await db.update(farms).set({ level: 7 }).where(eq(farms.id, f.farmId));
    await db.insert(farmBuildings).values({ farmId: f.farmId, type: "granary", column: 5, row: 0,
      storedBarley: scenario.barley, startedAt: new Date(0), completesAt: new Date(scenario.complete ? 1000 : Date.now() + 60000) });
    await db.insert(farmInventory).values([
      { farmId: f.farmId, itemKey: "donkey", quantity: scenario.donkey },
      { farmId: f.farmId, itemKey: "barley", quantity: 5 }
    ]);
    await db.insert(shekelTransactions).values(Array.from({ length: scenario.requests }, () => ({
      playerId: f.input.playerId, idempotencyKey: randomUUID(), type: "request_reward" as const,
      requestCustomer: "Test", delta: 5, balanceAfter: 20
    })));
    const snapshot = await f.snapshot();
    const progress = evaluateProgression(snapshot, Date.now());
    expect(progress.requirements.map(r => [r.current, r.required])).toEqual([
      [scenario.requests, 3], [scenario.complete ? scenario.barley : 0, 20], [scenario.donkey, 1]
    ]);
    expect(progress.canClaim).toBe(scenario.succeeds);
    expect(progress.offerings).toEqual([]);
    const input = { ...f.input, expectedLevel: 7, expectedFarmVersion: snapshot.farm.version };
    if (scenario.succeeds) {
      const claimed = await Effect.runPromise(claimFarmLevel(db, input));
      expect(claimed.farm.progression?.level).toBe(8);
      expect((await Effect.runPromise(claimFarmLevel(db, input))).farm.progression?.level).toBe(8);
    } else {
      expect(await Effect.runPromise(Effect.flip(claimFarmLevel(db, input)))).toMatchObject({ _tag: "LevelClaimRuleError" });
    }
    const reloaded = await f.snapshot();
    expect(reloaded.buildings[0]?.storedBarley).toBe(scenario.barley);
    expect(reloaded.inventory.find(i => i.itemKey === "donkey")?.quantity).toBe(scenario.donkey);
    expect(reloaded.farm.progression?.level).toBe(scenario.succeeds ? 8 : 7);
  });
  it.each([[14, 10], [15, 9], [6, 2]])("rejects insufficient level-6 progress %i produced / %i sold despite high lifetime totals", async (produced, sold) => {
    const f = await fixture();
    await db.update(farms).set({ level: 6, progressionStats: { ...INITIAL_PROGRESSION_STATS,
      beerProduced: 100 + produced, level6Baseline: { produced: 100, sold: 50 }
    } }).where(eq(farms.id, f.farmId));
    await db.insert(shekelTransactions).values({ playerId: f.input.playerId, idempotencyKey: randomUUID(), type: "market_sale", itemKey: "bread", itemQuantity: 50 + sold, unitPrice: 5, delta: (50 + sold) * 5, balanceAfter: 500 });
    const snapshot = await f.snapshot();
    const progress = evaluateProgression(snapshot, Date.now());
    expect(progress.requirements.map(r => [r.current, r.required])).toEqual([[produced, 15], [sold, 10]]);
    expect(progress.canClaim).toBe(false);
    expect(await Effect.runPromise(Effect.flip(claimFarmLevel(db, { ...f.input, expectedLevel: 6, expectedFarmVersion: snapshot.farm.version })))).toMatchObject({ _tag: "LevelClaimRuleError" });
  });
  it("initializes old level-6 saves once without erasing lifetime totals", async () => {
    const f = await fixture();
    await db.update(farms).set({ level: 6, progressionStats: { ...INITIAL_PROGRESSION_STATS, breadProduced: 12 } }).where(eq(farms.id, f.farmId));
    await db.insert(shekelTransactions).values({ playerId: f.input.playerId, idempotencyKey: randomUUID(), type: "market_sale", itemKey: "bread", itemQuantity: 5, unitPrice: 5, delta: 25, balanceAfter: 25 });
    const first = await f.snapshot();
    expect(first.farm.progression?.stats.level6Baseline).toEqual({ produced: 12, sold: 5 });
    expect(evaluateProgression(first, Date.now()).requirements.map(r => r.current)).toEqual([0, 0]);
    await db.update(farms).set({ progressionStats: { ...first.farm.progression!.stats, breadProduced: 14 } }).where(eq(farms.id, f.farmId));
    const reload = await f.snapshot();
    expect(reload.farm.progression?.stats.breadProduced).toBe(14);
    expect(evaluateProgression(reload, Date.now()).requirements.map(r => r.current)).toEqual([2, 0]);
    expect((await f.snapshot()).farm.progression?.stats.level6Baseline).toEqual({ produced: 12, sold: 5 });
  });
  it.each([[15, 0, 10, 0], [0, 15, 0, 10], [8, 7, 4, 6]])("allows level 7 with bread/beer production %i/%i and sales %i/%i", async (breadProduced, beerProduced, breadSold, beerSold) => {
    const f = await fixture();
    await db.update(farms).set({ level: 6, progressionStats: { ...INITIAL_PROGRESSION_STATS, breadProduced, beerProduced, level6Baseline: { produced: 0, sold: 0 } } }).where(eq(farms.id, f.farmId));
    for (const [itemKey, quantity] of [["bread", breadSold], ["beer", beerSold]] as const) {
      if (quantity) await db.insert(shekelTransactions).values({ playerId: f.input.playerId, idempotencyKey: randomUUID(), type: "market_sale", itemKey, itemQuantity: quantity, unitPrice: 5, delta: quantity * 5, balanceAfter: 20 });
    }
    const snapshot = await f.snapshot();
    expect(snapshot.farm.progression).toMatchObject({ breadSold, beerSold });
    expect(evaluateProgression(snapshot, Date.now()).canClaim).toBe(true);
    const claimed = await Effect.runPromise(claimFarmLevel(db, { ...f.input, expectedLevel: 6, expectedFarmVersion: snapshot.farm.version }));
    expect(claimed.farm.progression?.level).toBe(7);
  });
  it.each([
    { barley: 14, fish: 3, fed: 1, seed: 1, complete: true, succeeds: false },
    { barley: 15, fish: 2, fed: 1, seed: 1, complete: true, succeeds: false },
    { barley: 15, fish: 3, fed: 0, seed: 1, complete: true, succeeds: false },
    { barley: 15, fish: 3, fed: 1, seed: 0, complete: true, succeeds: false },
    { barley: 15, fish: 3, fed: 1, seed: 1, complete: false, succeeds: false },
    { barley: 15, fish: 4, fed: 1, seed: 1, complete: true, succeeds: true }
  ])("validates and consumes both level-5 offerings: %j", async scenario => {
    const f = await fixture(1);
    if (!scenario.seed) await db.delete(farmGroundItems).where(eq(farmGroundItems.farmId, f.farmId));
    await db.update(farms).set({ level: 4, progressionStats: { ...INITIAL_PROGRESSION_STATS, fishFed: scenario.fed } }).where(eq(farms.id, f.farmId));
    await db.insert(farmInventory).values({ farmId: f.farmId, itemKey: "fish", quantity: scenario.fish });
    await db.insert(farmBuildings).values({ farmId: f.farmId, type: "granary", column: 5, row: 0, storedBarley: scenario.barley,
      startedAt: new Date(0), completesAt: new Date(scenario.complete ? 1000 : Date.now() + 60000) });
    const input = { ...f.input, expectedLevel: 4 };
    const progress = evaluateProgression(await f.snapshot(), Date.now());
    expect(progress.canClaim).toBe(scenario.succeeds);
    expect(progress.offerings).toEqual([{ source: "fish", quantity: 3 }, { source: "granary_barley", quantity: 15 }]);
    if (scenario.succeeds) {
      const result = await Effect.runPromise(claimFarmLevel(db, input));
      expect(result.farm.progression?.level).toBe(5);
      expect(result.buildings[0]?.storedBarley).toBe(0);
      expect(result.inventory.find(i => i.itemKey === "fish")?.quantity).toBe(1);
      expect(result.groundItems[0]?.quantity).toBe(1);
      const retry = await Effect.runPromise(claimFarmLevel(db, input));
      expect(retry.farm.progression?.level).toBe(5);
      expect(retry.buildings[0]?.storedBarley).toBe(0);
      expect(retry.inventory.find(i => i.itemKey === "fish")?.quantity).toBe(1);
    } else {
      expect(await Effect.runPromise(Effect.flip(claimFarmLevel(db, input)))).toMatchObject({ _tag: "LevelClaimRuleError" });
      const result = await f.snapshot();
      expect(result.farm.progression?.level).toBe(4);
      expect(result.buildings[0]?.storedBarley).toBe(scenario.barley);
      expect(result.inventory.find(i => i.itemKey === "fish")?.quantity).toBe(scenario.fish);
    }
  });
  it.each(["ground", "planted", "farm", "carried", "expired", "sowing", "none"] as const)(
    "requires a full granary and preserves qualifying seed: %s", async reserve => {
      const f = await fixture(1);
      await db.update(farms).set({ level: 3, progressionStats: { ...INITIAL_PROGRESSION_STATS, harvests: 50 },
        ...(reserve === "carried" ? { carriedItemKey: "barley", carriedItemQuantity: 1, carriedItemExpiresAt: new Date(Date.now() + 86400000) } : {})
      }).where(eq(farms.id, f.farmId));
      if (reserve !== "ground") await db.delete(farmGroundItems).where(eq(farmGroundItems.farmId, f.farmId));
      if (reserve === "expired") await db.insert(farmGroundItems).values({ farmId: f.farmId, itemKey: "barley", quantity: 1, column: 2, row: 2, expiresAt: new Date(0) });
      if (reserve === "farm") await db.insert(farmInventory).values({ farmId: f.farmId, itemKey: "barley", quantity: 1 });
      if (reserve === "planted" || reserve === "sowing") await db.insert(farmCrops).values({ farmId: f.farmId, cropKey: "barley", column: 4, row: 7,
        sowingStartedAt: new Date(Date.now() - 20000), plantedAt: new Date(Date.now() + (reserve === "planted" ? -10000 : 60000)), growthCompletesAt: new Date(Date.now() + 1800000) });
      await db.insert(farmBuildings).values({ farmId: f.farmId, type: "granary", column: 5, row: 0, storedBarley: 14, startedAt: new Date(0), completesAt: new Date(1000) });
      await db.insert(shekelTransactions).values({ playerId: f.input.playerId, idempotencyKey: randomUUID(), type: "market_sale", itemKey: "barley", itemQuantity: 5, unitPrice: 1, delta: 5, balanceAfter: 5 });
      const input = { ...f.input, expectedLevel: 3 };
      expect(await Effect.runPromise(Effect.flip(claimFarmLevel(db, input)))).toMatchObject({ _tag: "LevelClaimRuleError" });
      await db.update(farmBuildings).set({ storedBarley: 15 }).where(eq(farmBuildings.farmId, f.farmId));
      if (reserve === "ground" || reserve === "planted") {
        const result = await Effect.runPromise(claimFarmLevel(db, input));
        expect(result.farm.progression?.level).toBe(4);
        expect(result.buildings[0]?.storedBarley).toBe(0);
        if (reserve === "ground") expect(result.groundItems[0]?.quantity).toBe(1);
        else expect(result.crops).toHaveLength(1);
        const retry = await Effect.runPromise(claimFarmLevel(db, input));
        expect(retry.farm.progression?.level).toBe(4);
        expect(retry.buildings[0]?.storedBarley).toBe(0);
      } else {
        expect(await Effect.runPromise(Effect.flip(claimFarmLevel(db, input)))).toMatchObject({ _tag: "LevelClaimRuleError" });
        expect((await f.snapshot()).buildings[0]?.storedBarley).toBe(15);
      }
    });
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
    await db.insert(farmInventory).values({ farmId: f.farmId, itemKey: "barley", quantity: 1 });
    await db.insert(farmBuildings).values({ farmId: f.farmId, type: "granary", column: 5, row: 0, storedBarley: 15, startedAt: new Date(0), completesAt: new Date(1000) });
    await db.insert(shekelTransactions).values({ playerId: f.input.playerId, idempotencyKey: randomUUID(), type: "market_sale", itemKey: "barley", itemQuantity: 5, unitPrice: 1, delta: 5, balanceAfter: 5 });
    const result = await Effect.runPromise(claimFarmLevel(db, { ...f.input, expectedLevel: 3 }));
    // The separate farm ration adds 10 happiness without consuming the offering.
    expect(result.farm.household.happiness).toBe(80);
    expect(result.farm.household.lastFishAt).toBeNull();
    await db.update(farms).set({ happinessCheckedAt: new Date(Date.now() - 3600000) }).where(eq(farms.id, f.farmId));
    expect((await f.snapshot()).farm.household.happiness).toBe(75);
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
    await db.update(farmBuildings).set({ storedBarley: 15 }).where(eq(farmBuildings.farmId, f.farmId));
    expect(await Effect.runPromise(Effect.flip(claimFarmLevel(db, { ...f.input, expectedLevel: 3, expectedFarmVersion: snapshot.farm.version })))).toMatchObject({ _tag: "LevelClaimRuleError" });
    const beforeUnlock = evaluateProgression(await f.snapshot(), Date.now());
    expect(beforeUnlock.requirements.find(r => r.label === "Crop plantings harvested")).toMatchObject({ current: 49, required: 50, met: false });
    await db.update(farms).set({ progressionStats: { ...snapshot.farm.progression!.stats, harvests: 50 } }).where(eq(farms.id, f.farmId));
    snapshot = await claim(); expect(snapshot.farm.progression?.level).toBe(4);
    expect(snapshot.buildings[0]?.storedBarley).toBe(0);
    expect(snapshot.groundItems[0]?.quantity).toBe(1);
    await db.insert(farmInventory).values({ farmId: f.farmId, itemKey: "fish", quantity: 3 });
    await db.update(farms).set({ progressionStats: { ...snapshot.farm.progression!.stats, fishFed: 1 } }).where(eq(farms.id, f.farmId));
    await db.update(farmBuildings).set({ storedBarley: 15 }).where(eq(farmBuildings.farmId, f.farmId));
    snapshot = await claim(); expect(snapshot.farm.progression?.level).toBe(5);
    expect(snapshot.buildings[0]?.storedBarley).toBe(0);
    expect(snapshot.inventory.find(i => i.itemKey === "fish")?.quantity).toBe(0);
    await db.insert(farmBuildings).values({ farmId: f.farmId, type: "brewery", column: 2, row: 2, startedAt: new Date(0), completesAt: new Date(1000) });
    await db.insert(farmBuildings).values({ farmId: f.farmId, type: "mill", column: 0, row: 6, startedAt: new Date(0), completesAt: new Date(1000) });
    await db.insert(farmInventory).values({ farmId: f.farmId, itemKey: "flour", quantity: 2 });
    await db.update(farms).set({ progressionStats: { ...snapshot.farm.progression!.stats, harvests: 100, beerProduced: 6, processedBarley: 4 } }).where(eq(farms.id, f.farmId));
    snapshot = await claim(); expect(snapshot.farm.progression?.level).toBe(6);
    expect(snapshot.farm.progression?.stats.level6Baseline).toEqual({ produced: 6, sold: 0 });
    expect(evaluateProgression(snapshot, Date.now()).requirements.map(r => r.current)).toEqual([0, 0]);
    await db.update(farms).set({ progressionStats: { ...snapshot.farm.progression!.stats, beerProduced: 21 } }).where(eq(farms.id, f.farmId));
    await db.insert(shekelTransactions).values({ playerId: f.input.playerId, idempotencyKey: randomUUID(), type: "market_sale", itemKey: "beer", itemQuantity: 10, unitPrice: 5, delta: 50, balanceAfter: 55 });
    snapshot = await claim(); expect(snapshot.farm.progression?.level).toBe(7);
    await db.insert(shekelTransactions).values([0, 1, 2].map(() => ({ playerId: f.input.playerId, idempotencyKey: randomUUID(), type: "request_reward" as const, requestCustomer: "Test", delta: 5, balanceAfter: 20 })));
    await db.update(farmBuildings).set({ storedBarley: 20 }).where(and(eq(farmBuildings.farmId, f.farmId), eq(farmBuildings.type, "granary")));
    await db.insert(farmInventory).values({ farmId: f.farmId, itemKey: "donkey", quantity: 1 });
    snapshot = await claim(); expect(snapshot.farm.progression?.level).toBe(8);
    expect(evaluateProgression(snapshot, Date.now())).toMatchObject({ upcoming: true, canClaim: false });
    expect((await db.select().from(farmGroundItems).where(and(eq(farmGroundItems.farmId, f.farmId), eq(farmGroundItems.itemKey, "barley"))))[0]?.quantity).toBe(1);
  });
});
