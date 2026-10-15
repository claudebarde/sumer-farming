import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { Effect } from "effect";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import { createDatabase } from "../../src/server/db/client";
import { farmCrops, farmImprovements, farms, players } from "../../src/server/db/schema";
import { destroyIrrigation } from "../../src/server/services/destroyIrrigation";
import { removeCompletedImprovementDestructions } from "../../src/server/services/farmImprovementLifecycle";
import { INITIAL_FARM_CONFIG } from "../../src/game-data/initialFarm";

const client = new Client({ connectionString: process.env.TEST_DATABASE_URL ?? "postgres://sumer:sumer_dev@localhost:5432/sumer_farming" });
const db = createDatabase(client), ids: string[] = [];
beforeAll(() => client.connect());
afterEach(async () => { if (ids.length) await db.delete(players).where(inArray(players.id, ids)); ids.length = 0; });
afterAll(() => client.end());
const target = { column: 3, row: INITIAL_FARM_CONFIG.riverRow - 1 };
const fixture = async () => {
  const playerId = randomUUID(); ids.push(playerId);
  await db.insert(players).values({ id: playerId, displayName: "Canal removal test" });
  const [farm] = await db.insert(farms).values({ playerId, level: 5 }).returning();
  await db.insert(farmImprovements).values({ farmId: farm!.id, type: "irrigation", ...target, startedAt: new Date(0), completesAt: new Date(1) });
  return { farm: farm!, input: { playerId, target, expectedFarmVersion: 1 } };
};

it("persists a five-second removal, rejects repeats and removes only that canal at completion", async () => {
  const f = await fixture();
  await db.insert(farmImprovements).values({ farmId: f.farm.id, type: "irrigation", ...target, column: 5, startedAt: new Date(0), completesAt: new Date(1) });
  const next = await Effect.runPromise(destroyIrrigation(db, f.input));
  const canal = next.improvements.find(i => i.column === target.column)!;
  expect(Date.parse(canal.destroyCompletesAt!) - Date.parse(canal.destroyStartedAt!)).toBe(5000);
  await expect(Effect.runPromise(destroyIrrigation(db, { ...f.input, expectedFarmVersion: next.farm.version }))).rejects.toThrow();
  await db.transaction(tx => removeCompletedImprovementDestructions(tx, f.farm.id, new Date(Date.parse(canal.destroyCompletesAt!) + 1)));
  expect((await db.select().from(farmImprovements).where(eq(farmImprovements.farmId, f.farm.id))).map(i => i.column)).toEqual([5]);
});

it.each([false, true])("protects neighbouring crops (ripe=%s) even with an alternative supply", async ripe => {
  const f = await fixture();
  await db.insert(farmImprovements).values({ farmId: f.farm.id, type: "irrigation", ...target, column: 5, startedAt: new Date(0), completesAt: new Date(1) });
  await db.insert(farmCrops).values({ farmId: f.farm.id, cropKey: "barley", column: 4, row: target.row,
    sowingStartedAt: new Date(Date.now() - 70000), plantedAt: new Date(Date.now() - 60000), growthCompletesAt: new Date(Date.now() + (ripe ? -1 : 60000)) });
  expect(await Effect.runPromise(Effect.either(destroyIrrigation(db, f.input)))).toMatchObject({ _tag: "Left", left: { _tag: "IrrigationHasDependentsError" } });
  expect((await db.select().from(farmImprovements).where(eq(farmImprovements.farmId, f.farm.id))).every(i => i.destroyCompletesAt === null)).toBe(true);
});

it("rejects disconnecting downstream canals and rejects occupied hands", async () => {
  const f = await fixture();
  await db.insert(farmImprovements).values({ farmId: f.farm.id, type: "irrigation", ...target, row: target.row - 1, startedAt: new Date(0), completesAt: new Date(1) });
  await expect(Effect.runPromise(destroyIrrigation(db, f.input))).rejects.toThrow();
  const other = await fixture();
  await db.update(farms).set({ carriedItemKey: "barley", carriedItemQuantity: 1 }).where(eq(farms.id, other.farm.id));
  await expect(Effect.runPromise(destroyIrrigation(db, other.input))).rejects.toThrow("empty-handed");
});
