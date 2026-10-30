import { ESTATE_STORAGE_LIMITS, WAREHOUSE_SESAME_BASKET_CAPACITY, WAREHOUSE_DATE_BASKET_CAPACITY, WAREHOUSE_RESOURCE_BONUS } from "../../game-data/storage";

export type StorageLocations = Readonly<Record<string, number>>;
export type StorageBuilding = { id: string; type: string; completesAt: string | Date | number };
export const physicalStorageItem = (item: string) => item in ESTATE_STORAGE_LIMITS || item === "dates" || item === "sesame";
export const storageCapacity = (item: string, location: string) => location === "farm"
  ? ESTATE_STORAGE_LIMITS[item as keyof typeof ESTATE_STORAGE_LIMITS] ?? 0
  : item === "sesame" ? WAREHOUSE_SESAME_BASKET_CAPACITY : item === "dates" ? WAREHOUSE_DATE_BASKET_CAPACITY : physicalStorageItem(item) ? WAREHOUSE_RESOURCE_BONUS : 0;
export const storageWarehouses = (buildings: readonly StorageBuilding[], now: number) => buildings
  .filter(b => b.type === "warehouse" && new Date(b.completesAt).getTime() <= now).sort((a, b) => a.id.localeCompare(b.id));

/** One-time legacy allocation. Construction never moves already located stock. */
export const initialStorageLocations = (item: string, quantity: number, buildings: readonly StorageBuilding[], now: number): StorageLocations => {
  const farm = (item === "dates" || item === "sesame") ? 0 : Math.min(quantity, storageCapacity(item, "farm"));
  const warehouse = storageWarehouses(buildings, now)[0];
  return warehouse ? { farm, [warehouse.id]: quantity - farm } : { farm: quantity };
};

export const storedLocations = (entry: { itemKey: string; quantity: number; locations?: StorageLocations | null } | undefined,
  buildings: readonly StorageBuilding[], now: number): StorageLocations => entry
  ? entry.locations ?? initialStorageLocations(entry.itemKey, entry.quantity, buildings, now) : {};

/** Warehouse first for new deposits; farm first for shared spending. */
export const changeStorageLocations = (item: string, locations: StorageLocations, delta: number,
  buildings: readonly StorageBuilding[], now: number, destination?: string, reserved: StorageLocations = {}): StorageLocations => {
  if (delta > 0 && item === "sesame" && destination && !storageWarehouses(buildings, now).some(b => b.id === destination))
    throw new Error("Sesame needs a completed warehouse.");
  const next = { ...locations };
  let remaining = Math.abs(delta);
  const order = delta < 0 ? ["farm", ...Object.keys(next).filter(k => k !== "farm").sort()]
    : destination ? [destination] : [...storageWarehouses(buildings, now).map(b => b.id), ...((item === "dates" || item === "sesame") ? [] : ["farm"])];
  for (const location of order) {
    if (!remaining) break;
    const stored = next[location] ?? 0;
    const quantity = Math.min(remaining, delta < 0 ? stored : Math.max(0, storageCapacity(item, location) - stored - (reserved[location] ?? 0)));
    next[location] = stored + (delta < 0 ? -quantity : quantity);
    remaining -= quantity;
  }
  if (remaining) throw new Error(delta < 0 ? "Not enough stored goods." : "Not enough space at the storage destination.");
  return next;
};

export const physicalDeliveryStop = (item: string, entry: { itemKey: string; quantity: number; locations?: StorageLocations | null } | undefined,
  buildings: readonly StorageBuilding[], now: number, reserved: number | { quantity: number; storageId?: string } = 0) => {
  const locations = storedLocations(entry, buildings, now);
  const reservedLocation = typeof reserved === "number" ? undefined : reserved.storageId;
  let reservation = typeof reserved === "number" ? reserved : reserved.quantity;
  for (const location of [...storageWarehouses(buildings, now).map(b => b.id), ...((item === "dates" || item === "sesame") ? [] : ["farm"])]) {
    const free = Math.max(0, storageCapacity(item, location) - (locations[location] ?? 0));
    const room = Math.max(0, free - (reservedLocation && reservedLocation !== location ? 0 : reservation));
    if (!reservedLocation) reservation = Math.max(0, reservation - free);
    if (room > 0) return { location: location === "farm" ? "farm" as const : "warehouse" as const, storageId: location, room };
  }
  return { location: "farm" as const, storageId: "farm", room: 0 };
};
