import type { FarmSnapshot } from "../../../schemas/farm";
import { FARM_STORAGE_CAPACITY, granaryCapacityForLevel } from "../../../game-data/storage";
import { INITIAL_FARM_CONFIG } from "../../../game-data/initialFarm";
import type { IsoCell } from "./isometricProjection";
import { pickupPath } from "./isometricPickup";

type Destination = { type: "farm"; room: number; loading: IsoCell } |
  { type: "granary"; room: number; loading: IsoCell; target: IsoCell };

/** Prefer a granary that fits the load, then the farm; otherwise store what fits. */
export const barleyStoragePlan = (snapshot: FarmSnapshot, from: IsoCell, now: number, granaryId?: string) => {
  const carried = snapshot.farm.carriedItem;
  const quantity = carried?.itemKey === "barley" ? carried.quantity : 0;
  const granaries: Destination[] = snapshot.buildings
    .filter(b => b.type === "granary" && Date.parse(b.completesAt) <= now && (granaryId === undefined || b.id === granaryId))
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(b => ({ type: "granary", target: { column: b.column, row: b.row },
      loading: b.loadingTile ?? { column: b.column, row: b.row + 2 },
      room: Math.max(0, granaryCapacityForLevel(snapshot.farm.progression?.level ?? 1) - b.storedBarley) }));
  const farm: Destination = { type: "farm", loading: INITIAL_FARM_CONFIG.farmerSpawn,
    room: Math.max(0, FARM_STORAGE_CAPACITY - snapshot.inventory.filter(i => i.itemKey === "barley").reduce((sum, i) => sum + i.quantity, 0)) };
  const candidates = (granaryId === undefined ? [...granaries, farm] : granaries).filter(d => d.room > 0);
  const ordered = [...candidates.filter(d => d.room >= quantity), ...candidates.filter(d => d.room < quantity)];
  const plans = ordered.flatMap(destination => {
    const path = pickupPath(snapshot, from, destination.loading, now);
    return path ? [{ destination, path }] : [];
  });
  return { hasStorage: candidates.length > 0, plan: quantity > 0 ? plans[0] ?? null : null };
};
