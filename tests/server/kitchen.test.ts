import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { Effect } from "effect";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import { createDatabase } from "../../src/server/db/client";
import { farmGroundItems, farms, players, pointAwards } from "../../src/server/db/schema";
import { buildFarmBuilding } from "../../src/server/services/buildFarmBuilding";
import { advanceFarmLifecycle } from "../../src/server/services/farmLifecycle";
import { readFarmSnapshot } from "../../src/server/services/farmSnapshot";
import { activeConstruction } from "../../src/client/game/phaser/isometricConstruction";
import { buildingDemolitionReason } from "../../src/game-core/farm/buildingDemolition";

const client = new Client({ connectionString: process.env.TEST_DATABASE_URL ?? "postgres://sumer:sumer_dev@localhost:5432/sumer_farming" });
const db = createDatabase(client), ids: string[] = [];
beforeAll(() => client.connect());
afterEach(async () => { if (ids.length) await db.delete(players).where(inArray(players.id, ids)); ids.length = 0; });
afterAll(() => client.end());

it("saves a kitchen and its road access, consumes materials once, and completes offline", async () => {
  const playerId = randomUUID(); ids.push(playerId);
  await db.insert(players).values({ id: playerId, displayName: "Kitchen test" });
  const [farm] = await db.insert(farms).values({ playerId, level: 11 }).returning();
  await db.insert(farmGroundItems).values([
    { farmId: farm!.id, itemKey: "reed", quantity: 2, column: 5, row: 0 },
    { farmId: farm!.id, itemKey: "clay", quantity: 4, column: 6, row: 0 }
  ]);
  const input = { playerId, building: "kitchen" as const, target: { column: -1, row: 6 }, expectedFarmVersion: 1 };
  const started = await Effect.runPromise(buildFarmBuilding(db, input));
  const kitchen = started.buildings[0]!;
  expect(kitchen).toMatchObject({ type: "kitchen", ...input.target, loadingTile: { column: -1, row: 5 } });
  expect(Date.parse(kitchen.completesAt) - Date.parse(kitchen.startedAt)).toBe(120000);
  expect(started.groundItems).toHaveLength(0);
  expect(activeConstruction(started, Date.parse(kitchen.startedAt) + 1000)?.workPosition).toEqual(kitchen.loadingTile);
  expect(buildingDemolitionReason(started, kitchen.id, Date.parse(kitchen.startedAt))).toBe("Finish construction or upgrading first.");
  await expect(Effect.runPromise(buildFarmBuilding(db, input))).rejects.toThrow();
  const read = (now?: number) => db.transaction(async tx => {
    const [saved] = await tx.select().from(farms).where(eq(farms.id, farm!.id)).for("update");
    const advanced = now === undefined ? saved! : await advanceFarmLifecycle(tx, saved!, new Date(now));
    return readFarmSnapshot(tx, advanced, false);
  });
  expect((await read()).buildings[0]).toEqual(kitchen);
  const later = Date.parse(kitchen.completesAt) + 1000;
  const completed = await read(later);
  expect(activeConstruction(completed, later)).toBeNull();
  expect(buildingDemolitionReason(completed, kitchen.id, later)).toBeNull();
  expect(completed.groundItems).toHaveLength(0);
  await read(later + 1000);
  const awards = await db.select().from(pointAwards).where(eq(pointAwards.playerId, playerId));
  expect(awards.filter(a => a.source === "building:kitchen")).toHaveLength(1);
  expect(await Effect.runPromise(Effect.flip(buildFarmBuilding(db, { ...input, target: { column: 7, row: 4 }, expectedFarmVersion: completed.farm.version })))).toMatchObject({ rule: { type: "building_limit", limit: 1 } });
});
