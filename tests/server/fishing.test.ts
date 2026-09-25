import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { Effect } from "effect";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createDatabase } from "../../src/server/db/client";
import { farms, farmInventory, players } from "../../src/server/db/schema";
import { fishingAction } from "../../src/server/services/fishing";
import { dropCarriedItem, depositCarriedItem, withdrawInventoryItem } from "../../src/server/services/farmItemActions";
import { fishPosition, catchesFish } from "../../src/game-core/farm/fishing";
import { CAST_DELAY_MS } from "../../src/game-data/fishing";
import { readFarmSnapshot } from "../../src/server/services/farmSnapshot";

const connectionString = process.env.TEST_DATABASE_URL ?? "postgres://sumer:sumer_dev@localhost:5432/sumer_farming";
const client = new Client({ connectionString });
const db = createDatabase(client);
const ids = new Set<string>();
beforeAll(() => client.connect());
afterEach(async () => { if (ids.size) await db.delete(players).where(inArray(players.id, [...ids])); ids.clear(); });
afterAll(() => client.end());
const fixture = async () => {
  const playerId = randomUUID(); ids.add(playerId);
  await db.insert(players).values({ id: playerId, displayName: "Fishing test" });
  const [farm] = await db.insert(farms).values({ playerId }).returning();
  return { playerId, farmId: farm!.id, type: "fishing" as const, action: "start" as const, target: { column: 2, row: 10 }, expectedFarmVersion: 1 };
};

describe("fishing", () => {
  it("has deterministic, bounded, continuous movement with different seeded routes", () => {
    for (let t = 0; t < 30000; t += 100) {
      const x = fishPosition(123, t);
      expect(x).toBeGreaterThanOrEqual(0.1); expect(x).toBeLessThanOrEqual(0.9);
      expect(Math.abs(fishPosition(123, t + 1) - x)).toBeLessThan(0.002);
      expect(catchesFish(123, t, x)).toBe(true);
      expect(catchesFish(123, t, Number.NaN)).toBe(false);
    }
    expect(fishPosition(123, 900)).not.toBe(fishPosition(321, 900));
  });
  it("starts only at the river with empty hands and free fish storage", async () => {
    const f = await fixture();
    expect(await Effect.runPromise(Effect.flip(fishingAction(db, { ...f, target: { column: 2, row: 4 } })))).toMatchObject({ _tag: "FishingRuleError" });
    await db.update(farms).set({ carriedItemKey: "barley", carriedItemQuantity: 1 }).where(eq(farms.id, f.farmId));
    expect(await Effect.runPromise(Effect.flip(fishingAction(db, f)))).toMatchObject({ _tag: "FishingRuleError" });
    await db.update(farms).set({ carriedItemKey: null, carriedItemQuantity: 0 }).where(eq(farms.id, f.farmId));
    await db.insert(farmInventory).values({ farmId: f.farmId, itemKey: "fish", quantity: 5 });
    expect(await Effect.runPromise(Effect.flip(fishingAction(db, f)))).toMatchObject({ message: "Fish storage is full." });
    await expect(db.update(farmInventory).set({ quantity: 6 }).where(eq(farmInventory.farmId, f.farmId))).rejects.toMatchObject({ cause: { code: "23514" } });
  });
  it("persists sessions, rejects another player's session and allows cancellation", async () => {
    const f = await fixture(); const other = await fixture();
    const snapshot = await Effect.runPromise(fishingAction(db, f));
    const session = snapshot.farm.fishing!;
    expect(await Effect.runPromise(Effect.flip(fishingAction(db, { type: "cast_fishing", playerId: other.playerId, sessionId: session.id, aim: 0.5 })))).toMatchObject({ _tag: "FishingRuleError" });
    const reloaded = await db.transaction(async tx => {
      const [farm] = await tx.select().from(farms).where(eq(farms.id, f.farmId));
      return readFarmSnapshot(tx, farm!, false);
    });
    expect(reloaded.farm.fishing?.id).toBe(session.id);
    const stopped = await Effect.runPromise(fishingAction(db, { type: "cancel_fishing", playerId: f.playerId, sessionId: session.id }));
    expect(stopped.farm.fishing).toBeNull(); expect(stopped.farm.carriedItem).toBeNull();
  });
  it("misses do not grant fish, enforce recovery, and block other physical actions", async () => {
    const f = await fixture();
    const snapshot = await Effect.runPromise(fishingAction(db, f));
    const cast = { type: "cast_fishing" as const, playerId: f.playerId, sessionId: snapshot.farm.fishing!.id, aim: 0 };
    const missed = await Effect.runPromise(fishingAction(db, cast));
    expect(missed.farm.carriedItem).toBeNull();
    expect(await Effect.runPromise(Effect.flip(fishingAction(db, cast)))).toMatchObject({ _tag: "FishingRuleError" });
    expect(await Effect.runPromise(Effect.flip(withdrawInventoryItem(db, { playerId: f.playerId, expectedFarmVersion: missed.farm.version, itemKey: "barley" })))).toMatchObject({ _tag: "FarmerUnavailableError" });
  });
  it("catches exactly one fish and restricts it to farm storage or river release", async () => {
    const f = await fixture();
    const started = await Effect.runPromise(fishingAction(db, f));
    const session = started.farm.fishing!;
    const cast = { type: "cast_fishing" as const, playerId: f.playerId, sessionId: session.id, aim: fishPosition(session.seed, Date.now() + CAST_DELAY_MS - session.startedAt) };
    const caught = await Effect.runPromise(fishingAction(db, cast));
    expect(caught.farm.carriedItem).toMatchObject({ itemKey: "fish", quantity: 1 });
    expect(caught.farm.fishing).toBeNull();
    expect(await Effect.runPromise(Effect.flip(fishingAction(db, cast)))).toMatchObject({ _tag: "FishingRuleError" });
    const version = caught.farm.version;
    expect(await Effect.runPromise(Effect.flip(dropCarriedItem(db, { playerId: f.playerId, expectedFarmVersion: version, target: { column: 1, row: 2 } })))).toMatchObject({ _tag: "FarmerUnavailableError" });
    expect(await Effect.runPromise(Effect.flip(depositCarriedItem(db, { playerId: f.playerId, expectedFarmVersion: version })))).toMatchObject({ _tag: "FarmerUnavailableError" });
    expect(await Effect.runPromise(Effect.flip(fishingAction(db, { ...f, action: "store", expectedFarmVersion: version })))).toMatchObject({ _tag: "FishingRuleError" });
    const stored = await Effect.runPromise(fishingAction(db, { ...f, action: "store", target: { column: 3, row: 0 }, expectedFarmVersion: version }));
    expect(stored.inventory.find(item => item.itemKey === "fish")?.quantity).toBe(1);
    expect(stored.farm.carriedItem).toBeNull();
    await db.update(farms).set({ carriedItemKey: "fish", carriedItemQuantity: 1 }).where(eq(farms.id, f.farmId));
    const released = await Effect.runPromise(fishingAction(db, { ...f, action: "release", expectedFarmVersion: stored.farm.version }));
    expect(released.farm.carriedItem).toBeNull();
    expect(released.inventory.find(item => item.itemKey === "fish")?.quantity).toBe(1);
  });
  it("does not lose a carried fish when farm storage is full and still allows release", async () => {
    const f = await fixture();
    await db.insert(farmInventory).values({ farmId: f.farmId, itemKey: "fish", quantity: 5 });
    await db.update(farms).set({ carriedItemKey: "fish", carriedItemQuantity: 1 }).where(eq(farms.id, f.farmId));
    expect(await Effect.runPromise(Effect.flip(fishingAction(db, { ...f, action: "store", target: { column: 3, row: 0 } })))).toMatchObject({ _tag: "FishingRuleError" });
    expect((await db.select().from(farms).where(eq(farms.id, f.farmId)))[0]?.carriedItemKey).toBe("fish");
    const released = await Effect.runPromise(fishingAction(db, { ...f, action: "release" }));
    expect(released.farm.carriedItem).toBeNull();
    expect(released.inventory.find(item => item.itemKey === "fish")?.quantity).toBe(5);
  });
});
