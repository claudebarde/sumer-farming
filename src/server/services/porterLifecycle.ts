import { eq, sql } from "drizzle-orm";
import { advancePorter, type PorterStack } from "../../game-core/farm/porter";
import type { DatabaseTransaction } from "../db/client";
import { farmBuildings, farmInventory, farms } from "../db/schema";
import { setStoredQuantity } from "./physicalStorage";
import { storedLocations } from "../../game-core/farm/physicalStorage";

export const advancePorterLifecycle = async (tx: DatabaseTransaction, farm: typeof farms.$inferSelect, now: Date, readyAt: Readonly<Record<string, number>> = {}) => {
  const porter = farm.production.porter;
  if (!porter || (!porter.job && !porter.returnTrip && porter.checkedAt >= porter.expiresAt)) return farm;
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
    locations: Object.fromEntries(stock.map(s => [s.itemKey, storedLocations(s, buildings, now.getTime())])),
    buildings: buildings.map(b => ({ ...b, completesAt: b.completesAt.getTime() })), roads: farm.roads, now: now.getTime() });
  for (const [itemKey, quantity] of Object.entries(result.inventory)) {
    if (quantity === inventory[itemKey]) continue;
    await setStoredQuantity(tx, farm.id, itemKey as "flour" | "brewersGroats" | "bread" | "beer" | "emptyBeerJar", quantity, now, undefined, result.locations[itemKey]);
  }
  for (const building of buildings) {
    const quantity = result.breweryJars[building.id];
    if (quantity !== undefined && quantity !== building.emptyBeerJars) {
      await tx.update(farmBuildings).set({ emptyBeerJars: quantity }).where(eq(farmBuildings.id, building.id));
    }
  }
  const pending = Object.fromEntries(result.stacks.filter(s => s.quantity > 0 && (s.itemKey === "bread" || s.itemKey === "beer")).map(s => [s.buildingId, { itemKey: s.itemKey as "bread" | "beer", quantity: s.quantity }]));
  const millPending: typeof farm.millGoods.pending = {};
  for (const s of result.stacks) if (s.quantity > 0 && (s.itemKey === "flour" || s.itemKey === "brewersGroats")) {
    millPending[s.buildingId] = { ...(millPending[s.buildingId] ?? { flour: 0, brewersGroats: 0 }), [s.itemKey]: s.quantity };
  }
  const changed = JSON.stringify({ ...porter, checkedAt: 0 }) !== JSON.stringify({ ...result.porter, checkedAt: 0 }) || JSON.stringify(inventory) !== JSON.stringify(result.inventory);
  const [updated] = await tx.update(farms).set({ production: { ...farm.production, pending, porter: result.porter }, millGoods: { ...farm.millGoods, pending: millPending },
    ...(changed ? { version: sql`${farms.version} + 1`, updatedAt: now } : {}) }).where(eq(farms.id, farm.id)).returning();
  return updated!;
};
