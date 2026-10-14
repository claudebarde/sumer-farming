import { eq } from "drizzle-orm";
import { getBuildingFootprint } from "../../game-core/farm/buildings";
import { isArableGround } from "../../game-core/farm/land";
import { planArableSceneryRelocation } from "../../game-core/farm/sceneryRelocation";
import type { DatabaseTransaction } from "../db/client";
import { farmBuildings, farmCrops, farmGroundItems, farmImprovements, farmObjects, farms } from "../db/schema";
import type { FarmRecord } from "./farmLifecycle";

/** Runs under the farm row lock, before any snapshot/action uses terrain. Idempotent. */
export const migrateFarmLand = async (
  transaction: DatabaseTransaction, farm: FarmRecord, now: Date
): Promise<FarmRecord> => {
  const objects = await transaction.select().from(farmObjects).where(eq(farmObjects.farmId, farm.id));
  if (!objects.some(isArableGround)) return farm;
  const crops = await transaction.select().from(farmCrops).where(eq(farmCrops.farmId, farm.id));
  const goods = await transaction.select().from(farmGroundItems).where(eq(farmGroundItems.farmId, farm.id));
  const canals = await transaction.select().from(farmImprovements).where(eq(farmImprovements.farmId, farm.id));
  const buildings = await transaction.select().from(farmBuildings).where(eq(farmBuildings.farmId, farm.id));
  const occupied = new Set([
    ...crops, ...goods, ...canals, ...farm.roads,
    ...buildings.flatMap(b => [...getBuildingFootprint(b.type, b), ...(b.loadingTile ? [b.loadingTile] : [])])
  ].map(p => `${p.column}:${p.row}`));
  const plan = planArableSceneryRelocation(objects, occupied);
  // A corrupt/fully occupied legacy map must roll back, never silently lose sources.
  if (plan.type === "no_space") throw new Error("Farm terrain migration has no free scenery destination");
  let next = farm;
  for (const move of plan.moves) {
    const old = objects.find(o => o.id === move.id)!;
    await transaction.update(farmObjects).set({ column: move.column, row: move.row }).where(eq(farmObjects.id, move.id));
    if (next.gatheringItemKey === "reed" && next.gatheringColumn === old.column && next.gatheringRow === old.row) {
      next = { ...next, gatheringColumn: move.column, gatheringRow: move.row };
    }
  }
  const [updated] = await transaction.update(farms).set({
    gatheringColumn: next.gatheringColumn, gatheringRow: next.gatheringRow,
    version: farm.version + 1, updatedAt: now
  }).where(eq(farms.id, farm.id)).returning();
  return updated ?? next;
};
