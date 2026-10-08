import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { Effect } from "effect";
import { eq, inArray } from "drizzle-orm";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { createDatabase } from "../../src/server/db/client";
import { players, farms } from "../../src/server/db/schema";
import { nameFarmer } from "../../src/server/services/farmerProfile";

const connectionString = process.env.TEST_DATABASE_URL ?? "postgres://sumer:sumer_dev@localhost:5432/sumer_farming";
const client = new Client({ connectionString });
const db = createDatabase(client);
const ids = [randomUUID(), randomUUID()];
beforeAll(async () => {
  await client.connect();
  for (const id of ids) {
    await db.insert(players).values({ id, displayName: "Profile test" });
    await db.insert(farms).values({ playerId: id });
  }
});
afterAll(async () => { await db.delete(players).where(inArray(players.id, ids)); await client.end(); });
describe.sequential("farmer profile persistence", () => {
  it("saves a name without changing account identity, money, or farm progress", async () => {
    const result = await Effect.runPromise(nameFarmer(db, ids[0]!, "Meskalamdug"));
    expect(result).toEqual({ type: "ok", profile: { version: 1, identity: { name: "Meskalamdug" } } });
    const [farm] = await db.select().from(farms).where(eq(farms.playerId, ids[0]!));
    expect(farm).toMatchObject({ version: 2, level: 1, happiness: 70, farmerProfile: { identity: { name: "Meskalamdug" } } });
    const [player] = await db.select().from(players).where(eq(players.id, ids[0]!));
    expect(player).toMatchObject({ displayName: "Profile test", shekelBalance: 0 });
    expect((await Effect.runPromise(nameFarmer(db, ids[0]!, "Meskalamdug"))).type).toBe("ok");
    expect((await db.select().from(farms).where(eq(farms.playerId, ids[0]!)))[0]!.version).toBe(2);
    expect((await Effect.runPromise(nameFarmer(db, ids[0]!, "Gudea"))).type).toBe("rejected");
  });
  it("rejects invalid names without saving a partial profile", async () => {
    expect((await Effect.runPromise(nameFarmer(db, ids[1]!, "invalid"))).type).toBe("rejected");
    expect((await db.select().from(farms).where(eq(farms.playerId, ids[1]!)))[0]!.farmerProfile).toBeNull();
  });
  it("serializes simultaneous conflicting name choices", async () => {
    const results = await Promise.all(["Geme-Bau", "Ninkalla"].map(async name => {
      const connection = new Client({ connectionString }); await connection.connect();
      try { return await Effect.runPromise(nameFarmer(createDatabase(connection), ids[1]!, name)); }
      finally { await connection.end(); }
    }));
    expect(results.filter(result => result.type === "ok")).toHaveLength(1);
    expect(results.filter(result => result.type === "rejected")).toHaveLength(1);
  });
});
