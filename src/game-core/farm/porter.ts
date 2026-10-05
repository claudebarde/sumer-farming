import { PORTER_STEP_MS, type Porter, type PorterItem } from "../../game-data/porter";
import { INITIAL_FARM_CONFIG } from "../../game-data/initialFarm";
import { getBuildingFootprint } from "./buildings";
import type { FarmBuildingType } from "../../game-data/buildings";
import { findRoadPreferredPath } from "./roadPath";
import { sharedDeliveryStop } from "./storageDelivery";
import type { FarmRoad } from "../../game-data/roads";

type Position = { column: number; row: number };
export type PorterBuilding = Position & { id: string; type: FarmBuildingType; completesAt: number; loadingTile: Position | null };
export type PorterStack = { buildingId: string; itemKey: PorterItem; quantity: number; readyAt: number };
export const PORTER_HOME: Position = { column: 3, row: INITIAL_FARM_CONFIG.roadRow };

/** Persist the actual road-preferred route, so offline deadlines and animation agree. */
export const porterPath = (buildings: readonly PorterBuilding[], roads: readonly FarmRoad[], from: Position, to: Position, now: number): readonly Position[] | null => {
  const bounds = INITIAL_FARM_CONFIG.worldBounds;
  const local = (p: Position) => ({ column: p.column - bounds.minimumColumn, row: p.row });
  const key = (p: Position) => `${p.column}:${p.row}`;
  const blocked = buildings.flatMap(b => getBuildingFootprint(b.type, b));
  const home = INITIAL_FARM_CONFIG.buildingBounds;
  for (let row = home.minimumRow; row <= home.maximumRow; row++) for (let column = home.minimumColumn; column <= home.maximumColumn; column++) blocked.push({ column, row });
  const roadTiles = roads.filter(r => (r.completesAt ?? 0) <= now).map(local);
  for (let column = bounds.minimumColumn; column <= bounds.maximumColumn; column++) {
    blocked.push({ column, row: INITIAL_FARM_CONFIG.riverRow });
    roadTiles.push(local({ column, row: INITIAL_FARM_CONFIG.roadRow }));
  }
  return findRoadPreferredPath(local(from), local(to), { columns: bounds.maximumColumn - bounds.minimumColumn + 1, rows: bounds.maximumRow + 1 }, new Set(blocked.map(p => key(local(p)))), new Set(roadTiles.map(key)))?.map(p => ({ column: p.column + bounds.minimumColumn, row: p.row })) ?? null;
};

export const advancePorter = (input: {
  porter: Porter; stacks: readonly PorterStack[]; inventory: Readonly<Record<string, number>>;
  reserved: Readonly<Record<string, number>>; buildings: readonly PorterBuilding[]; roads: readonly FarmRoad[]; now: number;
}) => {
  let porter = { ...input.porter };
  let stacks = input.stacks.map(s => ({ ...s }));
  const inventory = { ...input.inventory };
  let cursor = porter.checkedAt;
  // Each trip consumes a positive stack quantity, making catch-up finite.
  while (true) {
    if (porter.job) {
      if (porter.job.completesAt > input.now) break;
      const job = porter.job;
      inventory[job.itemKey] = (inventory[job.itemKey] ?? 0) + job.quantity;
      cursor = job.completesAt;
      porter = { ...porter, position: job.path[job.path.length - 1]!, job: null };
    }
    if (cursor >= porter.expiresAt) break;
    const candidates = stacks.filter(s => s.quantity > 0).sort((a, b) => a.readyAt - b.readyAt || a.buildingId.localeCompare(b.buildingId) || a.itemKey.localeCompare(b.itemKey));
    const next = candidates.flatMap(stack => {
      const startedAt = Math.max(cursor, stack.readyAt, porter.hiredAt);
      if (startedAt >= porter.expiresAt || startedAt > input.now) return [];
      const source = input.buildings.find(b => b.id === stack.buildingId && b.completesAt <= startedAt);
      if (!source) return [];
      const warehouse = input.buildings.find(b => b.type === "warehouse" && b.completesAt <= startedAt);
      const stop = sharedDeliveryStop(stack.itemKey, (inventory[stack.itemKey] ?? 0) + (input.reserved[stack.itemKey] ?? 0), !!warehouse);
      const quantity = Math.min(stack.quantity, stop.room);
      if (quantity <= 0) return [];
      const pickup = source.loadingTile ?? { column: source.column, row: source.row + 2 };
      const destination = stop.location === "warehouse" && warehouse ? warehouse.loadingTile ?? { column: warehouse.column, row: warehouse.row + 2 } : INITIAL_FARM_CONFIG.farmerSpawn;
      const outbound = porterPath(input.buildings, input.roads, porter.position, pickup, startedAt);
      const inbound = porterPath(input.buildings, input.roads, pickup, destination, startedAt);
      if (!outbound || !inbound) return [];
      const path = [...outbound, ...inbound.slice(1)];
      const pickupIndex = outbound.length - 1;
      return [{ stack, job: { buildingId: stack.buildingId, itemKey: stack.itemKey, quantity, startedAt, pickupAt: startedAt + pickupIndex * PORTER_STEP_MS, completesAt: startedAt + Math.max(1, path.length - 1) * PORTER_STEP_MS + 1000, path, pickupIndex } }];
    })[0];
    if (!next) break;
    stacks = stacks.map(s => s.buildingId === next.stack.buildingId && s.itemKey === next.stack.itemKey ? { ...s, quantity: s.quantity - next.job.quantity } : s);
    porter = { ...porter, job: next.job };
  }
  return { porter: { ...porter, checkedAt: input.now }, stacks, inventory };
};
