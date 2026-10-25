import { PORTER_STEP_MS, type Porter, type PorterItem } from "../../game-data/porter";
import { INITIAL_FARM_CONFIG } from "../../game-data/initialFarm";
import { FARM_MARKET_FOOTPRINT, FARM_MARKET_ENTRANCE } from "../../game-data/farmMarket";
import { getBuildingFootprint } from "./buildings";
import type { FarmBuildingType } from "../../game-data/buildings";
import { findRoadPreferredPath } from "./roadPath";
import { changeStorageLocations, physicalDeliveryStop, physicalStorageItem, storedLocations, type StorageLocations } from "./physicalStorage";
import type { FarmRoad } from "../../game-data/roads";
import { roadIsComplete } from "../../game-data/roads";
import { roadsideOutputPlacement } from "./roadsideOutputPlacement";
import { BREWERY_EMPTY_JAR_CAPACITY } from "../../game-data/brewing";

type Position = { column: number; row: number };
export type PorterBuilding = Position & { id: string; type: FarmBuildingType; completesAt: number; loadingTile: Position | null; emptyBeerJars?: number };
export type PorterStack = { buildingId: string; itemKey: PorterItem; quantity: number; readyAt: number };
export const PORTER_HOME: Position = { column: 3, row: INITIAL_FARM_CONFIG.roadRow };
export const PORTER_MARKET: Position = FARM_MARKET_ENTRANCE;

export const porterRoadRemovalReason = (porter: Porter | null | undefined, target: Position): string | null => {
  const path = porter?.job?.path ?? porter?.returnTrip?.path ?? [];
  return path.some(p => p.column === target.column && p.row === target.row)
    ? "The porter is using this road for a delivery or return trip. Wait until he finishes." : null;
};

/** Persist the actual road-preferred route, so offline deadlines and animation agree. */
export const porterPath = (buildings: readonly PorterBuilding[], roads: readonly FarmRoad[], from: Position, to: Position, now: number, obstacles: readonly Position[] = [], roadsOnly = false): readonly Position[] | null => {
  const bounds = INITIAL_FARM_CONFIG.worldBounds;
  const local = (p: Position) => ({ column: p.column - bounds.minimumColumn, row: p.row });
  const key = (p: Position) => `${p.column}:${p.row}`;
  const blocked = [...buildings.flatMap(b => getBuildingFootprint(b.type, b)), ...FARM_MARKET_FOOTPRINT, ...obstacles];
  const home = INITIAL_FARM_CONFIG.buildingBounds;
  for (let row = home.minimumRow; row <= home.maximumRow; row++) for (let column = home.minimumColumn; column <= home.maximumColumn; column++) blocked.push({ column, row });
  const roadTiles = roads.filter(r => roadIsComplete(r, now)).map(local);
  for (let column = bounds.minimumColumn; column <= bounds.maximumColumn; column++) {
    blocked.push({ column, row: INITIAL_FARM_CONFIG.riverRow });
    roadTiles.push(local({ column, row: INITIAL_FARM_CONFIG.roadRow }));
  }
  const roadKeys = new Set(roadTiles.map(key));
  if (roadsOnly) {
    if (!roadKeys.has(key(local(from))) || !roadKeys.has(key(local(to)))) return null;
    for (let column = bounds.minimumColumn; column <= bounds.maximumColumn; column++) for (let row = 0; row <= bounds.maximumRow; row++) {
      if (!roadKeys.has(key(local({ column, row })))) blocked.push({ column, row });
    }
  }
  return findRoadPreferredPath(local(from), local(to), { columns: bounds.maximumColumn - bounds.minimumColumn + 1, rows: bounds.maximumRow + 1 }, new Set(blocked.map(p => key(local(p)))), roadKeys)?.map(p => ({ column: p.column + bounds.minimumColumn, row: p.row })) ?? null;
};

/** Strict porter routing, separate from the road-preferred helper used by farmer jobs. */
export const porterRoadPath = (buildings: readonly PorterBuilding[], roads: readonly FarmRoad[], from: Position, to: Position, now: number) =>
  porterPath(buildings, roads, from, to, now, [], true);

export const advancePorter = (input: {
  porter: Porter; stacks: readonly PorterStack[]; inventory: Readonly<Record<string, number>>;
  reserved: Readonly<Record<string, number>>; buildings: readonly PorterBuilding[]; roads: readonly FarmRoad[]; now: number;
  locations?: Readonly<Record<string, StorageLocations>>;
}) => {
  let porter = { ...input.porter };
  let stacks = input.stacks.map(s => ({ ...s }));
  const inventory = { ...input.inventory };
  const locations = Object.fromEntries(Object.entries(inventory).filter(([item]) => physicalStorageItem(item))
    .map(([itemKey, quantity]) => [itemKey, input.locations?.[itemKey] ?? storedLocations({ itemKey, quantity }, input.buildings, input.now)]));
  const breweryJars = Object.fromEntries(input.buildings.filter(b => b.type === "brewery").map(b => [b.id, b.emptyBeerJars ?? 0]));
  let cursor = porter.checkedAt;
  const returnToMarket = () => {
    const path = porterRoadPath(input.buildings, input.roads, porter.position, porter.home ?? PORTER_MARKET, cursor);
    if (!path || path.length <= 1) return false;
    porter = { ...porter, returnTrip: { path: [...path], startedAt: cursor, completesAt: cursor + (path.length - 1) * PORTER_STEP_MS } };
    return true;
  };
  // Each trip consumes a positive stack quantity, making catch-up finite.
  while (true) {
    if (porter.returnTrip) {
      if (porter.returnTrip.completesAt > input.now) break;
      cursor = porter.returnTrip.completesAt;
      porter = { ...porter, position: porter.returnTrip.path.at(-1)!, returnTrip: null };
    }
    if (porter.job) {
      if (porter.job.completesAt > input.now) break;
      const job = porter.job;
      if (job.itemKey === "emptyBeerJar") {
        const room = job.buildingId in breweryJars ? Math.max(0, BREWERY_EMPTY_JAR_CAPACITY - breweryJars[job.buildingId]!) : 0;
        const delivered = Math.min(room, job.quantity);
        if (delivered > 0) breweryJars[job.buildingId] += delivered;
        // A manual delivery can fill the brewery while this trip is underway.
        inventory.emptyBeerJar = (inventory.emptyBeerJar ?? 0) + job.quantity - delivered;
      } else {
        locations[job.itemKey] = changeStorageLocations(job.itemKey, locations[job.itemKey] ?? {}, job.quantity,
          input.buildings, job.completesAt, job.storageId);
        inventory[job.itemKey] = (inventory[job.itemKey] ?? 0) + job.quantity;
      }
      cursor = job.completesAt;
      porter = { ...porter, position: job.path[job.path.length - 1]!, job: null };
    }
    if (cursor >= porter.expiresAt) {
      if (returnToMarket()) continue;
      break;
    }
    const candidates = stacks.filter(s => s.quantity > 0).sort((a, b) => a.readyAt - b.readyAt || a.buildingId.localeCompare(b.buildingId) || a.itemKey.localeCompare(b.itemKey));
    const next = candidates.flatMap(stack => {
      const startedAt = Math.max(cursor, stack.readyAt, porter.hiredAt);
      if (startedAt >= porter.expiresAt || startedAt > input.now) return [];
      const source = input.buildings.find(b => b.id === stack.buildingId && b.completesAt <= startedAt);
      if (!source) return [];
      const warehouse = input.buildings.find(b => b.type === "warehouse" && b.completesAt <= startedAt);
      const stop = physicalDeliveryStop(stack.itemKey, { itemKey: stack.itemKey, quantity: inventory[stack.itemKey] ?? 0, locations: locations[stack.itemKey] ?? {} }, input.buildings, startedAt, input.reserved[stack.itemKey] ?? 0);
      const quantity = Math.min(stack.quantity, stop.room);
      if (quantity <= 0) return [];
      const pickup = source.type === "brewery" ? source.loadingTile : roadsideOutputPlacement(source, input.roads, startedAt).pickup;
      if (!pickup) return [];
      const destination = stop.location === "warehouse" && warehouse ? warehouse.loadingTile ?? { column: warehouse.column, row: warehouse.row + 2 } : INITIAL_FARM_CONFIG.farmerSpawn;
      const outbound = porterRoadPath(input.buildings, input.roads, porter.position, pickup, startedAt);
      const inbound = porterRoadPath(input.buildings, input.roads, pickup, destination, startedAt);
      if (!outbound || !inbound) return [];
      const path = [...outbound, ...inbound.slice(1)];
      const pickupIndex = outbound.length - 1;
      return [{ stack, job: { buildingId: stack.buildingId, itemKey: stack.itemKey, quantity, storageId: stop.storageId, startedAt, pickupAt: startedAt + pickupIndex * PORTER_STEP_MS, completesAt: startedAt + Math.max(1, path.length - 1) * PORTER_STEP_MS + 1000, path, pickupIndex } }];
    })[0];
    if (!next) {
      // Only idle capacity is used for supplies; every reachable storage job wins.
      const startedAt = Math.max(cursor, porter.hiredAt);
      if (startedAt >= porter.expiresAt || startedAt > input.now) break;
      const supply = input.buildings.flatMap(building => {
        if (building.type !== "brewery" || building.completesAt > startedAt || !building.loadingTile) return [];
        const quantity = Math.min(Math.max(0, BREWERY_EMPTY_JAR_CAPACITY - breweryJars[building.id]!), inventory.emptyBeerJar ?? 0);
        if (quantity <= 0) return [];
        const outbound = porterRoadPath(input.buildings, input.roads, porter.position, INITIAL_FARM_CONFIG.farmerSpawn, startedAt);
        const inbound = porterRoadPath(input.buildings, input.roads, INITIAL_FARM_CONFIG.farmerSpawn, building.loadingTile, startedAt);
        if (!outbound || !inbound) return [];
        const path = [...outbound, ...inbound.slice(1)];
        const pickupIndex = outbound.length - 1;
        return [{ buildingId: building.id, itemKey: "emptyBeerJar" as const, quantity, startedAt,
          pickupAt: startedAt + pickupIndex * PORTER_STEP_MS,
          completesAt: startedAt + Math.max(1, path.length - 1) * PORTER_STEP_MS + 1000, path, pickupIndex }];
      })[0];
      if (!supply) {
        if (returnToMarket()) continue;
        break;
      }
      inventory.emptyBeerJar -= supply.quantity;
      porter = { ...porter, job: supply };
      continue;
    }
    stacks = stacks.map(s => s.buildingId === next.stack.buildingId && s.itemKey === next.stack.itemKey ? { ...s, quantity: s.quantity - next.job.quantity } : s);
    porter = { ...porter, job: next.job };
  }
  return { porter: { ...porter, checkedAt: input.now }, stacks, inventory, breweryJars, locations };
};
