import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { Effect } from "effect";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createDatabase } from "../../src/server/db/client";
import { farmBuildings, farmInventory, farms, players } from "../../src/server/db/schema";
import { startMilling } from "../../src/server/services/milling";
import { productionAction } from "../../src/server/services/production";
import { supplyBrewery } from "../../src/server/services/brewerySupplies";
import { readFarmSnapshot } from "../../src/server/services/farmSnapshot";
import { farmerProductionJob } from "../../src/game-core/farm/farmerProduction";
import { productionArrivalAt } from "../../src/game-core/farm/productionJourney";

const client = new Client({ connectionString: process.env.TEST_DATABASE_URL ?? "postgres://sumer:sumer_dev@localhost:5432/sumer_farming" });
const db = createDatabase(client);
const ids: string[] = [];
beforeAll(() => client.connect());
afterEach(async () => { vi.useRealTimers(); await db.delete(players).where(inArray(players.id, ids)); ids.length = 0; });
afterAll(() => client.end());

describe("production without animation callbacks", () => {
  it.each(["manual", "donkey", "bread", "beer"] as const)("persists %s immediately and catches up exactly once after hours away", async kind => {
    const playerId = randomUUID(); ids.push(playerId);
    const now = Date.now();
    vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(now);
    await db.insert(players).values({ id: playerId, displayName: "Offline production test" });
    const [farm] = await db.insert(farms).values({ playerId, level: 7 }).returning();
    const [building] = await db.insert(farmBuildings).values({ farmId: farm!.id,
      type: kind === "bread" ? "breadOven" : kind === "beer" ? "brewery" : "mill", column: 2, row: 2,
      startedAt: new Date(0), completesAt: new Date(1), ...(kind === "beer" ? { brewingWater: 2, emptyBeerJars: 2 } : {}) }).returning();
    const input = kind === "bread" ? "flour" : kind === "beer" ? "brewersGroats" : "barley";
    const quantity = kind === "donkey" ? 6 : 2;
    await db.insert(farmInventory).values([{ farmId: farm!.id, itemKey: input, quantity }, { farmId: farm!.id, itemKey: "donkey", quantity: 1 }]);
    const read = () => db.transaction(async tx => {
      const [record] = await tx.select().from(farms).where(eq(farms.id, farm!.id)).for("update");
      return readFarmSnapshot(tx, record!, false);
    });
    const start = () => kind === "bread"
      ? Effect.runPromise(productionAction(db, { type: "start_baking", playerId, buildingId: building!.id, expectedFarmVersion: 1 }))
      : kind === "beer"
        ? Effect.runPromise(supplyBrewery(db, { type: "brewery_supply", action: "start_brewing", playerId, target: building!, expectedFarmVersion: 1 }))
        : Effect.runPromise(startMilling(db, { type: "start_milling", playerId, target: building!, recipe: "flour", worker: kind === "donkey" ? "donkey" : "farmer", expectedFarmVersion: 1 }));
    const accepted = await start();
    expect(accepted.inventory.find(i => i.itemKey === input)?.quantity).toBe(0);
    await expect(start()).rejects.toBeDefined();
    const queued = await read(); // Simulate reload immediately, before arrival.
    const job = kind === "bread" ? queued.farm.production.baking[building!.id] : queued.farm.milling;
    if (kind !== "beer") {
      expect(job!.preparation).toBeDefined();
      const delay = productionArrivalAt(job!.preparation!) - now;
      expect(delay).toBeGreaterThan(0);
      expect(Date.parse(job!.startedAt)).toBe(now + delay);
      expect(farmerProductionJob(queued.farm, now)).not.toBeNull();
      vi.setSystemTime(now + delay + 1);
      const running = await read(); // No client arrival/start command was sent.
      expect(kind === "bread" ? running.farm.production.baking[building!.id] : running.farm.milling).toEqual(job);
      expect(farmerProductionJob(running.farm) === null).toBe(kind === "donkey");
    } else {
      const brew = queued.farm.production.brewing![building!.id]!;
      expect(Date.parse(brew.arrivedAt)).toBe(productionArrivalAt(brew.preparation));
      expect(Date.parse(brew.startedAt) - Date.parse(brew.arrivedAt)).toBe(8000);
      expect(Date.parse(brew.completesAt) - Date.parse(brew.startedAt)).toBe(15 * 60000);
      expect(queued.buildings[0]!.beerReadyAt).toBe(brew.completesAt);
      expect(farmerProductionJob(queued.farm, now)?.type).toBe("brewing");
      vi.setSystemTime(Date.parse(brew.arrivedAt) + 4000);
      const stirring = await read();
      expect(stirring.farm.production.brewing![building!.id]).toEqual(brew);
      expect(farmerProductionJob(stirring.farm)?.type).toBe("brewing");
      vi.setSystemTime(Date.parse(brew.startedAt));
      const fermenting = await read();
      expect(farmerProductionJob(fermenting.farm)).toBeNull();
      expect(fermenting.buildings[0]).toMatchObject({ brewingWater: 0, emptyBeerJars: 0 });
    }
    vi.setSystemTime(now + 3 * 60 * 60_000);
    for (let repeat = 0; repeat < 2; repeat++) {
      const finished = await read();
      expect(finished.farm.milling).toBeNull();
      expect(finished.farm.production.baking).toEqual({});
      if (kind === "beer") expect(finished.farm.production.brewing).toEqual({});
      expect(finished.inventory.find(i => i.itemKey === input)?.quantity).toBe(0);
      if (kind === "manual" || kind === "donkey") expect(finished.farm.millGoods.pending[building!.id]?.flour).toBe(kind === "donkey" ? 3 : 1);
      else expect(finished.farm.production.pending[building!.id]).toEqual({ itemKey: kind, quantity: 2 });
    }
  });
});
