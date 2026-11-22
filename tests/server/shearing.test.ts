import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { Effect } from "effect";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import { createDatabase } from "../../src/server/db/client";
import { farmBuildings, farms, players } from "../../src/server/db/schema";
import { shearFlock } from "../../src/server/services/shearFlock";
import { readFarmSnapshot } from "../../src/server/services/farmSnapshot";
import { setStoredQuantity } from "../../src/server/services/physicalStorage";
import { FEED_PERIOD_MS, WOOL_REGROW_MS } from "../../src/game-data/livestock";
const client = new Client({ connectionString: process.env.TEST_DATABASE_URL ?? "postgres://sumer:sumer_dev@localhost:5432/sumer_farming" });
const db = createDatabase(client), ids: string[] = [];
beforeAll(() => client.connect());
afterEach(async () => { if (ids.length) await db.delete(players).where(inArray(players.id, ids)); ids.length = 0; });
afterAll(() => client.end());
const fixture = async (wool = 0, hungry = false) => {
  const playerId = randomUUID(); ids.push(playerId);
  await db.insert(players).values({ id: playerId, displayName: "Shearing test", pointsStartedAt: new Date() });
  const [farm] = await db.insert(farms).values({ playerId, level: 12 }).returning();
  const [pen, warehouse] = await db.insert(farmBuildings).values([
    { farmId: farm!.id, type: "sheepPen", column: 5, row: 3, loadingTile: { column: 5, row: 5 }, startedAt: new Date(0), completesAt: new Date(1) },
    { farmId: farm!.id, type: "warehouse", column: 8, row: 3, loadingTile: { column: 8, row: 5 }, startedAt: new Date(0), completesAt: new Date(1) }
  ]).returning();
  const now = Date.now();
  await db.update(farms).set({ production: { ...farm!.production, livestock: { delivery: null, animals: [0,1].map(() => ({ id: randomUUID(), purchaseId: randomUUID(), penId: pen!.id, age: "adult" as const, purchasedAt: now - 86400000, arrivesAt: now - 86400000, care: { growthMs: 2 * FEED_PERIOD_MS, fedAt: null, needsFeedAt: now + (hungry ? -1000 : FEED_PERIOD_MS) } })) } } }).where(eq(farms.id, farm!.id));
  if (wool) await db.transaction(tx => setStoredQuantity(tx, farm!.id, "wool", wool, new Date(), warehouse!.id));
  const refresh = () => db.transaction(async tx => {
    const [saved] = await tx.select().from(farms).where(eq(farms.id, farm!.id)).for("update");
    return readFarmSnapshot(tx, saved!, false);
  });
  const snapshot = await refresh();
  return { playerId, farmId: farm!.id, refresh, input: { penId: pen!.id, expectedFarmVersion: snapshot.farm.version, idempotencyKey: randomUUID(), farmerPosition: { column: 5, row: 5 } } };
};
it("saves a batch, reserves all fleeces and deposits exactly once after offline completion", async () => {
  const f = await fixture();
  const started = await Effect.runPromise(shearFlock(db, f.playerId, f.input));
  const state = started.farm.production.livestock!, job = state.shearing!;
  expect(job.quantity).toBe(4); expect(job.shearedAt - job.shearsAt).toBe(120000);
  expect(started.inventory.find(i => i.itemKey === "wool")).toBeUndefined();
  const retry = await Effect.runPromise(shearFlock(db, f.playerId, f.input));
  expect(retry.farm.production.livestock!.shearing!.id).toBe(job.id);
  expect(await Effect.runPromise(Effect.flip(shearFlock(db, f.playerId, { ...f.input, expectedFarmVersion: retry.farm.version, idempotencyKey: randomUUID() })))).toMatchObject({ _tag: "ShearFlockError" });
  const shift = job.completesAt - Date.now() + 1000;
  await db.update(farms).set({ production: { ...started.farm.production, livestock: { ...state, fleece: { ...state.fleece!, updatedAt: state.fleece!.updatedAt - shift }, shearing: { ...job, startedAt: job.startedAt - shift, shearsAt: job.shearsAt - shift, shearedAt: job.shearedAt - shift, completesAt: job.completesAt - shift } } } }).where(eq(farms.id, f.farmId));
  const done = await f.refresh();
  expect(done.inventory.find(i => i.itemKey === "wool")?.quantity).toBe(4);
  expect(done.farm.production.livestock!.shearing!.settled).toBe(true);
  expect(done.farm.production.livestock!.fleece!.remainingMs).toBe(WOOL_REGROW_MS);
  expect((await f.refresh()).inventory.find(i => i.itemKey === "wool")?.quantity).toBe(4);
});
it.each([[10, false], [0, true]] as const)("rejects full storage or hungry flock (%s, %s)", async (wool, hungry) => {
  const f = await fixture(wool, hungry);
  expect(await Effect.runPromise(Effect.flip(shearFlock(db, f.playerId, f.input)))).toMatchObject({ _tag: "ShearFlockError" });
  expect((await f.refresh()).farm.production.livestock!.shearing).toBeUndefined();
});
it("serializes simultaneous starts so fleeces and storage are reserved once", async () => {
  const f = await fixture(8);
  const other = new Client({ connectionString: process.env.TEST_DATABASE_URL ?? "postgres://sumer:sumer_dev@localhost:5432/sumer_farming" });
  await other.connect();
  try {
    const results = await Promise.all([
      Effect.runPromise(Effect.either(shearFlock(db, f.playerId, f.input))),
      Effect.runPromise(Effect.either(shearFlock(createDatabase(other), f.playerId, { ...f.input, idempotencyKey: randomUUID() })))
    ]);
    expect(results.filter(r => r._tag === "Right")).toHaveLength(1);
    expect(results.filter(r => r._tag === "Left")).toHaveLength(1);
    const snapshot = await f.refresh();
    expect(snapshot.farm.production.livestock!.shearing!.quantity).toBe(4);
    expect(snapshot.inventory.find(i => i.itemKey === "wool")?.quantity).toBe(8);
  } finally { await other.end(); }
});
