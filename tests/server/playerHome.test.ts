import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import { createDatabase } from "../../src/server/db/client";
import { farms, players } from "../../src/server/db/schema";
import { readPlayerHome, saveHomeVisibility } from "../../src/server/services/playerHome";
import { saveHomeAppearance, saveHomeFurniture } from "../../src/server/services/homeAppearance";
const client = new Client({ connectionString: process.env.TEST_DATABASE_URL ?? "postgres://sumer:sumer_dev@localhost:5432/sumer_farming" });
const db = createDatabase(client), ids: string[] = [];
beforeAll(() => client.connect());
afterEach(async () => { if (ids.length) await db.delete(players).where(inArray(players.id, ids)); ids.length = 0; });
afterAll(() => client.end());
const setup = async (level = 10) => {
  const id = randomUUID(); ids.push(id);
  await db.insert(players).values({ id, displayName: "Visit test" });
  await db.insert(farms).values({ playerId: id, level, farmerProfile: { version: 1, identity: { name: "Gudea" } } });
  return id;
};
it("serves offline homes to unrelated level-ten players without exposing farm state", async () => {
  const owner = await setup(), visitor = await setup();
  await saveHomeFurniture(db, owner, { revision: 0, items: [{ key: "wooden-stool", x: 850, y: 700 }] });
  const response = await readPlayerHome(db, visitor, owner, true);
  expect(response.ok).toBe(true);
  if (response.ok && "appearance" in response.data) {
    expect(response.data.appearance.furniture).toHaveLength(1);
    expect(Object.keys(response.data)).toEqual(["profile", "appearance"]);
  } else throw new Error("Missing interior");
});
it("enforces both levels and privacy on every request, even after a successful visit", async () => {
  const owner = await setup(), visitor = await setup(), low = await setup(9);
  expect((await readPlayerHome(db, low, owner, true)).ok).toBe(false);
  expect((await readPlayerHome(db, visitor, low, true)).ok).toBe(false);
  expect((await saveHomeVisibility(db, low, "private")).ok).toBe(false);
  expect((await readPlayerHome(db, visitor, owner, true)).ok).toBe(true);
  expect((await saveHomeVisibility(db, owner, "private")).ok).toBe(true);
  expect((await readPlayerHome(db, visitor, owner, true)).ok).toBe(false);
  const profile = await readPlayerHome(db, visitor, owner, false);
  expect(profile.ok).toBe(true);
  if (profile.ok && "canVisit" in profile.data) expect(profile.data.canVisit).toBe(false);
  expect((await readPlayerHome(db, owner, owner, true)).ok).toBe(true);
  await saveHomeVisibility(db, owner, "everyone");
  expect((await readPlayerHome(db, visitor, owner, true)).ok).toBe(true);
});
it("keeps privacy independent of furniture and stale appearance writes", async () => {
  const owner = await setup(), visitor = await setup();
  await saveHomeVisibility(db, owner, "private");
  await saveHomeAppearance(db, owner, { style: "farm-style-clay", decoration: "none", visibility: "everyone" });
  await saveHomeFurniture(db, owner, { revision: 0, items: [{ key: "wooden-stool", x: 850, y: 700 }] });
  const [saved] = await db.select().from(farms).where(eq(farms.playerId, owner));
  expect(saved!.homeAppearance.visibility).toBe("private");
  expect(saved!.homeAppearance.furniture).toHaveLength(1);
  const [other] = await db.select().from(farms).where(eq(farms.playerId, visitor));
  expect(other!.homeAppearance.visibility).toBeUndefined();
  expect((await readPlayerHome(db, visitor, randomUUID(), true)).ok).toBe(false);
});
