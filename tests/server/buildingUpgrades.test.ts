import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { Effect } from "effect";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createDatabase } from "../../src/server/db/client";
import { farmBuildings, farmInventory, farms, players, shekelTransactions } from "../../src/server/db/schema";
import { upgradeBuilding } from "../../src/server/services/buildingUpgrades";
import { startMilling } from "../../src/server/services/milling";
import { readFarmSnapshot } from "../../src/server/services/farmSnapshot";
import { buildingLevel } from "../../src/game-data/buildingUpgrades";
import { productionAction } from "../../src/server/services/production";
import { supplyBrewery } from "../../src/server/services/brewerySupplies";

const client = new Client({ connectionString: process.env.TEST_DATABASE_URL ?? "postgres://sumer:sumer_dev@localhost:5432/sumer_farming" });
const db = createDatabase(client);
const ids: string[] = [];
beforeAll(() => client.connect());
afterEach(async () => { if (ids.length) await db.delete(players).where(inArray(players.id, ids)); ids.length = 0; });
afterAll(() => client.end());
const fixture = async (balance = 500, level = 8) => {
  const playerId = randomUUID(); ids.push(playerId);
  await db.insert(players).values({ id: playerId, displayName: "Upgrade test", shekelBalance: balance });
  const [farm] = await db.insert(farms).values({ playerId, level }).returning();
  const [mill] = await db.insert(farmBuildings).values({ farmId: farm!.id, type: "mill", column: 3, row: 3, startedAt: new Date(0), completesAt: new Date(1) }).returning();
  await db.insert(farmInventory).values([{ farmId: farm!.id, itemKey: "barley", quantity: 20 }, { farmId: farm!.id, itemKey: "donkey", quantity: 1 }]);
  return { playerId, farm: farm!, mill: mill!, input: { type: "upgrade_building" as const, playerId, buildingId: mill!.id, targetLevel: 2, idempotencyKey: randomUUID(), expectedFarmVersion: 1 } };
};

describe("mill building upgrades", () => {
  it.each([
    ["mill", 2, 8], ["mill", 3, 10],
    ["breadOven", 2, 9], ["breadOven", 3, 11],
    ["brewery", 2, 9], ["brewery", 3, 11]
  ] as const)("gates %s level %s at estate level %s without charging early", async (type, targetLevel, required) => {
    const f = await fixture(500, required - 1);
    await db.update(farmBuildings).set({ type }).where(eq(farmBuildings.id, f.mill.id));
    if (targetLevel === 3) await db.update(farms).set({ production: { pending: {}, delivery: null, baking: {}, buildingUpgrades: {
      [f.mill.id]: [{ level: 2, startedAt: new Date(0).toISOString(), completesAt: new Date(1).toISOString(), idempotencyKey: randomUUID() }]
    } } }).where(eq(farms.id, f.farm.id));
    const input = { ...f.input, targetLevel };
    expect((await Effect.runPromise(Effect.flip(upgradeBuilding(db, input)))).message).toBe(`Unlock at estate level ${required}`);
    expect((await db.select().from(players).where(eq(players.id, f.playerId)))[0]!.shekelBalance).toBe(500);
    expect(await db.select().from(shekelTransactions).where(eq(shekelTransactions.playerId, f.playerId))).toHaveLength(0);
    await db.update(farms).set({ level: required }).where(eq(farms.id, f.farm.id));
    const upgraded = await Effect.runPromise(upgradeBuilding(db, input));
    expect(upgraded.player.shekelBalance).toBe(targetLevel === 2 ? 400 : 300);
    expect((await Effect.runPromise(upgradeBuilding(db, input))).player.shekelBalance).toBe(upgraded.player.shekelBalance);
  });

  it.each(["breadOven", "brewery"] as const)("blocks %s production during upgrading, preserves stock and uses completed levels", async type => {
    const f = await fixture(500, 11);
    await db.update(farmBuildings).set({ type, brewingWater: type === "brewery" ? 2 : 0, emptyBeerJars: type === "brewery" ? 2 : 0 }).where(eq(farmBuildings.id, f.mill.id));
    const itemKey = type === "breadOven" ? "flour" : "brewersGroats";
    await db.insert(farmInventory).values({ farmId: f.farm.id, itemKey, quantity: 10 });
    let snapshot = await Effect.runPromise(upgradeBuilding(db, f.input));
    const produce = (version: number) => type === "breadOven"
      ? productionAction(db, { type: "start_baking", playerId: f.playerId, buildingId: f.mill.id, expectedFarmVersion: version })
      : supplyBrewery(db, { type: "brewery_supply", action: "start_brewing", target: { column: 3, row: 3 }, playerId: f.playerId, expectedFarmVersion: version });
    // Normalize the error types for the shared test, not the production services.
    const run = (version: number) => Effect.runPromise(produce(version) as Effect.Effect<typeof snapshot, Error>);
    await expect(run(snapshot.farm.version)).rejects.toThrow("upgrading");
    expect((await db.select().from(farmInventory).where(eq(farmInventory.farmId, f.farm.id))).find(i => i.itemKey === itemKey)?.quantity).toBe(10);
    for (const level of [2, 3]) {
      const history = snapshot.farm.production.buildingUpgrades!;
      await db.update(farms).set({ production: { ...snapshot.farm.production, buildingUpgrades: {
        ...history, [f.mill.id]: history[f.mill.id]!.map(u => ({ ...u, startedAt: new Date(0).toISOString(), completesAt: new Date(1).toISOString() }))
      } } }).where(eq(farms.id, f.farm.id));
      snapshot = await run(snapshot.farm.version);
      const duration = (type === "breadOven" ? 300000 : 900000) * (level === 2 ? 0.85 : 0.7);
      if (type === "breadOven") {
        const job = snapshot.farm.production.baking[f.mill.id]!;
        expect(Date.parse(job.completesAt) - Date.parse(job.startedAt)).toBe(duration);
        expect(job.output).toBe(2);
      } else {
        const ready = Date.parse(snapshot.buildings.find(b => b.id === f.mill.id)!.beerReadyAt!);
        const job = snapshot.farm.production.brewing![f.mill.id]!;
        expect(ready).toBe(Date.parse(job.completesAt));
        expect(ready - Date.parse(job.startedAt)).toBe(duration);
      }
      expect(snapshot.inventory.find(i => i.itemKey === itemKey)?.quantity).toBe(level === 2 ? 8 : 6);
      expect((await Effect.runPromise(Effect.flip(upgradeBuilding(db, { ...f.input, targetLevel: level + 1, idempotencyKey: randomUUID(), expectedFarmVersion: snapshot.farm.version })))).message).toContain(type === "breadOven" ? "Finish baking" : "Finish brewing");
      if (level === 2) {
        // Simulate completed production before purchasing the next tier.
        await db.update(farms).set({ production: { ...snapshot.farm.production, baking: {}, brewing: {} } }).where(eq(farms.id, f.farm.id));
        if (type === "brewery") await db.update(farmBuildings).set({ beerReadyAt: null, brewingWater: 2, emptyBeerJars: 2 }).where(eq(farmBuildings.id, f.mill.id));
        snapshot = await Effect.runPromise(upgradeBuilding(db, { ...f.input, targetLevel: 3, idempotencyKey: randomUUID(), expectedFarmVersion: snapshot.farm.version }));
      }
    }
  });

  it("retains a purchased level-3 mill and its benefits at estate level 8", async () => {
    const f = await fixture();
    await db.update(farms).set({ production: { pending: {}, delivery: null, baking: {}, buildingUpgrades: {
      [f.mill.id]: [{ level: 3, startedAt: new Date(0).toISOString(), completesAt: new Date(1).toISOString(), idempotencyKey: randomUUID() }]
    } } }).where(eq(farms.id, f.farm.id));
    const working = await Effect.runPromise(startMilling(db, { type: "start_milling", playerId: f.playerId, recipe: "flour", worker: "farmer", target: { column: 3, row: 3 }, expectedFarmVersion: 1 }));
    expect(buildingLevel(working.farm.production.buildingUpgrades, f.mill.id, Date.now())).toBe(3);
    expect(Date.parse(working.farm.milling!.completesAt) - Date.parse(working.farm.milling!.startedAt)).toBe(210000);
  });
  it("charges once, preserves goods and rejects concurrent upgrades and mismatched retry keys", async () => {
    const f = await fixture();
    const snapshot = await Effect.runPromise(upgradeBuilding(db, f.input));
    expect(snapshot.player.shekelBalance).toBe(400);
    const entry = snapshot.farm.production.buildingUpgrades![f.mill.id]![0]!;
    expect(Date.parse(entry.completesAt) - Date.parse(entry.startedAt)).toBe(300000);
    expect(buildingLevel(snapshot.farm.production.buildingUpgrades, f.mill.id, Date.now())).toBe(1);
    expect(snapshot.inventory.find(i => i.itemKey === "barley")?.quantity).toBe(20);
    expect((await Effect.runPromise(upgradeBuilding(db, f.input))).player.shekelBalance).toBe(400);
    expect((await Effect.runPromise(Effect.flip(upgradeBuilding(db, { ...f.input, buildingId: randomUUID() }))))._tag).toBe("BuildingUpgradeRuleError");
    expect((await Effect.runPromise(Effect.flip(upgradeBuilding(db, { ...f.input, idempotencyKey: randomUUID(), expectedFarmVersion: snapshot.farm.version })))).message).toContain("current building upgrade");
    expect(await db.select().from(shekelTransactions).where(eq(shekelTransactions.playerId, f.playerId))).toHaveLength(1);
  });
  it.each(["farmer", "donkey"] as const)("blocks %s milling without consuming barley during upgrades", async worker => {
    const f = await fixture();
    const snapshot = await Effect.runPromise(upgradeBuilding(db, f.input));
    const result = await Effect.runPromise(Effect.flip(startMilling(db, { type: "start_milling", playerId: f.playerId, recipe: "flour", worker,
      target: { column: 3, row: 3 }, expectedFarmVersion: snapshot.farm.version })));
    expect(result.message).toContain("upgrading");
    const stock = await db.select().from(farmInventory).where(eq(farmInventory.farmId, f.farm.id));
    expect(stock.find(i => i.itemKey === "barley")?.quantity).toBe(20);
  });
  it.each(["farmer", "donkey"] as const)("applies level-2 timing to %s after offline completion and retains output", async worker => {
    const f = await fixture();
    await db.update(farms).set({ millGoods: { pending: { [f.mill.id]: { flour: 2, brewersGroats: 0 } }, delivery: null } }).where(eq(farms.id, f.farm.id));
    const upgraded = await Effect.runPromise(upgradeBuilding(db, f.input));
    expect(upgraded.farm.millGoods.pending[f.mill.id]?.flour).toBe(2);
    const history = upgraded.farm.production.buildingUpgrades!;
    await db.update(farms).set({ production: { ...upgraded.farm.production, buildingUpgrades: {
      ...history, [f.mill.id]: history[f.mill.id]!.map(u => ({ ...u, startedAt: new Date(Date.now() - 301000).toISOString(), completesAt: new Date(Date.now() - 1000).toISOString() }))
    } } }).where(eq(farms.id, f.farm.id));
    const working = await Effect.runPromise(startMilling(db, { type: "start_milling", playerId: f.playerId, recipe: "flour", worker,
      target: { column: 3, row: 3 }, expectedFarmVersion: upgraded.farm.version }));
    const job = working.farm.milling!;
    expect(Date.parse(job.completesAt) - Date.parse(job.startedAt)).toBe(worker === "farmer" ? 255000 : 765000);
    expect(job.output).toBe(worker === "farmer" ? 1 : 3);
    expect(working.farm.millGoods.pending[f.mill.id]?.flour).toBe(2);
    expect(working.player.shekelBalance).toBe(400);
    expect(await db.select().from(shekelTransactions).where(eq(shekelTransactions.playerId, f.playerId))).toHaveLength(1);
  });
  it.each([[99, 8], [500, 7]])("rejects unavailable funds or locked estate level (%s, %s)", async (balance, level) => {
    const f = await fixture(balance, level);
    expect((await Effect.runPromise(Effect.flip(upgradeBuilding(db, f.input))))._tag).toBe("BuildingUpgradeRuleError");
    expect((await db.select().from(players).where(eq(players.id, f.playerId)))[0]!.shekelBalance).toBe(balance);
  });
  it("rejects unfinished construction, level skipping, other buildings and another player's building", async () => {
    const f = await fixture();
    const other = await fixture();
    for (const input of [{ ...f.input, targetLevel: 3 }, { ...f.input, buildingId: other.mill.id }, { ...f.input, expectedFarmVersion: 999 }]) {
      expect((await Effect.runPromise(Effect.flip(upgradeBuilding(db, input))))._tag).toBe("BuildingUpgradeRuleError");
    }
    await db.update(farmBuildings).set({ completesAt: new Date(Date.now() + 60000) }).where(eq(farmBuildings.id, f.mill.id));
    expect((await Effect.runPromise(Effect.flip(upgradeBuilding(db, f.input)))).message).toContain("constructing");
    await db.update(farmBuildings).set({ type: "granary", completesAt: new Date(1) }).where(eq(farmBuildings.id, f.mill.id));
    expect((await Effect.runPromise(Effect.flip(upgradeBuilding(db, f.input)))).message).toContain("cannot be upgraded");
  });
  it("cannot upgrade a mill already producing", async () => {
    const f = await fixture();
    const working = await Effect.runPromise(startMilling(db, { type: "start_milling", playerId: f.playerId, recipe: "flour", worker: "donkey", target: { column: 3, row: 3 }, expectedFarmVersion: 1 }));
    expect((await Effect.runPromise(Effect.flip(upgradeBuilding(db, { ...f.input, expectedFarmVersion: working.farm.version })))).message).toContain("Finish milling");
  });
  it.each(["farmer", "donkey"] as const)("completes offline, charges 200 for level 3 and speeds up %s milling", async worker => {
    const f = await fixture(500, 10);
    let snapshot = await Effect.runPromise(upgradeBuilding(db, f.input));
    const finish = async () => {
      const upgrades = snapshot.farm.production.buildingUpgrades!;
      await db.update(farms).set({ production: { ...snapshot.farm.production, buildingUpgrades: { ...upgrades,
        [f.mill.id]: upgrades[f.mill.id]!.map(u => ({ ...u, startedAt: new Date(0).toISOString(), completesAt: new Date(1).toISOString() })) } } }).where(eq(farms.id, f.farm.id));
      snapshot = await db.transaction(async tx => {
        const [farm] = await tx.select().from(farms).where(eq(farms.id, f.farm.id)).for("update");
        return readFarmSnapshot(tx, farm!, false);
      });
    };
    await finish();
    expect(buildingLevel(snapshot.farm.production.buildingUpgrades, f.mill.id, Date.now())).toBe(2);
    snapshot = await Effect.runPromise(upgradeBuilding(db, { ...f.input, targetLevel: 3, idempotencyKey: randomUUID(), expectedFarmVersion: snapshot.farm.version }));
    expect(snapshot.player.shekelBalance).toBe(200);
    await finish();
    expect(buildingLevel(snapshot.farm.production.buildingUpgrades, f.mill.id, Date.now())).toBe(3);
    expect((await Effect.runPromise(Effect.flip(upgradeBuilding(db, { ...f.input, targetLevel: 4, idempotencyKey: randomUUID(), expectedFarmVersion: snapshot.farm.version })))).message).toContain("Maximum");
    const working = await Effect.runPromise(startMilling(db, { type: "start_milling", playerId: f.playerId, recipe: "brewersGroats", worker, target: { column: 3, row: 3 }, expectedFarmVersion: snapshot.farm.version }));
    const job = working.farm.milling!;
    expect(Date.parse(job.completesAt) - Date.parse(job.startedAt)).toBe(worker === "farmer" ? 210000 : 630000);
    expect(job.barley).toBe(worker === "farmer" ? 2 : 6);
    expect(job.output).toBe(worker === "farmer" ? 1 : 3);
  });
});
