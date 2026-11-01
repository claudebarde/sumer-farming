import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { Effect } from "effect";
import { Client } from "pg";
import { beforeAll, afterAll, afterEach, expect, it } from "vitest";
import { createDatabase } from "../../src/server/db/client";
import { players, farms, farmBuildings, farmInventory } from "../../src/server/db/schema";
import { buyFromNpcMarket, sellToNpcMarket } from "../../src/server/services/tradeMarketItem";
const client=new Client({connectionString:process.env.TEST_DATABASE_URL??"postgres://sumer:sumer_dev@localhost:5432/sumer_farming"});
const db=createDatabase(client),ids:string[]=[];
beforeAll(()=>client.connect());afterAll(()=>client.end());
afterEach(async()=>{if(ids.length)await db.delete(players).where(inArray(players.id,ids));ids.length=0;});
const fixture=async(quantity=0,warehouse=true,level=10)=>{
 const playerId=randomUUID();ids.push(playerId);
 await db.insert(players).values({id:playerId,displayName:"Oil trading test",shekelBalance:30});
 const [farm]=await db.insert(farms).values({playerId,level}).returning();
 if(warehouse)await db.insert(farmBuildings).values({farmId:farm!.id,type:"warehouse",column:4,row:0,startedAt:new Date(Date.now()-20000),completesAt:new Date(Date.now()-10000)});
 await db.insert(farmInventory).values({farmId:farm!.id,itemKey:"oil",quantity});
 return {playerId,farmId:farm!.id,itemKey:"oil" as const,quantity:2,expectedUnitPrice:8,expectedFarmVersion:1,idempotencyKey:randomUUID()};
};
it("buys and sells oil jars at approved prices, persists locations, and never credits harvesting",async()=>{
 const input=await fixture();
 const bought=await Effect.runPromise(buyFromNpcMarket(db,input));
 expect(bought.player.shekelBalance).toBe(14);expect(bought.inventory.find(i=>i.itemKey==="oil")?.quantity).toBe(2);
 expect(bought.farm.progression?.stats.datesStored??0).toBe(0);
 expect((await Effect.runPromise(buyFromNpcMarket(db,input))).player.shekelBalance).toBe(14);
 const sold=await Effect.runPromise(sellToNpcMarket(db,{...input,quantity:1,expectedUnitPrice:8,expectedFarmVersion:bought.farm.version,idempotencyKey:randomUUID()}));
 expect(sold.player.shekelBalance).toBe(22);
 expect(sold.inventory.find(i=>i.itemKey==="emptyBeerJar")?.quantity??0).toBe(0);
 const [entry]=await db.select().from(farmInventory).where(eq(farmInventory.farmId,input.farmId));
 expect(Object.values(entry!.locations??{}).reduce((a,b)=>a+b,0)).toBe(1);
});
it("rejects full/missing warehouses, insufficient stock, and trading below level ten",async()=>{
 for(const input of [await fixture(10),await fixture(0,false)]){
  expect(await Effect.runPromise(Effect.flip(buyFromNpcMarket(db,input)))).toMatchObject({rule:{type:"insufficient_storage"}});
 }
 const low=await fixture(2,true,9);
 expect(await Effect.runPromise(Effect.flip(sellToNpcMarket(db,{...low,expectedUnitPrice:8})))).toMatchObject({rule:{type:"trade_unavailable"}});
 const empty=await fixture();
 expect(await Effect.runPromise(Effect.flip(sellToNpcMarket(db,{...empty,expectedUnitPrice:8})))).toMatchObject({rule:{type:"insufficient_stored_item"}});
});

it("rejects purchases that would consume room reserved by oil production", async () => {
 const input = await fixture(9);
 const now = Date.now();
 await db.update(farms).set({milling: {buildingId: randomUUID(), recipe: "oil", worker: "farmer", barley: 0, output: 1, startedAt: new Date(now).toISOString(), completesAt: new Date(now + 60000).toISOString()}}).where(eq(farms.id, input.farmId));
 expect(await Effect.runPromise(Effect.flip(buyFromNpcMarket(db, {...input, quantity: 1})))).toMatchObject({rule: {type: "insufficient_storage", available: 0}});
});
