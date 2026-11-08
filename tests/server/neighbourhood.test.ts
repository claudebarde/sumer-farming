import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { eq, inArray } from "drizzle-orm";
import { beforeAll, afterAll, expect, it } from "vitest";
import { createDatabase } from "../../src/server/db/client";
import { players, farms, neighbourhoods, neighbourhoodMembers } from "../../src/server/db/schema";
import { readNeighbourhood } from "../../src/server/services/neighbourhood";

const client = new Client({ connectionString: process.env.TEST_DATABASE_URL ?? "postgres://sumer:sumer_dev@localhost:5432/sumer_farming" });
const db = createDatabase(client);
const ids = Array.from({ length: 4 }, () => randomUUID());
const homes = [randomUUID(), randomUUID()];
beforeAll(async () => {
  await client.connect();
  for (const id of homes) await db.insert(neighbourhoods).values({ id, city: "lagash", name: "Roster test", private: true });
  for (const [i, id] of ids.entries()) {
    await db.insert(players).values({ id, displayName: "Private account name" });
    await db.insert(farms).values({ playerId: id, level: i === 2 ? 3 : 7,
      farmerProfile: i === 2 ? null : { version: 1, identity: { name: `Farmer ${i}` } } });
    await db.insert(neighbourhoodMembers).values({ playerId: id, neighbourhoodId: homes[i === 3 ? 1 : 0]!, slot: [6, 2, 9, 1][i]! });
  }
});
afterAll(async () => {
  await db.delete(players).where(inArray(players.id, ids));
  await db.delete(neighbourhoods).where(inArray(neighbourhoods.id, homes));
  await client.end();
});
it("returns only real members of the viewer's home, including offline and lower-level farms", async () => {
  expect(await readNeighbourhood(db, ids[0]!)).toEqual({ members: [
    { homeStyle: "farm-level-9", wallTablet: "none", slot: 2, name: "Farmer 1", level: 7, isYou: false },
    { homeStyle: "farm-level-9", wallTablet: "none", slot: 6, name: "Farmer 0", level: 7, isYou: true },
    { homeStyle: "farm-level-9", wallTablet: "none", slot: 9, name: "Farmer", level: 3, isYou: false },
  ] });
});
it("keeps positions consistent for another viewer without changing membership", async () => {
  const before = await db.select().from(neighbourhoodMembers).where(inArray(neighbourhoodMembers.playerId, ids));
  const result = await readNeighbourhood(db, ids[1]!);
  expect(result?.members.map(m => m.slot)).toEqual([2, 6, 9]);
  expect(result?.members.find(m => m.isYou)?.slot).toBe(2);
  expect(await db.select().from(neighbourhoodMembers).where(inArray(neighbourhoodMembers.playerId, ids))).toEqual(before);
});
it("rejects locked and unknown viewers", async () => {
  expect(await readNeighbourhood(db, ids[2]!)).toBeNull();
  expect(await readNeighbourhood(db, randomUUID())).toBeNull();
});

it.each(["home-tablet-barley", "home-tablet-sky", "home-tablet-beer", "home-tablet-cook", "none"] as const)("shares the saved house style and %s tablet with other neighbours", async wallTablet => {
  await db.update(farms).set({ level: 9, homeAppearance: { style: "farm-style-clay", decoration: "none", wallTablet } }).where(eq(farms.playerId, ids[0]!));
  const roster = await readNeighbourhood(db, ids[1]!);
  expect(roster?.members.find(member => member.slot === 6)).toMatchObject({ homeStyle: "farm-style-clay", wallTablet });
});
