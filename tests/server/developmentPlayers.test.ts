import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { Effect } from "effect";
import { Client } from "pg";
import { afterAll, beforeAll, expect, it } from "vitest";
import { resolveDevelopmentPlayer } from "../../src/game-data/developmentPlayers";
import { createDatabase } from "../../src/server/db/client";
import { players, farmGroundItems } from "../../src/server/db/schema";
import { ensureDevelopmentFarm } from "../../src/server/services/initialFarm";
import { CROP_DEFINITIONS } from "../../src/game-data/crops";

const client = new Client({ connectionString: process.env.TEST_DATABASE_URL ?? "postgres://sumer:sumer_dev@localhost:5432/sumer_farming" });
const db = createDatabase(client);
const first = { id: randomUUID(), key: "primary", displayName: "Identity test 1" } as const;
const second = { id: randomUUID(), key: "second", displayName: "Identity test 2" } as const;
beforeAll(() => client.connect());
afterAll(async () => {
  for (const player of [first, second]) await db.delete(players).where(eq(players.id, player.id));
  await client.end();
});

it("allowlists test identities and rejects arbitrary identifiers", () => {
  expect(resolveDevelopmentPlayer(undefined)?.key).toBe("primary");
  expect(resolveDevelopmentPlayer("second")?.key).toBe("second");
  expect(resolveDevelopmentPlayer(randomUUID())).toBeUndefined();
});

it("creates independent farms and never restores fixture money on refresh", async () => {
  const a = await Effect.runPromise(ensureDevelopmentFarm(db, 1, first));
  const b = await Effect.runPromise(ensureDevelopmentFarm(db, 2, second));
  expect(a.farm.id).not.toBe(b.farm.id);
  expect(a.inventory).toHaveLength(0);
  expect(a.crops).toHaveLength(0);
  expect(a.groundItems.map(({ itemKey, quantity, column, row }) => ({ itemKey, quantity, column, row }))).toEqual([
    { itemKey: "barley", quantity: 1, column: 2, row: 0 },
    { itemKey: "barley", quantity: 1, column: 2, row: 1 }
  ]);
  expect(CROP_DEFINITIONS.barley.growthDurationMs).toBe(30 * 60_000);
  expect(b.inventory).toContainEqual({ itemKey: "barley", quantity: 2 });
  await db.update(players).set({ shekelBalance: 7 }).where(eq(players.id, second.id));
  const reloaded = await Effect.runPromise(ensureDevelopmentFarm(db, 999, second));
  expect(reloaded.farm.id).toBe(b.farm.id);
  expect(reloaded.objects).toEqual(b.objects);
  expect(reloaded.crops).toEqual(b.crops);
  expect(reloaded.groundItems).toEqual(b.groundItems);
  const [record] = await db.select().from(players).where(eq(players.id, second.id));
  expect(record?.shekelBalance).toBe(7);
});

it("does not recreate removed starter bundles on reload", async () => {
  const player = { id: randomUUID(), key: "primary", displayName: "Starter bundles test" } as const;
  try {
    const initial = await Effect.runPromise(ensureDevelopmentFarm(db, 42, player));
    await db.delete(farmGroundItems).where(eq(farmGroundItems.farmId, initial.farm.id));
    const reloaded = await Effect.runPromise(ensureDevelopmentFarm(db, 43, player));
    expect(reloaded.crops).toHaveLength(0);
    expect(reloaded.groundItems).toHaveLength(0);
  } finally {
    await db.delete(players).where(eq(players.id, player.id));
  }
});
