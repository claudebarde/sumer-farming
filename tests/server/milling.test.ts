import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { Effect } from "effect";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createDatabase } from "../../src/server/db/client";
import { farmBuildings, farmInventory, farms, players } from "../../src/server/db/schema";
import { startMilling, deliverMillGoods } from "../../src/server/services/milling";
import { readFarmSnapshot } from "../../src/server/services/farmSnapshot";
import { claimFarmLevel } from "../../src/server/services/claimFarmLevel";
import { assertFarmerAvailable } from "../../src/server/services/farmerAvailability";
import { fishingAction } from "../../src/server/services/fishing";
import { buildFarmBuilding } from "../../src/server/services/buildFarmBuilding";
import { INITIAL_PROGRESSION_STATS } from "../../src/game-data/progression";
import { MILL_RECIPES, type MillRecipe } from "../../src/game-data/milling";
import { commandUnlockLevel } from "../../src/game-core/farm/commandUnlock";
import { evaluateProgression } from "../../src/game-core/farm/progression";
import { millSprite, millingCollectionSource } from "../../src/game-core/farm/milling";
import { FarmSnapshotSchema } from "../../src/schemas/farm";

const client = new Client({ connectionString: process.env.TEST_DATABASE_URL ?? "postgres://sumer:sumer_dev@localhost:5432/sumer_farming" });
const db = createDatabase(client);
const ids = new Set<string>();
beforeAll(() => client.connect());
afterEach(async () => { if (ids.size) await db.delete(players).where(inArray(players.id, [...ids])); ids.clear(); });
afterAll(() => client.end());
const fixture = async (barley = 8) => {
  const playerId = randomUUID(); ids.add(playerId);
  await db.insert(players).values({ id: playerId, displayName: "Mill test" });
  const [farm] = await db.insert(farms).values({ playerId, level: 5, progressionStats: { ...INITIAL_PROGRESSION_STATS, harvestedBarley: 8 } }).returning();
  const [mill] = await db.insert(farmBuildings).values({ farmId: farm!.id, type: "mill", column: 2, row: 2, startedAt: new Date(0), completesAt: new Date(1000) }).returning();
  await db.insert(farmInventory).values({ farmId: farm!.id, itemKey: "barley", quantity: barley });
  const read = () => db.transaction(async tx => {
    const [current] = await tx.select().from(farms).where(eq(farms.id, farm!.id)).for("update");
    return readFarmSnapshot(tx, current!, false);
  });
  const start = async (recipe: MillRecipe) => {
    const snapshot = await read();
    return Effect.runPromise(startMilling(db, { playerId, type: "start_milling", recipe, target: mill!, expectedFarmVersion: snapshot.farm.version }));
  };
  const finish = async () => {
    const snapshot = await read();
    await db.update(farms).set({ milling: { ...snapshot.farm.milling!, completesAt: new Date(Date.now() - 1).toISOString() } }).where(eq(farms.id, farm!.id));
    return read();
  };
  return { farm: farm!, mill: mill!, playerId, read, start, finish };
};

describe("persistent single-farmer milling", () => {
  it("keeps mixed bags separate through pickup, reload and an exactly-once delivery", async () => {
    const f = await fixture();
    await f.start("flour"); await f.finish();
    await f.start("brewersGroats");
    const ready = await f.finish();
    expect(ready.farm.millGoods.pending[f.mill.id]).toEqual({ flour: 1, brewersGroats: 1 });
    const [granary] = await db.insert(farmBuildings).values({ farmId: f.farm.id, type: "granary", column: 5, row: 0, storedBarley: 15, startedAt: new Date(0), completesAt: new Date(1000) }).returning();
    const input = { type: "mill_delivery" as const, playerId: f.playerId, millId: f.mill.id };
    const picked = await Effect.runPromise(deliverMillGoods(db, { ...input, action: "pickup", expectedFarmVersion: ready.farm.version }));
    expect(picked.farm.millGoods.pending[f.mill.id]).toBeUndefined();
    expect(picked.inventory.find(i => i.itemKey === "flour")?.quantity ?? 0).toBe(0);
    const restored = await f.read();
    expect(restored.farm.millGoods.delivery?.bags).toEqual({ flour: 1, brewersGroats: 1 });
    expect(() => assertFarmerAvailable({ ...f.farm, millGoods: restored.farm.millGoods })).toThrow("processed grain");
    const duplicatePickup = await Effect.runPromise(Effect.flip(deliverMillGoods(db, { ...input, action: "pickup", expectedFarmVersion: restored.farm.version })));
    expect(duplicatePickup._tag).toBe("MillingRuleError");
    const stored = await Effect.runPromise(deliverMillGoods(db, { ...input, action: "store", expectedFarmVersion: restored.farm.version }));
    expect(stored.farm.millGoods.delivery).toBeNull();
    expect(stored.inventory.find(i => i.itemKey === "flour")?.quantity).toBe(1);
    expect(stored.inventory.find(i => i.itemKey === "brewersGroats")?.quantity).toBe(1);
    expect(stored.buildings.find(b => b.id === granary!.id)?.storedBarley).toBe(15);
    const duplicate = await Effect.runPromise(Effect.flip(deliverMillGoods(db, { ...input, action: "store", expectedFarmVersion: stored.farm.version })));
    expect(duplicate._tag).toBe("MillingRuleError");
    expect((await f.read()).inventory.find(i => i.itemKey === "flour")?.quantity).toBe(1);
  });

  it("stores mill bags at the farm without requiring a granary", async () => {
    const f = await fixture();
    await f.start("flour");
    const ready = await f.finish();
    const input = { type: "mill_delivery" as const, playerId: f.playerId, millId: f.mill.id };
    const picked = await Effect.runPromise(deliverMillGoods(db, { ...input, action: "pickup", expectedFarmVersion: ready.farm.version }));
    expect(picked.inventory.find(i => i.itemKey === "flour")).toBeUndefined();
    const stored = await Effect.runPromise(deliverMillGoods(db, { ...input, action: "store", expectedFarmVersion: picked.farm.version }));
    expect(stored.inventory.find(i => i.itemKey === "flour")?.quantity).toBe(1);
    expect(stored.farm.millGoods.delivery).toBeNull();
  });
  it.each(["flour", "brewersGroats"] as const)("visits a stocked granary and combines stocks for %s", async recipe => {
    const f = await fixture(3);
    await db.insert(farmBuildings).values({ farmId: f.farm.id, type: "granary", column: 5, row: 0, storedBarley: 1, startedAt: new Date(0), completesAt: new Date(1000) });
    const before = await f.read();
    expect(millingCollectionSource(before, Date.now())).toEqual({ type: "granary", column: 5, row: 0 });
    expect((await f.read()).buildings.find(b => b.type === "granary")?.storedBarley).toBe(1);
    const active = await f.start(recipe);
    expect(active.buildings.find(b => b.type === "granary")?.storedBarley).toBe(0);
    expect(active.inventory.find(i => i.itemKey === "barley")?.quantity).toBe(2);
  });

  it("counts carried barley and takes only one more from the granary", async () => {
    const f = await fixture(3);
    await db.update(farms).set({ carriedItemKey: "barley", carriedItemQuantity: 1, carriedItemExpiresAt: new Date(Date.now() + 86400000) }).where(eq(farms.id, f.farm.id));
    await db.insert(farmBuildings).values({ farmId: f.farm.id, type: "granary", column: 5, row: 0, storedBarley: 1, startedAt: new Date(0), completesAt: new Date(1000) });
    expect(millingCollectionSource(await f.read(), Date.now())?.type).toBe("granary");
    const active = await f.start("flour");
    expect(active.farm.carriedItem).toBeNull();
    expect(active.buildings.find(b => b.type === "granary")?.storedBarley).toBe(0);
    expect(active.inventory.find(i => i.itemKey === "barley")?.quantity).toBe(3);
  });

  it("visits the farm when granaries are empty and skips storage when only hands have barley", async () => {
    const f = await fixture(2);
    await db.insert(farmBuildings).values({ farmId: f.farm.id, type: "granary", column: 5, row: 0, storedBarley: 0, startedAt: new Date(0), completesAt: new Date(1000) });
    expect(millingCollectionSource(await f.read(), Date.now())).toEqual({ type: "farm" });
    const active = await f.start("flour");
    expect(active.inventory.find(i => i.itemKey === "barley")?.quantity).toBe(0);
    expect(millingCollectionSource(active, Date.now())).toBeNull();
  });
  it.each(["hands", "granary"] as const)("can use barley from %s", async source => {
    const f = await fixture(0);
    if (source === "hands") await db.update(farms).set({ carriedItemKey: "barley", carriedItemQuantity: 2, carriedItemExpiresAt: new Date(Date.now() + 86400000) }).where(eq(farms.id, f.farm.id));
    else await db.insert(farmBuildings).values({ farmId: f.farm.id, type: "granary", column: 5, row: 0, storedBarley: 2, startedAt: new Date(0), completesAt: new Date(1000) });
    const active = await f.start("flour");
    expect(active.farm.carriedItem).toBeNull();
    expect(active.buildings.find(b => b.type === "granary")?.storedBarley ?? 0).toBe(0);
    expect(active.farm.milling?.barley).toBe(2);
  });

  it("defaults absent milling fields when reading older snapshots", async () => {
    const f = await fixture();
    const current = await f.read();
    const older = { ...current, farm: { ...current.farm, milling: undefined,
      progression: { ...current.farm.progression!, stats: { ...current.farm.progression!.stats, processedBarley: undefined } } } };
    const restored = FarmSnapshotSchema.parse(older);
    expect(restored.farm.milling).toBeNull();
    expect(restored.farm.progression?.stats.processedBarley).toBe(0);
  });
  it.each(["flour", "brewersGroats"] as const)("consumes barley and completes %s exactly once", async recipe => {
    const f = await fixture();
    expect(millSprite(f.mill.id, (await f.read()).farm.milling)).toBe("mill");
    const active = await f.start(recipe);
    expect(active.inventory.find(i => i.itemKey === "barley")?.quantity).toBe(8 - MILL_RECIPES[recipe].barley);
    expect(active.farm.milling?.recipe).toBe(recipe);
    expect(Date.parse(active.farm.milling!.completesAt) - Date.parse(active.farm.milling!.startedAt)).toBe(MILL_RECIPES[recipe].durationMs);
    expect(millSprite(f.mill.id, active.farm.milling)).toBe("millBusy");
    const restored = await f.read();
    expect(restored.farm.milling).toEqual(active.farm.milling);
    expect(() => assertFarmerAvailable({ ...f.farm, milling: restored.farm.milling })).toThrow("Mill");
    const another = await Effect.runPromise(Effect.flip(startMilling(db, { playerId: f.playerId, type: "start_milling", recipe, target: f.mill, expectedFarmVersion: active.farm.version })));
    expect(another._tag).toBe("MillingRuleError");
    const building = await Effect.runPromise(Effect.flip(buildFarmBuilding(db, { playerId: f.playerId, building: "granary", target: { column: 0, row: 6 }, expectedFarmVersion: active.farm.version })));
    expect(building._tag).toBe("FarmerUnavailableError");
    const fishing = await Effect.runPromise(Effect.flip(fishingAction(db, { playerId: f.playerId, type: "fishing", action: "start", target: { column: 0, row: 10 }, expectedFarmVersion: active.farm.version })));
    expect(fishing._tag).toBe("FishingRuleError");
    const completed = await f.finish();
    expect(completed.farm.milling).toBeNull();
    expect(millSprite(f.mill.id, completed.farm.milling)).toBe("mill");
    expect(completed.inventory.find(i => i.itemKey === recipe)?.quantity ?? 0).toBe(0);
    expect(completed.farm.millGoods.pending[f.mill.id]?.[recipe]).toBe(1);
    expect(completed.farm.progression?.stats.processedBarley).toBe(2);
    expect((await f.read()).farm.millGoods.pending[f.mill.id]?.[recipe]).toBe(1);
    expect(() => assertFarmerAvailable({ ...f.farm, milling: null })).not.toThrow();
    await f.start(recipe);
  });

  it.each(["flour", "brewersGroats", "mixed"] as const)("accepts the %s specialization for level 6", async choice => {
    const f = await fixture();
    await db.update(farms).set({ progressionStats: { ...INITIAL_PROGRESSION_STATS, harvestedBarley: 200, harvests: 100 } }).where(eq(farms.id, f.farm.id));
    await f.start(choice === "mixed" ? "flour" : choice); await f.finish();
    await f.start(choice === "mixed" ? "brewersGroats" : choice);
    const pending = await f.finish();
    expect(evaluateProgression(pending, Date.now()).canClaim).toBe(false);
    const picked = await Effect.runPromise(deliverMillGoods(db, { type: "mill_delivery", action: "pickup", playerId: f.playerId, millId: f.mill.id, expectedFarmVersion: pending.farm.version }));
    const ready = await Effect.runPromise(deliverMillGoods(db, { type: "mill_delivery", action: "store", playerId: f.playerId, millId: f.mill.id, expectedFarmVersion: picked.farm.version }));
    const belowTarget = { ...ready, farm: { ...ready.farm, progression: { ...ready.farm.progression!, stats: { ...ready.farm.progression!.stats, harvests: 99 } } } };
    const requirement = evaluateProgression(belowTarget, Date.now()).requirements.find(r => r.label === "Crop plantings harvested");
    expect(requirement).toMatchObject({ current: 99, required: 100, met: false });
    expect(evaluateProgression(belowTarget, Date.now()).canClaim).toBe(false);
    expect(evaluateProgression(ready, Date.now()).canClaim).toBe(true);
    const claimed = await Effect.runPromise(claimFarmLevel(db, { playerId: f.playerId, expectedLevel: 5, expectedFarmVersion: ready.farm.version }));
    expect(claimed.farm.progression?.level).toBe(6);
    expect(claimed.inventory.filter(i => i.itemKey === "flour" || i.itemKey === "brewersGroats").reduce((sum, i) => sum + i.quantity, 0)).toBe(0);
  });

  it.each(["no_barley", "construction", "low_level", "fishing", "gathering"] as const)("rejects %s without spending barley", async reason => {
    const f = await fixture(reason === "no_barley" ? 1 : 8);
    if (reason === "construction") await db.update(farmBuildings).set({ completesAt: new Date(Date.now() + 60000) }).where(eq(farmBuildings.id, f.mill.id));
    if (reason === "low_level") await db.update(farms).set({ level: 4 }).where(eq(farms.id, f.farm.id));
    if (reason === "fishing") await db.update(farms).set({ fishing: { id: randomUUID(), seed: 1, startedAt: Date.now(), lastCastAt: null, column: 0, row: 10 } }).where(eq(farms.id, f.farm.id));
    if (reason === "gathering") await db.update(farms).set({ gatheringItemKey: "reed", gatheringColumn: 0, gatheringRow: 9, gatheringStartedAt: new Date(), gatheringCompletesAt: new Date(Date.now() + 60000) }).where(eq(farms.id, f.farm.id));
    const result = await Effect.runPromise(Effect.flip(startMilling(db, { playerId: f.playerId, type: "start_milling", recipe: "flour", target: f.mill, expectedFarmVersion: 1 })));
    expect(result._tag).toBe("MillingRuleError");
    const snapshot = await f.read();
    expect(snapshot.farm.milling).toBeNull();
    expect(snapshot.inventory.find(i => i.itemKey === "barley")?.quantity).toBe(reason === "no_barley" ? 1 : 8);
  });

  it("unlocks the Mill at 5 and postpones brewery construction to 6", () => {
    expect(commandUnlockLevel({ type: "build_mill", target: { column: 0, row: 0 }, expectedFarmVersion: 1 })).toBe(5);
    expect(commandUnlockLevel({ type: "build_brewery", target: { column: 0, row: 0 }, expectedFarmVersion: 1 })).toBe(6);
  });
});
