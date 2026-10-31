import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { eq, inArray } from "drizzle-orm";
import { Effect } from "effect";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createDatabase } from "../../src/server/db/client";
import { players, farms, farmBuildings, farmCrops, farmInventory, farmImprovements, pointAwards, neighbourhoods, zigguratProjects, zigguratDonations } from "../../src/server/db/schema";
import { awardPoints, readPlayerPoints, reconcilePlayerPoints, reconcileZigguratPoints } from "../../src/server/services/playerPoints";
import { advanceFarmLifecycle } from "../../src/server/services/farmLifecycle";
import { batchPlantingAction } from "../../src/server/services/batchPlanting";
import { emptyProductionState } from "../../src/game-data/production";
import type { CropWork } from "../../src/game-data/cropWork";

const url = process.env.TEST_DATABASE_URL ?? "postgres://sumer:sumer_dev@localhost:5432/sumer_farming";
const client = new Client({ connectionString: url });
const db = createDatabase(client);
const ids: string[] = [], homes: string[] = [];
beforeAll(() => client.connect());
afterAll(() => client.end());
afterEach(async () => {
  if (ids.length) await db.delete(players).where(inArray(players.id, ids.splice(0)));
  if (homes.length) await db.delete(neighbourhoods).where(inArray(neighbourhoods.id, homes.splice(0)));
});
const fixture = async (start = Date.now() - 100_000) => {
  const playerId = randomUUID(); ids.push(playerId);
  await db.insert(players).values({ id: playerId, displayName: "Points test", pointsStartedAt: new Date(start) });
  const [farm] = await db.insert(farms).values({ playerId, level: 10 }).returning();
  const read = async () => (await db.select().from(farms).where(eq(farms.id, farm!.id)))[0]!;
  const total = () => db.transaction(tx => readPlayerPoints(tx, playerId));
  const advance = (at: number) => db.transaction(async tx => {
    const [locked] = await tx.select().from(farms).where(eq(farms.id, farm!.id)).for("update");
    return advanceFarmLifecycle(tx, locked!, new Date(at));
  });
  return { playerId, farm: farm!, read, total, advance };
};

describe("lifetime player points", () => {
  it("rejects historical and premature awards; records concurrent retries exactly once and rolls back with the action", async () => {
    const now = Date.now(), f = await fixture(now - 1000);
    await db.transaction(async tx => {
      await awardPoints(tx, f.playerId, { action: "bakeBread", source: "old", completedAt: new Date(now - 2000) });
      await awardPoints(tx, f.playerId, { action: "bakeBread", source: "future", completedAt: new Date(now + 10000) });
    });
    expect(await f.total()).toBe(0);
    await expect(db.transaction(async tx => {
      await awardPoints(tx, f.playerId, { action: "bakeBread", source: "rollback", completedAt: new Date(now) });
      throw new Error("outcome failed");
    })).rejects.toThrow("outcome failed");
    const second = new Client({ connectionString: url }); await second.connect();
    try {
      const award = { action: "millDonkey" as const, source: "same-job", completedAt: new Date(now) };
      await Promise.all([db.transaction(tx => awardPoints(tx, f.playerId, award)),
        createDatabase(second).transaction(tx => awardPoints(tx, f.playerId, award))]);
    } finally { await second.end(); }
    expect(await f.total()).toBe(35);
    expect((await db.select().from(pointAwards).where(eq(pointAwards.playerId, f.playerId)))[0]).toMatchObject({ ruleVersion: 1, source: "same-job" });
  });

  it.each([["farmer", 30], ["donkey", 35]] as const)("awards offline %s production per batch, not output, without repeat awards", async (worker, points) => {
    const f = await fixture(), now = Date.now();
    const [mill, oven, brewery] = await db.insert(farmBuildings).values([
      { farmId: f.farm.id, type: "mill" as const, column: 0, row: 0, startedAt: new Date(0), completesAt: new Date(1) },
      { farmId: f.farm.id, type: "breadOven" as const, column: 2, row: 0, startedAt: new Date(0), completesAt: new Date(1) },
      { farmId: f.farm.id, type: "brewery" as const, column: 4, row: 0, startedAt: new Date(0), completesAt: new Date(1), beerReadyAt: new Date(now + 1000) }
    ]).returning();
    const startedAt = new Date(now - 1000).toISOString(), completesAt = new Date(now + 1000).toISOString();
    await db.update(farms).set({ milling: { buildingId: mill!.id, recipe: "flour", worker, barley: 6, output: 3, startedAt, completesAt },
      production: { ...emptyProductionState(), baking: { [oven!.id]: { startedAt, completesAt, output: 2 } } } }).where(eq(farms.id, f.farm.id));
    await f.advance(now); expect(await f.total()).toBe(0);
    const completed = await f.advance(now + 2000);
    expect(await f.total()).toBe(points + 80);
    expect(completed.millGoods.pending[mill!.id]?.flour).toBe(3);
    expect(completed.production.pending[oven!.id]?.quantity).toBe(2);
    expect(completed.production.pending[brewery!.id]?.quantity).toBe(2);
    await f.advance(now + 2000); expect(await f.total()).toBe(points + 80);
  });

  it("awards harvest at cutting completion before delivery, including queued sesame fields, without rewarding delivery twice", async () => {
    const f = await fixture(), now = Date.now();
    const crops = await db.insert(farmCrops).values([4, 6].map(column => ({ farmId: f.farm.id, cropKey: "sesame" as const,
      column, row: 8, sowingStartedAt: new Date(0), plantedAt: new Date(1), growthCompletesAt: new Date(2) }))).returning();
    await db.insert(farmBuildings).values({ farmId: f.farm.id, type: "warehouse", column: 5, row: 3, startedAt: new Date(0), completesAt: new Date(1) });
    const job = (index: number): CropWork => ({ id: randomUUID(), cropId: crops[index]!.id, cropKey: "sesame", action: "harvest",
      startedAt: now, workStartsAt: now, workEndsAt: now + 1000 + index * 3000, completesAt: now + 3000 + index * 3000,
      outbound: [{ column: 4, row: 8 }], inbound: [{ column: 5, row: 5 }], quantity: 3, settled: false });
    await db.update(farms).set({ production: { ...emptyProductionState(), cropWork: job(0), cropWorkQueue: [job(1)] } }).where(eq(farms.id, f.farm.id));
    await f.advance(now + 999); expect(await f.total()).toBe(0);
    await f.advance(now + 1000); expect(await f.total()).toBe(20);
    expect(await db.select().from(farmInventory).where(eq(farmInventory.farmId, f.farm.id))).toHaveLength(0);
    await f.advance(now + 7000); expect(await f.total()).toBe(40);
    await f.advance(now + 8000); expect(await f.total()).toBe(40);
  });

  it.each([false, true])("awards a completed barley harvest equally when withered=%s", async withered => {
    const f = await fixture(), now = Date.now(), target = { column: 4, row: 8 };
    const completesAt = new Date(now + 1000);
    await db.insert(farmCrops).values({ farmId: f.farm.id, cropKey: "barley", ...target,
      sowingStartedAt: new Date(0), plantedAt: new Date(1), decayEligible: true,
      growthCompletesAt: new Date(now - (withered ? 30 * 3600000 : 1000)),
      harvestStartedAt: new Date(now), harvestCompletesAt: completesAt });
    await db.update(farms).set({ production: { ...emptyProductionState(), planting: {
      id: randomUUID(), mode: "harvest", total: 1, remaining: [], stopRequested: false,
      source: { type: "farm", column: 1, row: 3 }, nextStepAt: completesAt.toISOString(),
      phase: { type: "harvesting", target, completesAt: completesAt.toISOString() }
    } } }).where(eq(farms.id, f.farm.id));
    await f.advance(now); expect(await f.total()).toBe(0);
    const done = await f.advance(now + 1000);
    expect(done.carriedItemQuantity).toBe(withered ? 1 : 2);
    expect(await f.total()).toBe(10);
    await f.advance(now + 2000); expect(await f.total()).toBe(10);
  });

  it.each([["tend", 5], ["harvest", 20]] as const)("awards palm %s at work completion, not its return journey", async (action, points) => {
    const f = await fixture(), now = Date.now();
    const job: CropWork = { id: randomUUID(), cropId: randomUUID(), cropKey: "datePalm", action,
      startedAt: now, workStartsAt: now, workEndsAt: now + 1000, completesAt: now + 3000,
      outbound: [{ column: 4, row: 8 }], inbound: [{ column: 5, row: 5 }], quantity: action === "harvest" ? 2 : 0, settled: false };
    await db.update(farms).set({ production: { ...emptyProductionState(), cropWork: job } }).where(eq(farms.id, f.farm.id));
    await f.advance(now); expect(await f.total()).toBe(0);
    await f.advance(now + 1000); expect(await f.total()).toBe(points);
    await f.advance(now + 1000); expect(await f.total()).toBe(points);
  });

  it("awards each sown field after offline batch completion with no seed or point duplication", async () => {
    const f = await fixture(), fields = [{ column: 4, row: 8 }, { column: 6, row: 8 }];
    await db.insert(farmInventory).values({ farmId: f.farm.id, itemKey: "barley", quantity: 3 });
    await db.insert(farmImprovements).values([8, 9].map(row => ({ farmId: f.farm.id, type: "irrigation" as const, column: 5, row, startedAt: new Date(0), completesAt: new Date(1) })));
    await Effect.runPromise(batchPlantingAction(db, { type: "start_batch_planting", playerId: f.playerId, targets: fields, expectedFarmVersion: 1 }));
    expect(await f.total()).toBe(0);
    await f.advance(Date.now() + 60000); await f.advance(Date.now() + 60000);
    expect(await f.total()).toBe(10);
    expect((await db.select().from(farmCrops).where(eq(farmCrops.farmId, f.farm.id)))).toHaveLength(2);
    expect((await db.select().from(farmInventory).where(eq(farmInventory.farmId, f.farm.id)))[0]?.quantity).toBe(1);
  });

  it("retains first-building, tier and palm-coordinate receipts across replacement; treats and offerings have independent awards", async () => {
    const f = await fixture(), now = Date.now();
    const [building] = await db.insert(farmBuildings).values({ farmId: f.farm.id, type: "mill", column: 4, row: 1, startedAt: new Date(now - 1000), completesAt: new Date(now) }).returning();
    await db.insert(farmCrops).values({ farmId: f.farm.id, cropKey: "datePalm", column: 4, row: 8, sowingStartedAt: new Date(now - 1000), plantedAt: new Date(now), growthCompletesAt: new Date(now + 86400000) });
    await db.update(farms).set({ lastFishAt: new Date(now), lastBeerAt: new Date(now), lastBreadAt: new Date(now), production: { ...emptyProductionState(),
      lastDatesAt: new Date(now).toISOString(), shrineBlessing: { buildingId: building!.id, startedAt: new Date(now).toISOString(), expiresAt: new Date(now + 1000).toISOString() },
      buildingUpgrades: { [building!.id]: [{ level: 2, startedAt: new Date(now - 1000).toISOString(), completesAt: new Date(now).toISOString(), idempotencyKey: randomUUID() }] }
    } }).where(eq(farms.id, f.farm.id));
    await db.transaction(async tx => reconcilePlayerPoints(tx, await f.read(), new Date(now)));
    expect(await f.total()).toBe(145); // 50 + 50 + 15 + four treats + offering
    await db.delete(farmBuildings).where(eq(farmBuildings.id, building!.id));
    await db.delete(farmCrops).where(eq(farmCrops.farmId, f.farm.id));
    await db.insert(farmBuildings).values({ farmId: f.farm.id, type: "mill", column: 4, row: 1, startedAt: new Date(now), completesAt: new Date(now + 1) });
    await db.insert(farmCrops).values({ farmId: f.farm.id, cropKey: "datePalm", column: 4, row: 8, sowingStartedAt: new Date(now), plantedAt: new Date(now + 1), growthCompletesAt: new Date(now + 86400001) });
    await db.transaction(async tx => reconcilePlayerPoints(tx, await f.read(), new Date(now + 2)));
    expect(await f.total()).toBe(145);
  });

  it("awards ziggurat participation once per completed stage, not per donation or material point", async () => {
    const f = await fixture(), home = randomUUID(), now = Date.now(); homes.push(home);
    await db.insert(neighbourhoods).values({ id: home, city: "ur", name: "Points test", private: true });
    await db.insert(zigguratProjects).values({ neighbourhoodId: home, fundraisingOpenedAt: new Date(now - 21601000), foundationsCompleteAt: new Date(now),
      foundationsStartedAt: new Date(now - 21600000), foundationClay: 30, foundationReed: 15 });
    for (let i = 0; i < 2; i++) await db.insert(zigguratDonations).values({ playerId: f.playerId, neighbourhoodId: home,
      idempotencyKey: randomUUID(), stage: 0, clay: 1, reed: 0, requestedClay: 1, requestedReed: 0, points: 2 });
    await db.transaction(tx => reconcileZigguratPoints(tx, f.playerId));
    await db.transaction(tx => reconcileZigguratPoints(tx));
    expect(await f.total()).toBe(25);
  });
});
