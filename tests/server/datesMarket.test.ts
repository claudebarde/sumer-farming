import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { Effect } from "effect";
import { Client } from "pg";
import { beforeAll, afterAll, afterEach, expect, it } from "vitest";
import { createDatabase } from "../../src/server/db/client";
import { players, farms, farmBuildings, farmInventory, marketOrders } from "../../src/server/db/schema";
import { buyFromNpcMarket, sellToNpcMarket } from "../../src/server/services/tradeMarketItem";
import { createMarketSellOrder } from "../../src/server/services/marketSellOrders";
import { buyMarketSellOrder } from "../../src/server/services/buyMarketSellOrder";
const client=new Client({connectionString:process.env.TEST_DATABASE_URL??"postgres://sumer:sumer_dev@localhost:5432/sumer_farming"});
const db=createDatabase(client),ids:string[]=[];
beforeAll(()=>client.connect());afterAll(()=>client.end());
afterEach(async()=>{if(ids.length)await db.delete(players).where(inArray(players.id,ids));ids.length=0;});
const fixture=async(quantity=0,warehouse=true,level=9)=>{
 const playerId=randomUUID();ids.push(playerId);
 await db.insert(players).values({id:playerId,displayName:"Dates trading test",shekelBalance:30});
 const [farm]=await db.insert(farms).values({playerId,level}).returning();
 if(warehouse)await db.insert(farmBuildings).values({farmId:farm!.id,type:"warehouse",column:4,row:0,startedAt:new Date(Date.now()-20000),completesAt:new Date(Date.now()-10000)});
 await db.insert(farmInventory).values({farmId:farm!.id,itemKey:"dates",quantity});
 return {playerId,farmId:farm!.id,itemKey:"dates" as const,quantity:2,expectedUnitPrice:5,expectedFarmVersion:1,idempotencyKey:randomUUID()};
};
it("buys and sells baskets at approved prices, persists locations, and never credits harvesting",async()=>{
 const input=await fixture();
 const bought=await Effect.runPromise(buyFromNpcMarket(db,input));
 expect(bought.player.shekelBalance).toBe(20);expect(bought.inventory.find(i=>i.itemKey==="dates")?.quantity).toBe(2);
 expect(bought.farm.progression?.stats.datesStored??0).toBe(0);
 expect((await Effect.runPromise(buyFromNpcMarket(db,input))).player.shekelBalance).toBe(20);
 const sold=await Effect.runPromise(sellToNpcMarket(db,{...input,quantity:1,expectedUnitPrice:2,expectedFarmVersion:bought.farm.version,idempotencyKey:randomUUID()}));
 expect(sold.player.shekelBalance).toBe(22);
 const [entry]=await db.select().from(farmInventory).where(eq(farmInventory.farmId,input.farmId));
 expect(Object.values(entry!.locations??{}).reduce((a,b)=>a+b,0)).toBe(1);
});
it("rejects full/missing warehouses, insufficient stock, and trading below level nine",async()=>{
 for(const input of [await fixture(10),await fixture(0,false)]){
  expect(await Effect.runPromise(Effect.flip(buyFromNpcMarket(db,input)))).toMatchObject({rule:{type:"insufficient_storage"}});
 }
 const low=await fixture(2,true,8);
 expect(await Effect.runPromise(Effect.flip(sellToNpcMarket(db,{...low,expectedUnitPrice:2})))).toMatchObject({rule:{type:"trade_unavailable"}});
 const empty=await fixture();
 expect(await Effect.runPromise(Effect.flip(sellToNpcMarket(db,{...empty,expectedUnitPrice:2})))).toMatchObject({rule:{type:"insufficient_stored_item"}});
});
it("reserves room for an accepted date harvest until its delivery settles",async()=>{
 const input=await fixture(3),now=Date.now();
 const [farm]=await db.select().from(farms).where(eq(farms.id,input.farmId));
 await db.update(farms).set({production:{...farm!.production,cropWork:{id:randomUUID(),cropId:randomUUID(),cropKey:"datePalm",action:"harvest",quantity:2,settled:false,startedAt:now,workStartsAt:now+10000,workEndsAt:now+20000,completesAt:now+30000,outbound:[{column:1,row:5}],inbound:[{column:1,row:5}]}}}).where(eq(farms.id,input.farmId));
 expect(await Effect.runPromise(Effect.flip(buyFromNpcMarket(db,{...input,quantity:1})))).toMatchObject({rule:{type:"insufficient_storage",available:0}});
});
it("supports date listings and player purchases without harvest progression credit",async()=>{
 const seller=await fixture(4),buyer=await fixture();
 await Effect.runPromise(createMarketSellOrder(db,{...seller,unitPrice:3}));
 const [order]=await db.select().from(marketOrders).where(eq(marketOrders.playerId,seller.playerId));
 const bought=await Effect.runPromise(buyMarketSellOrder(db,{...buyer,orderId:order!.id,expectedUnitPrice:3}));
 expect(bought.player.shekelBalance).toBe(24);expect(bought.inventory.find(i=>i.itemKey==="dates")?.quantity).toBe(2);
 expect(bought.farm.progression?.stats.datesStored??0).toBe(0);
});
