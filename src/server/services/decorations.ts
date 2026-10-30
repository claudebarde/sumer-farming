import { and, eq, sql } from "drizzle-orm";
import type { Database } from "../db/client";
import { farms, farmObjects, zigguratRewards } from "../db/schema";
import { DecorationCommandSchema, type DecorationCommand } from "../../schemas/decorations";
import { readFarmSnapshot } from "./farmSnapshot";
import { miniaturePlacementError } from "../../game-core/farm/miniaturePlacement";
export const changeDecoration = (db: Database, playerId: string, input: DecorationCommand) => db.transaction(async tx => {
  const parsed=DecorationCommandSchema.safeParse(input);
  if(!parsed.success)return {ok:false as const,message:"Choose a valid decoration action."};
  const command=parsed.data;
  const [farm]=await tx.select().from(farms).where(eq(farms.playerId,playerId)).for("update");
  if(!farm)return {ok:false as const,message:"Farm not found."};
  const snapshot=await readFarmSnapshot(tx,farm,false);
  const [reward]=await tx.select().from(zigguratRewards).where(and(eq(zigguratRewards.id,command.rewardId),eq(zigguratRewards.playerId,playerId))).for("update");
  if(!reward)return {ok:false as const,message:"This decoration does not belong to you."};
  if(command.type==="place") {
    if(reward.objectId) {
      const placed=snapshot.objects.find(o=>o.id===reward.objectId);
      return placed?.column===command.target.column&&placed.row===command.target.row ? {ok:true as const,snapshot} : {ok:false as const,message:"Return this decoration to storage before moving it."};
    }
    const reason=miniaturePlacementError(snapshot,command.target);
    if(reason)return {ok:false as const,message:reason};
    const [object]=await tx.insert(farmObjects).values({farmId:farm.id,type:"miniatureZiggurat",...command.target}).returning();
    await tx.update(zigguratRewards).set({objectId:object!.id}).where(eq(zigguratRewards.id,reward.id));
  } else if(reward.objectId) {
    await tx.delete(farmObjects).where(and(eq(farmObjects.id,reward.objectId),eq(farmObjects.farmId,farm.id)));
  } else return {ok:true as const,snapshot};
  const [updated]=await tx.update(farms).set({version:sql`${farms.version}+1`,updatedAt:new Date()}).where(eq(farms.id,farm.id)).returning();
  return {ok:true as const,snapshot:await readFarmSnapshot(tx,updated!,false)};
});
