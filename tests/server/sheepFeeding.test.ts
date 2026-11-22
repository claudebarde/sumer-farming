import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { Effect } from "effect";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import { createDatabase } from "../../src/server/db/client";
import { farmBuildings, farmInventory, farms, players } from "../../src/server/db/schema";
import { feedFlock } from "../../src/server/services/feedFlock";
import { readFarmSnapshot } from "../../src/server/services/farmSnapshot";
import { advanceFarmLifecycle } from "../../src/server/services/farmLifecycle";
import { FEED_PERIOD_MS, FEED_GRACE_MS, type Livestock } from "../../src/game-data/livestock";
import { productionIngredientsAwaitingPickup } from "../../src/client/game/productionIngredientsAwaitingPickup";
const connectionString = process.env.TEST_DATABASE_URL ?? "postgres://sumer:sumer_dev@localhost:5432/sumer_farming";
const client = new Client({ connectionString }), db = createDatabase(client), ids: string[] = [];
beforeAll(() => client.connect());
afterEach(async () => { if (ids.length) await db.delete(players).where(inArray(players.id, ids)); ids.length = 0; });
afterAll(() => client.end());
const fixture = async (barley = 7) => {
  const playerId = randomUUID(); ids.push(playerId);
  await db.insert(players).values({ id: playerId, displayName: "Sheep feeding test", pointsStartedAt: new Date() });
  const [farm] = await db.insert(farms).values({ playerId, level: 12 }).returning();
  const [pen] = await db.insert(farmBuildings).values({ farmId: farm!.id, type: "sheepPen", column: 5, row: 3, loadingTile: { column: 5, row: 5 }, startedAt: new Date(0), completesAt: new Date(1) }).returning();
  const state: Livestock = { delivery: null, animals: Array.from({ length: 3 }, () => ({ id: randomUUID(), purchaseId: randomUUID(), penId: pen!.id, age: "lamb", purchasedAt: Date.now(), arrivesAt: 0 })) };
  await db.update(farms).set({ production: { ...farm!.production, livestock: state } }).where(eq(farms.id, farm!.id));
  await db.insert(farmInventory).values({ farmId: farm!.id, itemKey: "barley", quantity: barley });
  const refresh = () => db.transaction(async tx => { const [saved] = await tx.select().from(farms).where(eq(farms.id, farm!.id)).for("update"); return readFarmSnapshot(tx, saved!, false); });
  const snap = await refresh();
  return { playerId, farmId: farm!.id, refresh, input: { penId: pen!.id, expectedFarmVersion: snap.farm.version, idempotencyKey: randomUUID(), farmerPosition: { column: 3, row: 5 } } };
};
it("reserves six barley once and keeps physical stock visible until pickup", async () => {
  const f = await fixture();
  const first = await Effect.runPromise(feedFlock(db, f.playerId, f.input));
  const job = first.farm.production.livestock!.feeding!;
  expect(first.inventory.find(i => i.itemKey === "barley")!.quantity).toBe(1);
  expect(productionIngredientsAwaitingPickup(first.farm, "farm", job.startedAt - 1).barley).toBe(6);
  expect(productionIngredientsAwaitingPickup(first.farm, "farm", job.pickups[0]!.pickupAt).barley).toBeUndefined();
  expect(job.completesAt - job.startedAt).toBe((job.path.length - 1) * job.stepMs + 3000);
  expect((await Effect.runPromise(feedFlock(db, f.playerId, f.input))).inventory.find(i => i.itemKey === "barley")!.quantity).toBe(1);
  expect(await Effect.runPromise(Effect.flip(feedFlock(db, f.playerId, { ...f.input, idempotencyKey: randomUUID(), expectedFarmVersion: first.farm.version })))).toMatchObject({ _tag: "FeedFlockError" });
});
it("preserves the final planting barley", async () => {
  const f = await fixture(6);
  expect(await Effect.runPromise(Effect.flip(feedFlock(db, f.playerId, f.input)))).toMatchObject({ _tag: "FeedFlockError" });
  expect((await f.refresh()).inventory.find(i => i.itemKey === "barley")!.quantity).toBe(6);
});
it("settles missed feeding offline exactly once and releases pen capacity", async () => {
  const f = await fixture();
  const first = await Effect.runPromise(feedFlock(db, f.playerId, f.input));
  const deadline = first.farm.production.livestock!.feeding!.completesAt + FEED_PERIOD_MS + FEED_GRACE_MS;
  const settle = () => db.transaction(async tx => {
    const [saved] = await tx.select().from(farms).where(eq(farms.id, f.farmId)).for("update");
    return advanceFarmLifecycle(tx, saved!, new Date(deadline));
  });
  const result = await settle();
  expect(result.production.livestock!.animals).toHaveLength(0);
  expect(result.production.livestock!.losses).toHaveLength(3);
  expect((await settle()).production.livestock!.losses).toHaveLength(3);
});
it("serializes two competing feeds without double charging", async () => {
  const f = await fixture(20), other = new Client({ connectionString }); await other.connect();
  try {
    const results = await Promise.all([
      Effect.runPromise(Effect.either(feedFlock(db, f.playerId, f.input))),
      Effect.runPromise(Effect.either(feedFlock(createDatabase(other), f.playerId, { ...f.input, idempotencyKey: randomUUID() })))
    ]);
    expect(results.filter(r => r._tag === "Right")).toHaveLength(1);
    expect((await f.refresh()).inventory.find(i => i.itemKey === "barley")!.quantity).toBe(14);
  } finally { await other.end(); }
});
