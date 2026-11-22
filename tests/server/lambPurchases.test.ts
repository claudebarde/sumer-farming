import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { Effect } from "effect";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import { createDatabase } from "../../src/server/db/client";
import { farmBuildings, farms, players, shekelTransactions } from "../../src/server/db/schema";
import { buyLambs } from "../../src/server/services/buyLambs";
import { readFarmSnapshot } from "../../src/server/services/farmSnapshot";
import { buildingDemolitionReason } from "../../src/game-core/farm/buildingDemolition";
import { lambDeliveryActive, lambPurchaseLimit } from "../../src/game-data/livestock";

const client = new Client({ connectionString: process.env.TEST_DATABASE_URL ?? "postgres://sumer:sumer_dev@localhost:5432/sumer_farming" });
const db = createDatabase(client), ids: string[] = [];
beforeAll(() => client.connect());
afterEach(async () => { if (ids.length) await db.delete(players).where(inArray(players.id, ids)); ids.length = 0; });
afterAll(() => client.end());
const fixture = async (balance = 72, level = 12, pen = true) => {
  const playerId = randomUUID(); ids.push(playerId);
  await db.insert(players).values({ id: playerId, displayName: "Lamb test", shekelBalance: balance, pointsStartedAt: new Date() });
  const [farm] = await db.insert(farms).values({ playerId, level }).returning();
  if (pen) await db.insert(farmBuildings).values({ farmId: farm!.id, type: "sheepPen", column: 5, row: 3, loadingTile: { column: 5, row: 5 },
    startedAt: new Date(Date.now() - 181000), completesAt: new Date(Date.now() - 1000) });
  const refresh = () => db.transaction(async tx => {
    const [saved] = await tx.select().from(farms).where(eq(farms.id, farm!.id)).for("update");
    return readFarmSnapshot(tx, saved!, false);
  });
  const snap = await refresh();
  const input = { quantity: 3, expectedFarmVersion: snap.farm.version, idempotencyKey: randomUUID() };
  return { playerId, farm: farm!, input, refresh };
};
it("buys three lambs once, reserves all slots and persists arrival independently of animation", async () => {
  const f = await fixture();
  const bought = await Effect.runPromise(buyLambs(db, f.playerId, f.input));
  expect(bought.player.shekelBalance).toBe(0);
  const livestock = bought.farm.production.livestock!;
  expect(livestock.animals).toHaveLength(3);
  expect(lambDeliveryActive(livestock, livestock.delivery!.startedAt)).toBe(true);
  expect(lambDeliveryActive(livestock, livestock.delivery!.completesAt)).toBe(false);
  expect(livestock.animals.every(a => a.arrivesAt === livestock.delivery!.completesAt)).toBe(true);
  expect(buildingDemolitionReason(bought, livestock.delivery!.penId, livestock.delivery!.completesAt + 1)).toBe("The pen still contains animals.");
  const retry = await Effect.runPromise(buyLambs(db, f.playerId, f.input));
  expect(retry.farm.production.livestock).toEqual(livestock);
  expect(retry.player.shekelBalance).toBe(0);
  expect((await f.refresh()).farm.production.livestock).toEqual(livestock);
  expect(await db.select().from(shekelTransactions).where(eq(shekelTransactions.playerId, f.playerId))).toHaveLength(1);
  expect(await Effect.runPromise(Effect.flip(buyLambs(db, f.playerId, { ...f.input, quantity: 1 })))).toMatchObject({ _tag: "LambPurchaseError" });
});
it.each([[23,12,true], [72,11,true], [72,12,false]] as const)("rejects unavailable purchases (%s, %s, %s) without charging", async (balance, level, pen) => {
  const f = await fixture(balance, level, pen);
  expect(await Effect.runPromise(Effect.flip(buyLambs(db, f.playerId, { ...f.input, quantity: 1 })))).toMatchObject({ _tag: "LambPurchaseError" });
  expect((await f.refresh()).player.shekelBalance).toBe(balance);
  expect((await f.refresh()).farm.production.livestock?.animals ?? []).toHaveLength(0);
});
it("rejects malformed quantities and stale tabs", async () => {
  const f = await fixture();
  for (const quantity of [0, -1, 1.5, 4]) expect(await Effect.runPromise(Effect.flip(buyLambs(db, f.playerId, { ...f.input, quantity })))).toMatchObject({ _tag: "LambPurchaseError" });
  await Effect.runPromise(buyLambs(db, f.playerId, { ...f.input, quantity: 1 }));
  expect(await Effect.runPromise(Effect.flip(buyLambs(db, f.playerId, { ...f.input, idempotencyKey: randomUUID() })))).toMatchObject({ _tag: "LambPurchaseError" });
  expect((await f.refresh()).player.shekelBalance).toBe(48);
});
it("counts adults as occupied spaces and affordability limits the quantity", () => {
  expect(lambPurchaseLimit(1, 72)).toBe(2);
  expect(lambPurchaseLimit(0, 47)).toBe(1);
  expect(lambPurchaseLimit(3, 100)).toBe(0);
});
it("reconciles offline delivery, counts an adult and accepts only the two remaining slots", async () => {
  const f = await fixture(120);
  const bought = await Effect.runPromise(buyLambs(db, f.playerId, { ...f.input, quantity: 1 }));
  const state = bought.farm.production.livestock!;
  const past = Date.now() - 60_000;
  await db.update(farms).set({ production: { ...bought.farm.production, livestock: {
    animals: state.animals.map(a => ({ ...a, age: "adult" as const, arrivesAt: past })),
    delivery: { ...state.delivery!, startedAt: past - 10000, farmStartsAt: past - 5000, completesAt: past }
  } } }).where(eq(farms.id, f.farm.id));
  const returned = await f.refresh();
  expect(lambDeliveryActive(returned.farm.production.livestock)).toBe(false);
  expect(returned.farm.production.livestock!.animals).toHaveLength(1);
  const second = await Effect.runPromise(buyLambs(db, f.playerId, { quantity: 2, expectedFarmVersion: returned.farm.version, idempotencyKey: randomUUID() }));
  expect(second.farm.production.livestock!.animals).toHaveLength(3);
  expect(second.player.shekelBalance).toBe(48);
  expect((await f.refresh()).player.shekelBalance).toBe(48);
});
it("serializes two tabs competing for the last pen spaces", async () => {
  const f = await fixture();
  const other = new Client({ connectionString: process.env.TEST_DATABASE_URL ?? "postgres://sumer:sumer_dev@localhost:5432/sumer_farming" });
  await other.connect();
  try {
    const results = await Promise.all([
      Effect.runPromise(Effect.either(buyLambs(db, f.playerId, { ...f.input, quantity: 2 }))),
      Effect.runPromise(Effect.either(buyLambs(createDatabase(other), f.playerId, { ...f.input, quantity: 2, idempotencyKey: randomUUID() })))
    ]);
    expect(results.filter(r => r._tag === "Right")).toHaveLength(1);
    expect((await f.refresh()).farm.production.livestock!.animals).toHaveLength(2);
    expect((await f.refresh()).player.shekelBalance).toBe(24);
  } finally { await other.end(); }
});
