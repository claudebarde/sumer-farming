import { eq, sql } from "drizzle-orm";
import { advancePorter, type PorterStack } from "../../game-core/farm/porter";
import type { DatabaseTransaction } from "../db/client";
import { farmBuildings, farmInventory, farms } from "../db/schema";

export const advancePorterLifecycle = async (tx: DatabaseTransaction, farm: typeof farms.$inferSelect, now: Date, readyAt: Readonly<Record<string, number>> = {}) => {
  const porter = farm.production.porter;
  if (!porter || (!porter.job && porter.checkedAt >= porter.expiresAt)) return farm;
  const buildings = await tx.select().from(farmBuildings).where(eq(farmBuildings.farmId, farm.id));
  const stock = await tx.select().from(farmInventory).where(eq(farmInventory.farmId, farm.id));
  const stacks: PorterStack[] = [
    ...Object.entries(farm.production.pending).map(([buildingId, s]) => ({ ...s, buildingId, readyAt: readyAt[buildingId] ?? porter.checkedAt })),
    ...Object.entries(farm.millGoods.pending).flatMap(([buildingId, bags]) => (["flour", "brewersGroats"] as const).map(itemKey => ({ buildingId, itemKey, quantity: bags[itemKey], readyAt: readyAt[buildingId] ?? porter.checkedAt })))
  ];
  const inventory = Object.fromEntries(stock.map(s => [s.itemKey, s.quantity]));
  const reserved: Record<string, number> = { ...farm.millGoods.delivery?.bags };
  if (farm.production.delivery) reserved[farm.production.delivery.itemKey] = farm.production.delivery.quantity;
  const result = advancePorter({ porter, stacks, inventory, reserved,
    buildings: buildings.map(b => ({ ...b, completesAt: b.completesAt.getTime() })), roads: farm.roads, now: now.getTime() });
  for (const [itemKey, quantity] of Object.entries(result.inventory)) {
    if (quantity === inventory[itemKey]) continue;
    await tx.insert(farmInventory).values({ farmId: farm.id, itemKey: itemKey as "flour" | "brewersGroats" | "bread" | "beer", quantity })
      .onConflictDoUpdate({ target: [farmInventory.farmId, farmInventory.itemKey], set: { quantity, updatedAt: now } });
  }
  const pending = Object.fromEntries(result.stacks.filter(s => s.quantity > 0 && (s.itemKey === "bread" || s.itemKey === "beer")).map(s => [s.buildingId, { itemKey: s.itemKey as "bread" | "beer", quantity: s.quantity }]));
  const millPending: typeof farm.millGoods.pending = {};
  for (const s of result.stacks) if (s.quantity > 0 && (s.itemKey === "flour" || s.itemKey === "brewersGroats")) {
    millPending[s.buildingId] = { ...(millPending[s.buildingId] ?? { flour: 0, brewersGroats: 0 }), [s.itemKey]: s.quantity };
  }
  const changed = JSON.stringify(porter.job) !== JSON.stringify(result.porter.job) || JSON.stringify(inventory) !== JSON.stringify(result.inventory);
  const [updated] = await tx.update(farms).set({ production: { ...farm.production, pending, porter: result.porter }, millGoods: { ...farm.millGoods, pending: millPending },
    ...(changed ? { version: sql`${farms.version} + 1`, updatedAt: now } : {}) }).where(eq(farms.id, farm.id)).returning();
  return updated!;
};
