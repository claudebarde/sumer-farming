import { ESTATE_STORAGE_LIMITS, WAREHOUSE_RESOURCE_BONUS, granaryCapacityForLevel } from "../../game-data/storage";

export const barleyDeliveryBuilding = <T extends { type: string; completesAt: string; storedBarley: number }>(buildings: readonly T[], level: number, now: number): T | undefined =>
  (["granary", "warehouse"] as const).flatMap(type => buildings.filter(b => b.type === type && Date.parse(b.completesAt) <= now))
    .find(b => b.storedBarley < (b.type === "warehouse" ? 20 : granaryCapacityForLevel(level)));

/** One delivery stop, using the same warehouse-first allocation as stock displays. */
export const sharedDeliveryStop = (item: string, stored: number, warehouseComplete: boolean) => {
  const base = item === "fish" ? 5 : ESTATE_STORAGE_LIMITS[item as keyof typeof ESTATE_STORAGE_LIMITS] ?? 0;
  const warehouse = warehouseComplete && item in ESTATE_STORAGE_LIMITS;
  return warehouse && stored < WAREHOUSE_RESOURCE_BONUS
    ? { location: "warehouse" as const, room: WAREHOUSE_RESOURCE_BONUS - stored }
    : { location: "farm" as const, room: Math.max(0, base + (warehouse ? WAREHOUSE_RESOURCE_BONUS : 0) - stored) };
};
