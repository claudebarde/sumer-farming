import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { Effect } from "effect";
import { eq, inArray } from "drizzle-orm";
import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import { createDatabase } from "../../src/server/db/client";
import { players, farms, neighbourhoods, neighbourhoodMembers, marketPresence } from "../../src/server/db/schema";
import { updateMarketPresence } from "../../src/server/services/marketPresence";
import { MARKET_PRESENCE_TTL_MS, type MarketPresenceCommand } from "../../src/schemas/marketPresence";

const client = new Client({ connectionString: process.env.TEST_DATABASE_URL ?? "postgres://sumer:sumer_dev@localhost:5432/sumer_farming" });
const db = createDatabase(client);
const ids = Array.from({ length: 5 }, () => randomUUID());
const homes = [randomUUID(), randomUUID()];
const sessions = ids.map(() => randomUUID());
const position = { column: 0, row: 5 };
const run = (i: number, command: MarketPresenceCommand) => Effect.runPromise(updateMarketPresence(db, ids[i]!, command));
const join = (i: number) => run(i, { type: "join", sessionId: sessions[i]!, position });
const heartbeat = (i: number) => run(i, { type: "heartbeat", sessionId: sessions[i]!, position });
beforeAll(async () => {
  await client.connect();
  for (const id of homes) await db.insert(neighbourhoods).values({ id, city: "lagash", name: "Presence test", private: true });
  for (const [i, id] of ids.entries()) {
    await db.insert(players).values({ id, displayName: "Presence test" });
    await db.insert(farms).values({ playerId: id, level: i === 3 ? 9 : 10,
      farmerProfile: i === 4 ? null : { version: 1, identity: { name: "Gudea" } } });
    await db.insert(neighbourhoodMembers).values({ playerId: id, neighbourhoodId: homes[i === 2 ? 1 : 0]!, slot: i + 1 });
  }
});
beforeEach(async () => { await db.delete(marketPresence).where(inArray(marketPresence.playerId, ids)); });
afterAll(async () => {
  await db.delete(players).where(inArray(players.id, ids));
  await db.delete(neighbourhoods).where(inArray(neighbourhoods.id, homes));
  await client.end();
});
describe.sequential("live market presence", () => {
  it("enforces level 10 on both the observer and every returned visitor", async () => {
    await join(0); await join(1);
    await db.update(farms).set({ level: 9 }).where(eq(farms.playerId, ids[1]!));
    try {
      expect(await heartbeat(0)).toEqual({ type: "ok", visitors: [] });
      expect((await heartbeat(1)).type).toBe("rejected");
      expect((await join(3)).type).toBe("rejected");
    } finally { await db.update(farms).set({ level: 10 }).where(eq(farms.playerId, ids[1]!)); }
  });
  it("shares fractional positions on the isometric road loop", async () => {
    await join(0); await join(1);
    const position = { column: 9, row: 8.5 };
    await run(1, { type: "heartbeat", sessionId: sessions[1]!, position });
    expect(await heartbeat(0)).toMatchObject({ visitors: [{ playerId: ids[1], position }] });
    expect((await run(1, { type: "heartbeat", sessionId: sessions[1]!, position: { column: 5, row: 8.5 } })).type).toBe("rejected");
  });
  it("shows actual visitors only in the same neighbourhood, excludes self, and preserves farm state", async () => {
    await join(0); await join(1); await join(2);
    expect(await heartbeat(0)).toEqual({ type: "ok", visitors: [{ playerId: ids[1], name: "Gudea", position }] });
    expect(await heartbeat(2)).toEqual({ type: "ok", visitors: [] });
    expect((await db.select().from(farms).where(eq(farms.playerId, ids[0]!)))[0]).toMatchObject({ version: 1, level: 10 });
  });
  it("removes departed visitors and rejects late join or heartbeat resurrection", async () => {
    await join(0); await join(1);
    await run(1, { type: "leave", sessionId: sessions[1]! });
    expect((await join(1)).type).toBe("rejected");
    expect((await heartbeat(1)).type).toBe("rejected");
    expect(await heartbeat(0)).toEqual({ type: "ok", visitors: [] });
  });
  it("handles a leave arriving before its join", async () => {
    await run(0, { type: "leave", sessionId: sessions[0]! });
    expect((await join(0)).type).toBe("rejected");
  });
  it("expires disconnected visitors using server timestamps", async () => {
    await join(0); await join(1);
    await db.update(marketPresence).set({ seenAt: new Date(Date.now() - MARKET_PRESENCE_TTL_MS - 100) }).where(eq(marketPresence.playerId, ids[1]!));
    expect(await heartbeat(0)).toEqual({ type: "ok", visitors: [] });
    await heartbeat(1);
    expect((await heartbeat(0))).toMatchObject({ visitors: [{ playerId: ids[1] }] });
  });
  it("deduplicates tabs and an older tab cannot remove a newer visit", async () => {
    await join(0); await join(1);
    const next = randomUUID();
    const nextPosition = { column: 1.5, row: 5 };
    await run(1, { type: "join", sessionId: next, position: nextPosition });
    expect(await heartbeat(0)).toEqual({ type: "ok", visitors: [{ playerId: ids[1], name: "Gudea", position: nextPosition }] });
    await run(1, { type: "leave", sessionId: sessions[1]! });
    expect(await heartbeat(0)).toEqual({ type: "ok", visitors: [{ playerId: ids[1], name: "Gudea", position: nextPosition }] });
  });
  it("rejects unqualified players, unknown sessions and off-road positions", async () => {
    expect((await join(3)).type).toBe("rejected");
    expect((await join(4)).type).toBe("rejected");
    expect((await heartbeat(0)).type).toBe("rejected");
    expect((await run(0, { type: "join", sessionId: sessions[0]!, position: { column: 1, row: 6 } })).type).toBe("rejected");
  });
});
