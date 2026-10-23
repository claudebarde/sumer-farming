import type { FarmSnapshot } from "../../../schemas/farm";
import { FARM_STORAGE_CAPACITY, granaryCapacityForLevel } from "../../../game-data/storage";
import { INITIAL_FARM_CONFIG } from "../../../game-data/initialFarm";
import type { IsoCell } from "./isometricProjection";
import { pickupPath } from "./isometricPickup";
import { physicalDeliveryStop } from "../../../game-core/farm/physicalStorage";
import { farmOrigin } from "./isometricFarm";

export const materialStoragePlan = (snapshot: FarmSnapshot, from: IsoCell, now: number) => {
  const item = snapshot.farm.carriedItem?.itemKey;
  if (item !== "reed" && item !== "clay") return null;
  const stop = physicalDeliveryStop(item, snapshot.inventory.find(i => i.itemKey === item), snapshot.buildings, now);
  if (!stop.room) return null;
  const warehouse = snapshot.buildings.find(b => b.id === stop.storageId);
  const building = warehouse ?? farmOrigin;
  const target = warehouse?.loadingTile ?? (warehouse ? { column: warehouse.column, row: warehouse.row + 2 } : INITIAL_FARM_CONFIG.farmerSpawn);
  const path = pickupPath(snapshot, from, target, now);
  return path ? { path, building } : null;
};

type Destination = { type: "farm"; room: number; loading: IsoCell } |
  { type: "granary"; room: number; loading: IsoCell; target: IsoCell };

/** Fill granary, warehouse, then farm, splitting the load between stops. */
export const barleyStoragePlan = (snapshot: FarmSnapshot, from: IsoCell, now: number, granaryId?: string) => {
  const carried = snapshot.farm.carriedItem;
  const quantity = carried?.itemKey === "barley" ? carried.quantity : 0;
  const granaries: Destination[] = snapshot.buildings
    .filter(b => (b.type === "granary" || b.type === "warehouse") && Date.parse(b.completesAt) <= now && (granaryId === undefined || b.id === granaryId))
    .sort((a, b) => Number(a.type === "warehouse") - Number(b.type === "warehouse") || a.id.localeCompare(b.id))
    .map(b => ({ type: "granary", target: { column: b.column, row: b.row },
      loading: b.loadingTile ?? { column: b.column, row: b.row + 2 },
      room: Math.max(0, (b.type === "warehouse" ? 20 : granaryCapacityForLevel(snapshot.farm.progression?.level ?? 1)) - b.storedBarley) }));
  const farm: Destination = { type: "farm", loading: INITIAL_FARM_CONFIG.farmerSpawn,
    room: Math.max(0, FARM_STORAGE_CAPACITY - snapshot.inventory.filter(i => i.itemKey === "barley").reduce((sum, i) => sum + i.quantity, 0)) };
  const candidates = (granaryId === undefined ? [...granaries, farm] : granaries).filter(d => d.room > 0);
  const plans = candidates.flatMap(destination => {
    const path = pickupPath(snapshot, from, destination.loading, now);
    return path ? [{ destination, path }] : [];
  });
  return { hasStorage: candidates.length > 0, plan: quantity > 0 ? plans[0] ?? null : null };
};
