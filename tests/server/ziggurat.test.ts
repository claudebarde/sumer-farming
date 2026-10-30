import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { eq, inArray } from "drizzle-orm";
import { beforeAll, afterAll, afterEach, expect, it } from "vitest";
import { createDatabase } from "../../src/server/db/client";
import { players, farms, neighbourhoods, neighbourhoodMembers, zigguratInterests, zigguratProjects, zigguratDonations, zigguratDeliveries, farmInventory, farmBuildings } from "../../src/server/db/schema";
import { zigguratInterest, donateZiggurat } from "../../src/server/services/ziggurat";
import { ZigguratInterestCommandSchema } from "../../src/schemas/ziggurat";

const connectionString = process.env.TEST_DATABASE_URL ?? "postgres://sumer:sumer_dev@localhost:5432/sumer_farming";
const client = new Client({ connectionString });
const db = createDatabase(client);
const playerIds: string[] = [], homeIds: string[] = [];
beforeAll(() => client.connect());
afterEach(async () => {
  if (playerIds.length) await db.delete(players).where(inArray(players.id, playerIds));
  if (homeIds.length) await db.delete(neighbourhoods).where(inArray(neighbourhoods.id, homeIds));
  playerIds.length = 0; homeIds.length = 0;
});
afterAll(() => client.end());
const fixture = async () => {
  const home = randomUUID(); homeIds.push(home);
  await db.insert(neighbourhoods).values({ id: home, city: "ur", name: "Ziggurat test" });
  const ids = Array.from({ length: 4 }, () => randomUUID()); playerIds.push(...ids);
  for (const [i, id] of ids.entries()) {
    await db.insert(players).values({ id, displayName: "Account name" });
    await db.insert(farms).values({ playerId: id, level: i === 3 ? 9 : 10,
      farmerProfile: { version: 1, identity: { name: `Neighbour ${i}` } } });
    await db.insert(neighbourhoodMembers).values({ playerId: id, neighbourhoodId: home, slot: i + 1 });
  }
  return { home, ids };
};
const state = async (id: string, interested?: boolean) => {
  const result = await zigguratInterest(db, id, interested);
  if (!result.ok) throw new Error(result.message);
  return result.data;
};
it("persists interest, counts eligible neighbours dynamically, and supports withdrawal without spending goods", async () => {
  const { ids, home } = await fixture();
  const before = await db.select().from(farms).where(inArray(farms.playerId, ids));
  expect((await state(ids[0]!)).eligibleCount).toBe(3);
  expect((await state(ids[0]!, true)).supporters).toEqual([{ slot: 1, name: "Neighbour 0", isYou: true }]);
  await state(ids[0]!, true);
  expect(await db.select().from(zigguratInterests).where(eq(zigguratInterests.neighbourhoodId, home))).toHaveLength(1);
  expect((await state(ids[1]!)).supporters[0]?.isYou).toBe(false);
  expect((await state(ids[0]!, false)).supporters).toHaveLength(0);
  expect(await db.select().from(farms).where(inArray(farms.playerId, ids))).toEqual(before);
  await db.update(farms).set({ level: 10 }).where(eq(farms.playerId, ids[3]!));
  expect((await state(ids[0]!)).eligibleCount).toBe(4);
});
it("rejects low-level participation, unknown players and forged neighbourhood identifiers", async () => {
  const { ids } = await fixture();
  expect((await state(ids[3]!)).canParticipate).toBe(false);
  expect(await zigguratInterest(db, ids[3]!, true)).toMatchObject({ ok: false });
  expect(await zigguratInterest(db, randomUUID(), true)).toMatchObject({ ok: false });
  expect(ZigguratInterestCommandSchema.safeParse({ interested: true, neighbourhoodId: randomUUID() }).success).toBe(false);
});
it("opens fundraising once under simultaneous registrations and preserves the opening across retries and withdrawal", async () => {
  const { ids } = await fixture();
  await state(ids[0]!, true);
  const clients = [new Client({ connectionString }), new Client({ connectionString })];
  await Promise.all(clients.map(c => c.connect()));
  try {
    const results = await Promise.all(clients.map((c, i) => zigguratInterest(createDatabase(c), ids[i + 1]!, true)));
    expect(results.every(result => result.ok)).toBe(true);
  } finally { await Promise.all(clients.map(c => c.end())); }
  const opened = await state(ids[0]!);
  expect(opened.state.type).toBe("fundraising");
  expect(opened.supporters).toHaveLength(3);
  expect((await state(ids[2]!, true)).state).toEqual(opened.state);
  expect((await state(ids[0]!, false)).state).toEqual(opened.state);
  expect((await state(ids[0]!)).supporters).toHaveLength(3);
});
it("isolates neighbourhoods and excludes departed neighbours from pre-opening support", async () => {
  const a = await fixture(), b = await fixture();
  await state(a.ids[0]!, true);
  expect((await state(b.ids[0]!)).supporters).toHaveLength(0);
  await db.update(neighbourhoodMembers).set({ neighbourhoodId: b.home, slot: 5 }).where(eq(neighbourhoodMembers.playerId, a.ids[0]!));
  expect((await state(a.ids[1]!)).supporters).toHaveLength(0);
  expect((await state(a.ids[1]!)).eligibleCount).toBe(2);
  expect((await state(a.ids[0]!)).interested).toBe(false);
});

const fundable = async () => {
  const f = await fixture();
  for (const id of f.ids.slice(0, 3)) await state(id, true);
  return f;
};
const stock = async (playerId: string, clay = 4, reed = 3) => {
  const [farm] = await db.select().from(farms).where(eq(farms.playerId, playerId));
  await db.insert(farmInventory).values([
    { farmId: farm!.id, itemKey: "clay", quantity: clay }, { farmId: farm!.id, itemKey: "reed", quantity: reed }
  ]);
  return farm!;
};
const command = (clay = 3, reed = 2) => ({ idempotencyKey: randomUUID(), clay, reed });
const parallelDonations = async (ids: string[], commands: ReturnType<typeof command>[]) => {
  const clients = ids.map(() => new Client({ connectionString }));
  await Promise.all(clients.map(c => c.connect()));
  try { return await Promise.all(clients.map((c, i) => donateZiggurat(createDatabase(c), ids[i]!, commands[i]!))); }
  finally { await Promise.all(clients.map(c => c.end())); }
};
it("deducts only stored materials once, records points, and leaves a busy farmer working", async () => {
  const { ids, home } = await fundable();
  const farm = await stock(ids[0]!);
  await db.update(farms).set({ gatheringItemKey: "clay", gatheringColumn: 0, gatheringRow: 9,
    gatheringStartedAt: new Date(), gatheringCompletesAt: new Date(Date.now() + 60000) }).where(eq(farms.id, farm.id));
  const donation = command();
  const result = await donateZiggurat(db, ids[0]!, donation);
  expect(result).toMatchObject({ ok: true, receipt: { clay: 3, reed: 2, points: 10 }, data: {
    funded: { clay: 3, reed: 2 }, stock: { clay: 1, reed: 1 }, contributionPoints: 10
  } });
  expect(await donateZiggurat(db, ids[0]!, donation)).toEqual(result.ok ? {...result,data:{...result.data,serverTime:expect.any(String)}} : result);
  expect(await donateZiggurat(db, ids[0]!, { ...donation, clay: 1 })).toMatchObject({ ok: false });
  expect((await state(ids[0]!)).funded).toMatchObject({ clay: 3, reed: 2 });
  expect(await db.select().from(zigguratDonations).where(eq(zigguratDonations.neighbourhoodId, home))).toHaveLength(1);
  const [saved] = await db.select().from(farms).where(eq(farms.id, farm.id));
  expect(saved?.gatheringItemKey).toBe("clay");
  expect(saved?.version).toBe(farm.version + 1);
});
it("caps racing final donations, starts exactly one six-hour job and keeps excess goods", async () => {
  const { ids, home } = await fundable();
  await stock(ids[0]!); await stock(ids[1]!);
  await db.update(zigguratProjects).set({ foundationClay: 28, foundationReed: 14 }).where(eq(zigguratProjects.neighbourhoodId, home));
  const commands = [command(), command()];
  const results = await parallelDonations(ids.slice(0, 2), commands);
  expect(results.filter(result => result.ok)).toHaveLength(1);
  const winner = results.findIndex(result => result.ok);
  expect(results[winner]).toMatchObject({ receipt: { clay: 2, reed: 1, points: 6 } });
  const [project] = await db.select().from(zigguratProjects).where(eq(zigguratProjects.neighbourhoodId, home));
  expect(project?.foundationClay).toBe(30); expect(project?.foundationReed).toBe(15);
  expect(project!.foundationsCompleteAt!.getTime() - project!.foundationsStartedAt!.getTime()).toBe(6 * 3600000);
  expect((await state(ids[winner]!)).stock).toMatchObject({ clay: 2, reed: 2 });
  expect((await state(ids[1 - winner]!)).stock).toMatchObject({ clay: 4, reed: 3 });
  expect(await donateZiggurat(db, ids[winner]!, commands[winner]!)).toEqual(results[winner]!.ok ? {...results[winner],data:{...results[winner]!.data,serverTime:expect.any(String)}} : results[winner]);
  // Simulate time away by moving only the saved job's timestamps back.
  const start = new Date(Date.now() - 7 * 3600000), end = new Date(start.getTime() + 6 * 3600000);
  await db.update(zigguratProjects).set({ foundationsStartedAt: start, foundationsCompleteAt: end }).where(eq(zigguratProjects.neighbourhoodId, home));
  for (let i = 0; i < 2; i++) {
    expect((await state(ids[0]!)).state).toEqual({ type: "fundraising", stage: 1, openedAt: end.toISOString() });
    expect(await donateZiggurat(db, ids[1 - winner]!, command())).toMatchObject({ ok: false });
  }
  expect(await db.select().from(zigguratDonations).where(eq(zigguratDonations.neighbourhoodId, home))).toHaveLength(1);
  expect((await state(ids[winner]!)).contributionPoints).toBe(6);
});
it("serializes same-player donations so the final stock cannot be spent twice", async () => {
  const { ids } = await fundable(); await stock(ids[0]!, 3, 0);
  const results = await parallelDonations([ids[0]!, ids[0]!], [command(3, 0), command(3, 0)]);
  expect(results.filter(result => result.ok)).toHaveLength(1);
  expect((await state(ids[0]!)).stock.clay).toBe(0);
  expect((await state(ids[0]!)).funded.clay).toBe(3);
});
it("accepts simultaneous duplicate retries once", async () => {
  const { ids } = await fundable(); await stock(ids[0]!);
  const donation = command();
  const results = await parallelDonations([ids[0]!, ids[0]!], [donation, donation]);
  expect(results[0]).toEqual(results[1]?.ok ? {...results[1],data:{...results[1].data,serverTime:expect.any(String)}} : results[1]);
  expect((await state(ids[0]!)).contributionPoints).toBe(10);
});
it("rejects invalid, locked, unopened and understocked donations without partial deductions", async () => {
  const { ids } = await fixture(); await stock(ids[0]!, 4, 0);
  expect(await donateZiggurat(db, ids[0]!, command())).toMatchObject({ ok: false });
  for (const id of ids.slice(0, 3)) await state(id, true);
  expect(await donateZiggurat(db, ids[3]!, command())).toMatchObject({ ok: false });
  expect(await donateZiggurat(db, ids[0]!, command())).toMatchObject({ ok: false });
  for (const invalid of [command(-1, 0), command(0, 0), command(1.5, 0), command(61, 0)])
    expect(await donateZiggurat(db, ids[0]!, invalid)).toMatchObject({ ok: false });
  expect((await state(ids[0]!)).stock).toMatchObject({ clay: 4, reed: 0 });
  expect((await state(ids[0]!)).funded).toMatchObject({ clay: 0, reed: 0 });
  expect((await state(ids[0]!)).contributionPoints).toBe(0);
  // Late level-10 members may donate without having expressed interest.
  await db.update(farms).set({ level: 10 }).where(eq(farms.playerId, ids[3]!));
  await stock(ids[3]!);
  expect(await donateZiggurat(db, ids[3]!, command(1, 1))).toMatchObject({ ok: true });
});

it("serializes shared donkey trips, coalesces repeated donations, and skips expired trips after time away",async()=>{
  const {ids,home}=await fundable();
  await stock(ids[0]!);await stock(ids[1]!);
  await parallelDonations([ids[0]!,ids[1]!],[command(1,1),command(1,1)]);
  const jobs=await db.select().from(zigguratDeliveries).where(eq(zigguratDeliveries.neighbourhoodId,home));
  expect(jobs).toHaveLength(2);
  jobs.sort((a,b)=>a.startsAt.getTime()-b.startsAt.getTime());
  expect(jobs[1]!.startsAt.getTime()).toBe(jobs[0]!.completesAt.getTime());
  await donateZiggurat(db,ids[0]!,command(1,0));
  expect(await db.select().from(zigguratDeliveries).where(eq(zigguratDeliveries.neighbourhoodId,home))).toHaveLength(2);
  expect((await state(ids[0]!)).deliveries).toEqual((await state(ids[1]!)).deliveries);
  const before=(await state(ids[0]!)).funded;
  await db.update(zigguratDeliveries).set({startsAt:new Date(Date.now()-200000),completesAt:new Date(Date.now()-100000)}).where(eq(zigguratDeliveries.neighbourhoodId,home));
  expect((await state(ids[0]!)).deliveries).toEqual([]);
  expect((await state(ids[0]!)).funded).toMatchObject(before);
});

const finishFoundations = async (home: string) => {
  const end = new Date(Date.now() - 1000);
  await db.update(zigguratProjects).set({ foundationClay: 30, foundationReed: 15, foundationsStartedAt: new Date(end.getTime() - 6 * 3600000), foundationsCompleteAt: end }).where(eq(zigguratProjects.neighbourhoodId, home));
};
const addGoods = async (id: string, goods: Record<string, number>) => {
  const [farm] = await db.select().from(farms).where(eq(farms.playerId, id));
  for (const [itemKey, quantity] of Object.entries(goods)) await db.insert(farmInventory).values({ farmId: farm!.id, itemKey, quantity }).onConflictDoUpdate({target:[farmInventory.farmId,farmInventory.itemKey],set:{quantity}});
  return farm!;
};
it("funds every remaining stage, persists deadlines, preserves a seed, and completes offline exactly once", async () => {
  const { ids, home } = await fundable(); await finishFoundations(home);
  await addGoods(ids[0]!, { clay: 135, barley: 31, bread: 39, beer: 18, dates: 12 });
  await db.update(players).set({shekelBalance: 300}).where(eq(players.id, ids[0]!));
  const stages = [
    {stage:1,clay:45,barley:30,bread:15},
    {stage:2,clay:60,bread:24,beer:18},
    {stage:3,clay:30,dates:12,shekels:250}
  ];
  let total = 0;
  for (const input of stages) {
    const donation = {...input,idempotencyKey:randomUUID()};
    const result = await donateZiggurat(db,ids[0]!,donation);
    expect(result.ok).toBe(true); if (!result.ok) throw new Error(result.message);
    total += result.receipt.points;
    expect(result.data.state).toMatchObject({type:"building",stage:input.stage});
    const [project] = await db.select().from(zigguratProjects).where(eq(zigguratProjects.neighbourhoodId,home));
    const saved = project!.laterStages[String(input.stage)]!;
    expect(Date.parse(saved.completesAt!) - Date.parse(saved.startedAt!)).toBe((input.stage + 1) * 6 * 3600000);
    const end = new Date(Date.now()-1000).toISOString();
    await db.update(zigguratProjects).set({laterStages:{...project!.laterStages,[String(input.stage)]:{...saved,startedAt:new Date(Date.parse(end)-(input.stage+1)*6*3600000).toISOString(),completesAt:end}}}).where(eq(zigguratProjects.neighbourhoodId,home));
    expect((await state(ids[0]!)).state).toMatchObject(input.stage < 3 ? {type:"fundraising",stage:input.stage+1} : {type:"complete",completedAt:end});
    // An old successful receipt must work even after a later stage has opened.
    expect(await donateZiggurat(db,ids[0]!,donation)).toMatchObject({ok:true,receipt:result.receipt});
  }
  const final = await state(ids[0]!);
  expect(final.stock).toMatchObject({clay:0,barley:1,bread:0,beer:0,dates:0,shekels:50});
  expect(final.contributionPoints).toBe(1108); expect(total).toBe(1108);
  expect((await state(ids[0]!)).state).toEqual(final.state);
  expect(await donateZiggurat(db,ids[0]!,{idempotencyKey:randomUUID(),stage:3,shekels:1})).toMatchObject({ok:false});
});
it("rejects stale stages, wrong materials, insufficient funds and seed exhaustion without partial charges",async()=>{
  const {ids,home}=await fundable(); await finishFoundations(home);
  await addGoods(ids[0]!,{clay:45,barley:30,bread:15});
  expect(await donateZiggurat(db,ids[0]!,command(1,0))).toMatchObject({ok:false});
  expect(await donateZiggurat(db,ids[0]!,{idempotencyKey:randomUUID(),stage:1,reed:1})).toMatchObject({ok:false});
  expect(await donateZiggurat(db,ids[0]!,{idempotencyKey:randomUUID(),stage:1,clay:45,barley:30,bread:15})).toMatchObject({ok:false});
  expect((await state(ids[0]!)).stock).toMatchObject({clay:45,barley:30,bread:15});
  expect((await state(ids[0]!)).contributionPoints).toBe(0);
  // Advance a separate saved project to the sanctuary funding boundary.
  const end=new Date(Date.now()-1000).toISOString();
  const {emptyMaterials}=await import('../../src/game-data/ziggurat');
  await db.update(zigguratProjects).set({laterStages:{'1':{funded:emptyMaterials(),startedAt:end,completesAt:end},'2':{funded:emptyMaterials(),startedAt:end,completesAt:end}}}).where(eq(zigguratProjects.neighbourhoodId,home));
  await addGoods(ids[0]!,{dates:12});await db.update(players).set({shekelBalance:249}).where(eq(players.id,ids[0]!));
  expect(await donateZiggurat(db,ids[0]!,{idempotencyKey:randomUUID(),stage:3,clay:30,dates:12,shekels:250})).toMatchObject({ok:false});
  expect((await state(ids[0]!)).stock).toMatchObject({clay:45,dates:12,shekels:249});
});
it("caps concurrent later-stage donations and starts only one construction timer",async()=>{
  const {ids,home}=await fundable();await finishFoundations(home);
  for(const id of ids.slice(0,2))await addGoods(id,{clay:45,barley:31,bread:15});
  const clients=ids.slice(0,2).map(()=>new Client({connectionString}));await Promise.all(clients.map(c=>c.connect()));
  try{
    const results=await Promise.all(clients.map((c,i)=>donateZiggurat(createDatabase(c),ids[i]!,{idempotencyKey:randomUUID(),stage:1,clay:45,barley:30,bread:15})));
    expect(results.filter(r=>r.ok)).toHaveLength(1);
    expect((await state(ids[0]!)).funded).toMatchObject({clay:45,barley:30,bread:15});
    expect(await db.select().from(zigguratDonations).where(eq(zigguratDonations.neighbourhoodId,home))).toHaveLength(1);
  }finally{await Promise.all(clients.map(c=>c.end()));}
});

it("counts granary and warehouse barley for donations while preserving one seed across the estate",async()=>{
  const {ids,home}=await fundable();await finishFoundations(home);
  const farm=await addGoods(ids[0]!,{barley:1});
  for(const [i,type] of (["granary","warehouse"] as const).entries()) await db.insert(farmBuildings).values({farmId:farm.id,type,column:i*3,row:0,storedBarley:15,startedAt:new Date(Date.now()-20000),completesAt:new Date(Date.now()-10000)});
  expect((await state(ids[0]!)).stock.barley).toBe(31);
  expect(await donateZiggurat(db,ids[0]!,{idempotencyKey:randomUUID(),stage:1,barley:30})).toMatchObject({ok:true,receipt:{barley:30,points:90}});
  expect((await state(ids[0]!)).stock.barley).toBe(1);
  const buildings=await db.select().from(farmBuildings).where(eq(farmBuildings.farmId,farm.id));
  expect(buildings.reduce((sum,b)=>sum+b.storedBarley,0)).toBe(1);
});

it("awards every tied winner offline once, and safely places and stores their permanent reward", async () => {
  const { emptyMaterials } = await import("../../src/game-data/ziggurat");
  const { zigguratRewards, farmObjects } = await import("../../src/server/db/schema");
  const { changeDecoration } = await import("../../src/server/services/decorations");
  const { settleZigguratRewards } = await import("../../src/server/services/zigguratRewards");
  const { ids, home } = await fundable();
  await finishFoundations(home);
  const end = new Date(Date.now()-1000).toISOString();
  for (const [i, id] of ids.entries()) {
    if (i === 3) continue;
    await db.insert(zigguratDonations).values({neighbourhoodId:home,playerId:id,idempotencyKey:randomUUID(),requestedClay:10,requestedReed:0,clay:10,reed:0,points:i<2?20:10});
  }
  await db.transaction(tx => settleZigguratRewards(tx, { type: "neighbourhood", neighbourhoodId: home }));
  expect(await db.select().from(zigguratRewards).where(eq(zigguratRewards.neighbourhoodId,home))).toHaveLength(0);
  await db.update(zigguratProjects).set({laterStages:Object.fromEntries([1,2,3].map(stage=>[String(stage),{funded:emptyMaterials(),startedAt:end,completesAt:end}]))}).where(eq(zigguratProjects.neighbourhoodId,home));
  const awardClients = [new Client({connectionString}), new Client({connectionString})];
  await Promise.all(awardClients.map(c=>c.connect()));
  try { await Promise.all(awardClients.map(c=>createDatabase(c).transaction(tx => settleZigguratRewards(tx, { type: "neighbourhood", neighbourhoodId: home })))); }
  finally { await Promise.all(awardClients.map(c=>c.end())); }
  // Only a non-winner reads the site; both absent winners still receive rewards.
  await state(ids[2]!);
  await state(ids[2]!);
  const rewards = await db.select().from(zigguratRewards).where(eq(zigguratRewards.neighbourhoodId,home));
  expect(rewards.map(r=>r.playerId).sort()).toEqual(ids.slice(0,2).sort());
  expect(rewards.every(r=>r.awardedAt.toISOString()===end && r.objectId===null)).toBe(true);
  const reward = rewards.find(r=>r.playerId===ids[0])!;
  const target={column:-4,row:0};
  expect(await changeDecoration(db,ids[2]!,{type:"place",rewardId:reward.id,target})).toMatchObject({ok:false});
  expect(await changeDecoration(db,ids[0]!,{type:"place",rewardId:reward.id,target:{column:0,row:5}})).toMatchObject({ok:false});
  const placed=await changeDecoration(db,ids[0]!,{type:"place",rewardId:reward.id,target});
  expect(placed.ok).toBe(true); if(!placed.ok)throw new Error(placed.message);
  const object=placed.snapshot.objects.find(o=>o.type==="miniatureZiggurat")!;
  expect(object).toMatchObject(target);
  expect(placed.snapshot.rewards.find(r=>r.id===reward.id)?.objectId).toBe(object.id);
  await changeDecoration(db,ids[0]!,{type:"place",rewardId:reward.id,target});
  expect(await db.select().from(farmObjects).where(eq(farmObjects.id,object.id))).toHaveLength(1);
  const stored=await changeDecoration(db,ids[0]!,{type:"store",rewardId:reward.id});
  expect(stored.ok).toBe(true); if(!stored.ok)throw new Error(stored.message);
  expect(stored.snapshot.objects.some(o=>o.id===object.id)).toBe(false);
  expect(stored.snapshot.rewards.find(r=>r.id===reward.id)?.objectId).toBeNull();
  await changeDecoration(db,ids[0]!,{type:"store",rewardId:reward.id});
  expect((await changeDecoration(db,ids[0]!,{type:"place",rewardId:reward.id,target})).ok).toBe(true);
  expect(await db.select().from(zigguratRewards).where(eq(zigguratRewards.neighbourhoodId,home))).toHaveLength(2);
});

const completedRewardFixture = async () => {
  const { emptyMaterials } = await import("../../src/game-data/ziggurat");
  const fixtureData = await fundable();
  await finishFoundations(fixtureData.home);
  const end = new Date(Date.now() - 1000).toISOString();
  await db.update(zigguratProjects).set({ laterStages: Object.fromEntries([1, 2, 3].map(stage => [String(stage), {
    funded: emptyMaterials(), startedAt: end, completesAt: end
  }])) }).where(eq(zigguratProjects.neighbourhoodId, fixtureData.home));
  for (const playerId of fixtureData.ids.slice(0, 2)) {
    await db.insert(zigguratDonations).values({ neighbourhoodId: fixtureData.home, playerId,
      idempotencyKey: randomUUID(), requestedClay: 10, requestedReed: 0, clay: 10, reed: 0, points: 20 });
  }
  return fixtureData;
};

it.each(["player", "neighbourhood"] as const)("settles rewards without deadlocking concurrent %s locks", async parent => {
  const { sql } = await import("drizzle-orm");
  const { settleZigguratRewards } = await import("../../src/server/services/zigguratRewards");
  const { zigguratRewards } = await import("../../src/server/db/schema");
  const first = await completedRewardFixture();
  const second = parent === "neighbourhood" ? await completedRewardFixture() : first;
  const clients = [new Client({ connectionString }), new Client({ connectionString })];
  await Promise.all(clients.map(c => c.connect()));
  try {
    // Hold both parent locks until BOTH settlements finish. Previously each
    // insert waited on the other's FK parent lock and PostgreSQL found a cycle.
    const barrier = () => {
      let count = 0;
      let release: () => void = () => {};
      const ready = new Promise<void>(resolve => { release = resolve; });
      return async () => { if (++count === 2) release(); await ready; };
    };
    const locked = barrier(), settled = barrier();
    const results = await Promise.allSettled(clients.map((c, i) => createDatabase(c).transaction(async tx => {
      await tx.execute(sql`SET LOCAL statement_timeout = '3s'`);
      if (parent === "player") await tx.select().from(players).where(eq(players.id, first.ids[i]!)).for("update");
      else await tx.select().from(neighbourhoods).where(eq(neighbourhoods.id, i === 0 ? first.home : second.home)).for("update");
      await locked();
      try { await settleZigguratRewards(tx, { type: "global" }); }
      finally { await settled(); }
    })));
    expect(results.map(result => result.status)).toEqual(["fulfilled", "fulfilled"]);
    await db.transaction(tx => settleZigguratRewards(tx, { type: "neighbourhood", neighbourhoodId: first.home }));
    expect(await db.select().from(zigguratRewards).where(eq(zigguratRewards.neighbourhoodId, first.home))).toHaveLength(2);
    expect((await db.execute(sql`SELECT count(*)::int AS count FROM ziggurat_rewards WHERE neighbourhood_id = ${second.home}`)).rows[0]?.count).toBe(2);
  } finally {
    await Promise.all(clients.map(c => c.end()));
  }
});

it("scopes farm rewards to the owner and retries busy awards on the next neighbourhood read", async () => {
  const { settleZigguratRewards } = await import("../../src/server/services/zigguratRewards");
  const { zigguratRewards } = await import("../../src/server/db/schema");
  const { home, ids } = await completedRewardFixture();
  const other = await completedRewardFixture();
  await db.transaction(tx => settleZigguratRewards(tx, { type: "player", playerId: ids[0]! }));
  expect((await db.select().from(zigguratRewards).where(eq(zigguratRewards.neighbourhoodId, home))).map(r => r.playerId)).toEqual([ids[0]]);
  expect(await db.select().from(zigguratRewards).where(eq(zigguratRewards.neighbourhoodId, other.home))).toHaveLength(0);
  const busy = new Client({ connectionString });
  await busy.connect();
  try {
    await busy.query("BEGIN");
    await busy.query("SELECT id FROM players WHERE id = $1 FOR UPDATE", [ids[1]]);
    await state(ids[2]!);
    expect(await db.select().from(zigguratRewards).where(eq(zigguratRewards.neighbourhoodId, home))).toHaveLength(1);
  } finally { await busy.query("ROLLBACK"); await busy.end(); }
  await state(ids[2]!);
  await state(ids[2]!);
  expect(await db.select().from(zigguratRewards).where(eq(zigguratRewards.neighbourhoodId, home))).toHaveLength(2);
});
