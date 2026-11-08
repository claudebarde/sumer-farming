import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { Effect } from "effect";
import { Client } from "pg";
import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import { createDatabase } from "../../src/server/db/client";
import { farms, players } from "../../src/server/db/schema";
import { farmerSleepAction, wakeForPlayerCommand } from "../../src/server/services/farmerSleep";
import { SLEEP_LIMIT_MS, SLEEP_HOME, sleepRemaining, sleepIntervals } from "../../src/game-data/farmerSleep";
import { decayHappiness, happinessDecayElapsed, happinessCreditStart } from "../../src/game-core/farm/wellbeing";

const hour = 3600000;
const client = new Client({ connectionString: process.env.TEST_DATABASE_URL ?? "postgres://sumer:sumer_dev@localhost:5432/sumer_farming" });
const db = createDatabase(client), ids: string[] = [];
beforeAll(() => client.connect());
afterEach(async () => { if (ids.length) await db.delete(players).where(inArray(players.id, ids)); ids.length = 0; });
afterAll(() => client.end());
const setup = async () => {
 const playerId = randomUUID(); ids.push(playerId);
 await db.insert(players).values({ id: playerId, displayName: "Sleep test" });
 const [farm] = await db.insert(farms).values({ playerId, level: 10 }).returning();
 return { playerId, farm: farm! };
};
it("persists one server-timed session; retries cannot reset or extend it", async () => {
 const {playerId} = await setup();
 const command = {type:"farmer_sleep" as const, action:"sleep" as const, expectedFarmVersion:1, farmerPosition:SLEEP_HOME, playerId};
 const started = await Effect.runPromise(farmerSleepAction(db, command));
 expect(started.farm.sleep.session!.endsAt - started.farm.sleep.session!.sleepsAt).toBe(SLEEP_LIMIT_MS);
 expect((await Effect.runPromise(farmerSleepAction(db, command))).farm.sleep).toEqual(started.farm.sleep);
});
it("wakes before player work and preserves used allowance after another sleep", async () => {
 const {playerId, farm} = await setup(), now=Date.now();
 const session={id:randomUUID(), requestedAt:now-2*hour-2500, sleepsAt:now-2*hour, endsAt:now+6*hour, wokeAt:null, path:[SLEEP_HOME]};
 await db.update(farms).set({sleep:{history:[],session}}).where(eq(farms.id,farm.id));
 const command=await wakeForPlayerCommand(db,playerId,{type:"give_farmer_bread",expectedFarmVersion:1});
 expect(command).toMatchObject({expectedFarmVersion:2});
 const [saved]=await db.select().from(farms).where(eq(farms.id,farm.id));
 expect(saved!.sleep.session!.wokeAt).not.toBeNull();
 const next=await Effect.runPromise(farmerSleepAction(db,{type:"farmer_sleep",action:"sleep",expectedFarmVersion:2,playerId}));
 expect(next.farm.sleep.history).toHaveLength(1);
 expect(next.farm.sleep.session!.endsAt-next.farm.sleep.session!.sleepsAt).toBeLessThanOrEqual(6*hour);
});
it("rejects exhausted allowance and carrying goods", async () => {
 const {playerId,farm}=await setup(), now=Date.now();
 await db.update(farms).set({sleep:{history:[{start:now-9*hour,end:now-hour}],session:null}}).where(eq(farms.id,farm.id));
 await expect(Effect.runPromise(farmerSleepAction(db,{type:"farmer_sleep",action:"sleep",expectedFarmVersion:1,playerId}))).rejects.toThrow("No sleep time");
 await db.update(farms).set({sleep:{history:[],session:null},carriedItemKey:"clay",carriedItemQuantity:1}).where(eq(farms.id,farm.id));
 await expect(Effect.runPromise(farmerSleepAction(db,{type:"farmer_sleep",action:"sleep",expectedFarmVersion:1,playerId}))).rejects.toThrow();
});
it("limits offline protection to saved sleep and gives the same result after repeated reads", () => {
 const sleep=[{start:hour,end:9*hour}];
 expect(happinessDecayElapsed(0,25*hour,null,sleep)).toBe(21*hour);
 const initial={happiness:100,checkedAt:0};
 const once=decayHappiness(initial,25*hour,null,sleep);
 let incremental=initial;
 for(let t=60000;t<=25*hour;t+=60000) incremental=decayHappiness(incremental,t,null,sleep);
 expect(incremental).toEqual(once);
 expect(sleepRemaining({history:sleep,session:null},25*hour)).toBe(0);
 expect(sleepRemaining({history:sleep,session:null},29*hour)).toBe(4*hour);
});
it("does not grant protection during entry or after early waking", () => {
 const state={history:[],session:{id:randomUUID(),requestedAt:0,sleepsAt:2500,endsAt:8*hour+2500,wokeAt:hour+2500,path:[SLEEP_HOME]}};
 expect(happinessDecayElapsed(0,2*hour,null,sleepIntervals(state))).toBe(1.5*hour);
});


it("preserves fractional happiness credit when an offering replaces an old blessing", () => {
 const sleep=[{start:0,end:hour}];
 const credit=happinessDecayElapsed(0,hour,null,sleep);
 const start=happinessCreditStart(hour,credit,sleep);
 expect(happinessDecayElapsed(start,hour,null,sleep)).toBe(credit);
});
