import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Client } from "pg";
import { Effect } from "effect";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { createDatabase } from "../../src/server/db/client";
import { chooseResidence, readResidence } from "../../src/server/services/residence";
import { ResidenceCommandSchema } from "../../src/schemas/residence";

const connectionString = process.env.TEST_DATABASE_URL ?? "postgres://sumer:sumer_dev@localhost:5432/sumer_farming";
const schema = `residence_test_${randomUUID().replaceAll("-", "")}`;
const client = new Client({ connectionString });
const db = createDatabase(client);
const createPlayer = async () => {
  const id = randomUUID();
  await client.query("INSERT INTO players(id) VALUES ($1)", [id]);
  return id;
};
beforeAll(async () => {
  await client.connect();
  await client.query(`CREATE SCHEMA ${schema}`);
  await client.query(`SET search_path TO ${schema}`);
  await client.query("CREATE TABLE players(id uuid PRIMARY KEY)");
  await client.query(await readFile("drizzle/0048_city-residence.sql", "utf8"));
});
afterAll(async () => {
  await client.query(`DROP SCHEMA ${schema} CASCADE`);
  await client.end();
});

describe.sequential("persistent city onboarding", () => {
  it("rejects unknown cities and the retired founding and invitation commands", () => {
    expect(ResidenceCommandSchema.safeParse({ type: "settle", city: "unknown" }).success).toBe(false);
    expect(ResidenceCommandSchema.safeParse({ type: "found", city: "ur", name: "Friends", private: true }).success).toBe(false);
    expect(ResidenceCommandSchema.safeParse({ type: "join", city: "ur", inviteCode: randomUUID() }).success).toBe(false);
  });
  it("leaves new players unassigned, persists a choice and prevents relocation", async () => {
    const id = await createPlayer();
    expect(await readResidence(db, id)).toBeNull();
    const first = await Effect.runPromise(chooseResidence(db, id, { type: "settle", city: "ur" }));
    expect(first.type).toBe("ok");
    expect(await readResidence(db, id)).toMatchObject({ city: "ur", members: 1 });
    expect(await Effect.runPromise(chooseResidence(db, id, { type: "settle", city: "ur" }))).toEqual(first);
    expect((await Effect.runPromise(chooseResidence(db, id, { type: "settle", city: "lagash" }))).type).toBe("rejected");
  });
  it("preserves legacy private membership but excludes it from automatic placement", async () => {
    const founder = await createPlayer();
    const automatic = await createPlayer();
    const group = randomUUID();
    await client.query("INSERT INTO neighbourhoods(id, city, name, private) VALUES ($1, 'lagash', 'Legacy friends', true)", [group]);
    await client.query("INSERT INTO neighbourhood_members(player_id, neighbourhood_id, slot) VALUES ($1, $2, 1)", [founder, group]);
    expect(await Effect.runPromise(chooseResidence(db, founder, { type: "settle", city: "lagash" }))).toMatchObject({ type: "ok", residence: { neighbourhoodId: group, private: true } });
    const assigned = await Effect.runPromise(chooseResidence(db, automatic, { type: "settle", city: "lagash" }));
    expect(assigned).toMatchObject({ type: "ok", residence: { private: false, members: 1 } });
  });
  it("serializes concurrent assignments, fills ten seats and overflows to another group", async () => {
    const ids: string[] = [];
    for (let i = 0; i < 12; i++) ids.push(await createPlayer());
    await Promise.all(ids.map(async id => {
      const connection = new Client({ connectionString });
      await connection.connect();
      try {
        await connection.query(`SET search_path TO ${schema}`);
        expect((await Effect.runPromise(chooseResidence(createDatabase(connection), id, { type: "settle", city: "eridu" }))).type).toBe("ok");
      } finally { await connection.end(); }
    }));
    const counts = (await client.query("SELECT count(*)::int AS count FROM neighbourhood_members m JOIN neighbourhoods n ON n.id=m.neighbourhood_id WHERE n.city='eridu' GROUP BY n.id ORDER BY count DESC")).rows;
    expect(counts).toEqual([{ count: 10 }, { count: 2 }]);
  });
});
