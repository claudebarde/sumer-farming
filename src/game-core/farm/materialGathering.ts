import type { FarmSnapshot } from "../../schemas/farm";
import type { FarmCoordinate } from "./irrigation";
import type { MaterialGathering } from "../../game-data/materialGathering";
import { materialGatheringReserved } from "../../game-data/materialGathering";
import { RESOURCE_DEFINITIONS, type GatherableResourceKey } from "../../game-data/resources";
import { INITIAL_FARM_CONFIG } from "../../game-data/initialFarm";
import { WORKER_MOVE_DURATION_PER_TILE } from "../../game-data/movement";
import { estateResourceCapacity } from "../../game-data/storage";
import { porterPath } from "./porter";
import { storageWarehouses, storedLocations, storageCapacity } from "./physicalStorage";
import { roadIsComplete } from "../../game-data/roads";
import { farmerMovementDurationMultiplier } from "./wellbeing";

export const gatheringRoom = (snapshot: FarmSnapshot, itemKey: GatherableResourceKey, now: number) => Math.max(0,
  estateResourceCapacity(itemKey, snapshot.buildings, now) - (snapshot.inventory.find(i => i.itemKey === itemKey)?.quantity ?? 0)
  - materialGatheringReserved(snapshot.farm.production.materialGathering, itemKey)
  - (snapshot.farm.production.materialReservation === itemKey ? 1 : 0));

/** One persisted itinerary, including split deposits. No visual callback advances work. */
export const planMaterialGathering = (snapshot: FarmSnapshot, itemKey: GatherableResourceKey, quantity: number,
  target: FarmCoordinate, now: number, hint?: FarmCoordinate): MaterialGathering | null => {
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > gatheringRoom(snapshot, itemKey, now)) return null;
  const buildings = snapshot.buildings.map(b => ({ ...b, completesAt: Date.parse(b.completesAt) }));
  const same = (a: FarmCoordinate, b: FarmCoordinate) => a.column === b.column && a.row === b.row;
  const roads = snapshot.farm.roads;
  const obstacles = [...snapshot.objects.filter(o => !same(o, target)),
    ...snapshot.improvements.filter(i => i.type === "irrigation" && !roads.some(r => same(r, i) && roadIsComplete(r, now))),
    ...roads.filter(r => !roadIsComplete(r, now))];
  const path = (a: FarmCoordinate, b: FarmCoordinate) => porterPath(buildings, roads, a, b, now, obstacles);
  const home = INITIAL_FARM_CONFIG.farmerSpawn;
  const from = hint && path(home, hint) ? hint : home;
  const approach = itemKey === "reed" && !same(from, target) ? path(from, { column: target.column, row: target.row - 1 }) : null;
  const outbound = approach ? [...approach, target] : path(from, target);
  if (!outbound) return null;
  const stepDurationMs = WORKER_MOVE_DURATION_PER_TILE * farmerMovementDurationMultiplier(snapshot.farm.household.happiness, snapshot.farm.household.hungrySince !== null, snapshot.farm.progression?.level ?? 1);
  const workStartsAt = now + Math.ceil((outbound.length - 1) * stepDurationMs);
  const workEndsAt = workStartsAt + quantity * RESOURCE_DEFINITIONS[itemKey].gatheringDurationMs;
  const locations = storedLocations(snapshot.inventory.find(i => i.itemKey === itemKey), buildings, now);
  const deliveries: MaterialGathering["deliveries"] = [];
  let remaining = quantity, cursor = workEndsAt, position = target;
  for (const storageId of [...storageWarehouses(buildings, now).map(b => b.id), "farm"]) {
    const amount = Math.min(remaining, Math.max(0, storageCapacity(itemKey, storageId) - (locations[storageId] ?? 0)));
    if (!amount) continue;
    const warehouse = buildings.find(b => b.id === storageId);
    const building = warehouse ?? { column: INITIAL_FARM_CONFIG.buildingBounds.minimumColumn, row: INITIAL_FARM_CONFIG.buildingBounds.minimumRow };
    const destination = warehouse?.loadingTile ?? (warehouse ? { column: warehouse.column, row: warehouse.row + 2 } : home);
    const route = path(position, destination);
    if (!route) return null;
    const completesAt = cursor + Math.ceil((route.length - 1) * stepDurationMs) + 600;
    deliveries.push({ storageId, building: { column: building.column, row: building.row }, quantity: amount, path: [...route], startedAt: cursor, completesAt, settled: false });
    remaining -= amount; cursor = completesAt; position = destination;
  }
  return remaining ? null : { itemKey, quantity, outbound: [...outbound], startedAt: now, workStartsAt, workEndsAt, completesAt: cursor, stepDurationMs, deliveries, settled: false };
};
