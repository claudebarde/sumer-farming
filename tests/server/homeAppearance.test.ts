import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import { createDatabase } from "../../src/server/db/client";
import { farms, players } from "../../src/server/db/schema";
import { saveHomeAppearance, saveHomeFurniture } from "../../src/server/services/homeAppearance";
import { readFarmSnapshot } from "../../src/server/services/farmSnapshot";
import { FarmSnapshotSchema } from "../../src/schemas/farm";
import { farmRenderKey } from "../../src/client/game/phaser/farmRenderState";
const client = new Client({ connectionString: process.env.TEST_DATABASE_URL ?? "postgres://sumer:sumer_dev@localhost:5432/sumer_farming" });
const db = createDatabase(client), ids: string[] = [];
beforeAll(() => client.connect());
afterEach(async () => { if (ids.length) await db.delete(players).where(inArray(players.id, ids)); ids.length = 0; });
afterAll(() => client.end());
const setup = async (level = 9) => {
 const playerId = randomUUID(); ids.push(playerId);
 await db.insert(players).values({ id: playerId, displayName: "Home test" });
 await db.insert(farms).values({ playerId, level });
 return playerId;
};
it.each(["home-tablet-sky", "home-tablet-beer", "home-tablet-cook"] as const)("persists %s across independent reads without changing another player's home", async wallTablet => {
 const playerId = await setup(), otherId = await setup();
 const selected = { style: "farm-style-reeds", decoration: "home-mat", wallTablet } as const;
 const result = await saveHomeAppearance(db, playerId, selected);
 expect(result.ok).toBe(true);
 const [saved] = await db.select().from(farms).where(eq(farms.playerId, playerId));
 const snapshot = FarmSnapshotSchema.parse(await readFarmSnapshot(db, saved!, false));
 expect(snapshot.farm.homeAppearance).toEqual(selected);
 const [other] = await db.select().from(farms).where(eq(farms.playerId, otherId));
 expect(other!.homeAppearance).toEqual({ style: "farm-level-9", decoration: "none" });
 const previous = { ...snapshot, farm: { ...snapshot.farm, homeAppearance: other!.homeAppearance } };
 expect(farmRenderKey(snapshot, Date.now())).not.toEqual(farmRenderKey(previous, Date.now()));
});
it("rejects customization before level nine", async () => {
 const id = await setup(8);
 expect((await saveHomeAppearance(db, id, { style: "farm-style-clay", decoration: "none" })).ok).toBe(false);
});

it("saves furniture independently of exterior changes and keeps other homes private", async () => {
 const id = await setup(), other = await setup();
 const items = [{ key: "wooden-stool", x: 850, y: 700 }] as const;
 const result = await saveHomeFurniture(db, id, { revision: 0, items });
 expect(result.ok).toBe(true);
 await saveHomeAppearance(db, id, { style: "farm-style-clay", decoration: "none" });
 const [saved] = await db.select().from(farms).where(eq(farms.playerId,id));
 expect(saved!.homeAppearance.furniture).toEqual(items);
 expect(saved!.homeAppearance.style).toBe("farm-style-clay");
 const [untouched] = await db.select().from(farms).where(eq(farms.playerId,other));
 expect(untouched!.homeAppearance.furniture).toBeUndefined();
 expect((await saveHomeFurniture(db,id,{ revision: 0, items: [] })).ok).toBe(false);
 expect((await saveHomeFurniture(db,id,{ revision: 1, items: [] })).ok).toBe(true);
 expect((await saveHomeFurniture(db,id,{ revision: 2, items })).ok).toBe(true);
});
it("rejects blocked-door placement without saving and serializes simultaneous edits", async () => {
 const id = await setup();
 expect((await saveHomeFurniture(db,id,{ revision: 0, items: [{ key: "wooden-stool", x: 566, y: 510 }] })).ok).toBe(false);
 const second = new Client({ connectionString: process.env.TEST_DATABASE_URL ?? "postgres://sumer:sumer_dev@localhost:5432/sumer_farming" });
 await second.connect();
 try {
   const results = await Promise.all([
     saveHomeFurniture(db,id,{ revision: 0, items: [{ key: "wooden-stool", x: 850, y: 700 }] }),
     saveHomeFurniture(createDatabase(second),id,{ revision: 0, items: [] }),
   ]);
   expect(results.filter(r=>r.ok)).toHaveLength(1);
 } finally { await second.end(); }
});
