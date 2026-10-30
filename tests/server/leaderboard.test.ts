import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { Effect } from "effect";
import { eq, inArray } from "drizzle-orm";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { createDatabase } from "../../src/server/db/client";
import { players, farms, neighbourhoods, neighbourhoodMembers, zigguratDonations } from "../../src/server/db/schema";
import { readLeaderboard } from "../../src/server/services/leaderboard";
import { INITIAL_PROGRESSION_STATS } from "../../src/game-data/progression";
import type { LeaderboardQuery } from "../../src/schemas/leaderboard";

const client = new Client({ connectionString: process.env.TEST_DATABASE_URL ?? "postgres://sumer:sumer_dev@localhost:5432/sumer_farming" });
const db = createDatabase(client);
const ids = Array.from({ length: 13 }, () => randomUUID());
const homes = [randomUUID(), randomUUID()];
const run = (index = 0, query: LeaderboardQuery = { scope: "local", metric: "shekels" }) => Effect.runPromise(readLeaderboard(db, ids[index]!, query));
beforeAll(async () => {
  await client.connect();
  for (const [i, id] of homes.entries()) await db.insert(neighbourhoods).values({ id, city: i ? "ur" : "lagash", name: `Leaderboard test ${i}`, private: true });
  for (const [i, id] of ids.entries()) {
    await db.insert(players).values({ id, displayName: "Private account name", shekelBalance: i === 2 ? 1 : i });
    await db.insert(farms).values({ playerId: id, level: i === 12 ? 1 : 3,
      farmerProfile: i === 11 ? null : { version: 1, identity: { name: "Gudea" } },
      progressionStats: { ...INITIAL_PROGRESSION_STATS, harvestedBarley: 100 - i } });
    await db.insert(neighbourhoodMembers).values({ playerId: id, neighbourhoodId: homes[i < 10 ? 0 : 1]!, slot: i % 10 + 1 });
  }
});
afterAll(async () => {
  await db.delete(players).where(inArray(players.id, ids));
  await db.delete(neighbourhoods).where(inArray(neighbourhoods.id, homes));
  await client.end();
});
describe.sequential("leaderboard", () => {
  it("scopes local rankings, shares tied ranks and preserves deterministic order", async () => {
    const a = await run(); const b = await run();
    if (a.type !== "ok" || b.type !== "ok") throw new Error("Expected leaderboard");
    expect(a.leaderboard.total).toBe(10);
    expect(a.leaderboard.entries).toHaveLength(10);
    expect(a.leaderboard.entries[0]).toMatchObject({ playerId: ids[9], score: 9, rank: 1, city: "lagash" });
    expect(a.leaderboard.entries.filter(row => row.score === 1).map(row => row.rank)).toEqual([8, 8]);
    expect(a.leaderboard.entries).toEqual(b.leaderboard.entries);
    expect(a.leaderboard.self).toMatchObject({ playerId: ids[0], rank: 10, isYou: true });
    expect(JSON.stringify(a)).not.toContain("Private account name");
    expect(JSON.stringify(a)).not.toContain("inviteCode");
  });
  it("caps global results and includes own rank outside top ten; omits unnamed farms", async () => {
    const r = await run(0, { scope: "global", metric: "shekels" });
    if (r.type !== "ok") throw new Error("Expected leaderboard");
    expect(r.leaderboard.entries).toHaveLength(10);
    expect(r.leaderboard.total).toBeGreaterThanOrEqual(12);
    expect(r.leaderboard.entries.some(row => row.playerId === ids[0] || row.playerId === ids[11])).toBe(false);
    expect(r.leaderboard.self!.rank).toBeGreaterThan(10);
    expect(r.leaderboard.self).toMatchObject({ isYou: true, score: 0 });
  });
  it("supports level and lifetime harvesting without mutating farms", async () => {
    const [before] = await db.select().from(farms).where(eq(farms.playerId, ids[0]!));
    const level = await run(0, { scope: "local", metric: "level" });
    const harvest = await run(0, { scope: "local", metric: "harvestedBarley" });
    if (level.type !== "ok" || harvest.type !== "ok") throw new Error("Expected leaderboard");
    expect(level.leaderboard.entries.every(row => row.rank === 1 && row.score === 3)).toBe(true);
    expect(harvest.leaderboard.entries[0]).toMatchObject({ playerId: ids[0], score: 100, rank: 1 });
    expect((await db.select().from(farms).where(eq(farms.playerId, ids[0]!)))[0]).toEqual(before);
  });
  it("rejects unnamed, locked and unknown viewers", async () => {
    expect((await run(11)).type).toBe("rejected");
    expect((await run(12)).type).toBe("rejected");
    expect((await Effect.runPromise(readLeaderboard(db, randomUUID(), { scope: "global", metric: "level" }))).type).toBe("rejected");
  });
});

it("ranks saved ziggurat donations across stages, preserves departed contributors and isolates neighbourhoods", async () => {
  await db.update(farms).set({level:7}).where(eq(farms.playerId,ids[0]!));
  const empty = await run(0,{scope:"local",metric:"ziggurat"});
  if(empty.type!=="ok")throw new Error("Expected neighbours");
  expect(empty.leaderboard.entries).toHaveLength(10);
  expect(empty.leaderboard.entries.every(entry=>entry.score===0)).toBe(true);
  for (const [index,stage,clay] of [[1,0,3],[1,1,2],[2,0,5],[3,0,1],[10,0,20]] as const) {
    await db.insert(zigguratDonations).values({neighbourhoodId:homes[index===10?1:0]!,playerId:ids[index]!,idempotencyKey:randomUUID(),stage,requestedClay:clay,requestedReed:0,clay,reed:0,points:clay*2});
  }
  await db.update(farms).set({farmerProfile:{version:1,identity:{name:"Zababa"}}}).where(eq(farms.playerId,ids[1]!));
  await db.update(farms).set({farmerProfile:{version:1,identity:{name:"Abala"}}}).where(eq(farms.playerId,ids[2]!));
  const query = {scope:"local",metric:"ziggurat"} as const;
  const result = await run(0,query);
  if(result.type!=="ok")throw new Error("Expected ranking");
  expect(result.leaderboard.entries.slice(0,2).map(entry=>entry.name)).toEqual(["Abala","Zababa"]);
  expect(result.leaderboard.total).toBe(10);
  expect(result.leaderboard.self).toMatchObject({playerId:ids[0],score:0});
  expect(result.leaderboard.entries.filter(e=>e.score>0).map(e=>[e.rank,e.score])).toEqual([[1,10],[1,10],[3,2]]);
  expect(result.leaderboard.entries.some(e=>e.playerId===ids[10])).toBe(false);
  await db.update(neighbourhoodMembers).set({neighbourhoodId:homes[1],slot:10}).where(eq(neighbourhoodMembers.playerId,ids[1]!));
  expect(await run(0,query)).toMatchObject({type:"ok",leaderboard:{entries:result.leaderboard.entries}});
  expect((await run(0,{scope:"global",metric:"ziggurat"})).type).toBe("rejected");
  await db.update(farms).set({level:6}).where(eq(farms.playerId,ids[0]!));
  expect((await run(0,query)).type).toBe("rejected");
});
