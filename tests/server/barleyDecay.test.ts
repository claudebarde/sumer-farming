import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createDatabase } from "../../src/server/db/client";
import { farmCrops, farms, players } from "../../src/server/db/schema";
import { advanceFarmLifecycle } from "../../src/server/services/farmLifecycle";
import { advanceBatchPlanting } from "../../src/server/services/batchPlantingLifecycle";
import { BARLEY_WITHERING_MS as DAY } from "../../src/game-core/farm/barleyDecay";

const client = new Client({ connectionString: process.env.TEST_DATABASE_URL ?? "postgres://sumer:sumer_dev@localhost:5432/sumer_farming" });
const db = createDatabase(client);
const ids: string[] = [];
beforeAll(() => client.connect());
afterAll(() => client.end());
afterEach(async () => { if (ids.length) await db.delete(players).where(inArray(players.id, ids)); ids.length = 0; });
const ready = Date.now() - 3 * DAY;
const fixture = async (level = 10) => {
  const playerId = randomUUID(); ids.push(playerId);
  await db.insert(players).values({ id: playerId, displayName: "Decay test" });
  const [farm] = await db.insert(farms).values({ playerId, level, happiness: 50 }).returning();
  return farm!;
};
const cropAt = (farmId: string, column: number, decayEligible = true) => ({ farmId, column, row: 8, cropKey: "barley" as const,
  decayEligible, sowingStartedAt: new Date(ready - 20000), plantedAt: new Date(ready - 10000), growthCompletesAt: new Date(ready) });
const advance = (id: string, now: number, full = false) => db.transaction(async tx => {
  const [farm] = await tx.select().from(farms).where(eq(farms.id, id)).for("update");
  return (full ? advanceFarmLifecycle : advanceBatchPlanting)(tx, farm!, new Date(now));
});

describe("persisted barley decay", () => {
  it("clears at 48 hours once, retaining legacy barley and date palms", async () => {
    const farm = await fixture();
    await db.insert(farmCrops).values([cropAt(farm.id, 0), cropAt(farm.id, 1, false), { ...cropAt(farm.id, 2), cropKey: "datePalm" }]);
    await advance(farm.id, ready + 2 * DAY - 1, true);
    expect(await db.select().from(farmCrops).where(eq(farmCrops.farmId, farm.id))).toHaveLength(3);
    const cleared = await advance(farm.id, ready + 2 * DAY, true);
    expect((await db.select().from(farmCrops).where(eq(farmCrops.farmId, farm.id))).map(c => c.column)).toEqual([1, 2]);
    const repeated = await advance(farm.id, ready + 2 * DAY, true);
    expect(repeated.version).toBe(cleared.version);
    expect(repeated.progressionStats.harvestedBarley).toBe(0);
  });
  it.each([[DAY - 1, 2], [DAY, 1], [2 * DAY - 1, 1], [2 * DAY, 0]])(
    "settles offline harvest started at age %i with yield %i exactly once", async (age, expected) => {
      const farm = await fixture();
      await db.insert(farmCrops).values(cropAt(farm.id, 0));
      const at = ready + age;
      await db.update(farms).set({ production: { ...farm.production, planting: {
        id: randomUUID(), mode: "harvest", total: 1, harvestFieldLimit: 4,
        remaining: [{ column: 0, row: 8 }], source: { type: "farm", column: 1, row: 5 },
        phase: { type: "ready" }, stopRequested: false, nextStepAt: new Date(at).toISOString(),
        travelMs: [0], travelPaths: [[{ column: 0, row: 8 }]]
      } } }).where(eq(farms.id, farm.id));
      const done = await advance(farm.id, ready + 3 * DAY);
      expect(done.production.planting).toBeNull();
      expect(done.progressionStats.harvestedBarley).toBe(expected);
      expect(done.progressionStats.harvests).toBe(expected ? 1 : 0);
      const repeated = await advance(farm.id, ready + 3 * DAY);
      expect(repeated.progressionStats).toEqual(done.progressionStats);
      expect(await db.select().from(farmCrops).where(eq(farmCrops.farmId, farm.id))).toHaveLength(0);
    });
  it.each([true, false])("persists planting eligibility %s from the saved queue", async decayEligible => {
    const farm = await fixture();
    await db.update(farms).set({ production: { ...farm.production, planting: {
      id: randomUUID(), decayEligible, total: 1, remaining: [{ column: 0, row: 8 }],
      source: { type: "farm", column: 1, row: 5 }, phase: { type: "ready" }, stopRequested: false,
      nextStepAt: new Date(ready - 20000).toISOString(), travelMs: [0]
    } } }).where(eq(farms.id, farm.id));
    await advance(farm.id, ready);
    const [crop] = await db.select().from(farmCrops).where(eq(farmCrops.farmId, farm.id));
    expect(crop?.decayEligible).toBe(decayEligible);
  });
});
