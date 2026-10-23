import type { FarmSnapshot } from "../../../schemas/farm";
import { INITIAL_FARM_CONFIG } from "../../../game-data/initialFarm";
import { estateResourceCapacity } from "../../../game-data/storage";
import { porterReserved, porterStorageReservation } from "../../../game-data/porter";
import { physicalDeliveryStop } from "../../../game-core/farm/physicalStorage";
import { plantingBlocker } from "./isometricPlanting";
import { pickupPath } from "./isometricPickup";
import { farmOrigin } from "./isometricFarm";
import type { IsoCell } from "./isometricProjection";
import { roadsideOutputPlacement } from "./buildingOutputPlacement";

export const millStorageBlocker = (snapshot: FarmSnapshot, id: string, now: number): string | null => {
  const bags = snapshot.farm.millGoods.pending[id];
  if (!bags || bags.flour + bags.brewersGroats <= 0) return "No finished goods to store";
  if (snapshot.farm.carriedItem) return "Empty your hands first";
  const busy = plantingBlocker(snapshot, now);
  if (busy) return busy;
  const shortages = (["flour", "brewersGroats"] as const).flatMap(item => {
    const room = Math.max(0,
      estateResourceCapacity(item, snapshot.buildings, now) -
      (snapshot.inventory.find(entry => entry.itemKey === item)?.quantity ?? 0) - porterReserved(snapshot.farm.production.porter, item));
    return bags[item] > room ? [`${item === "flour" ? "Flour" : "Brewer's groats"}: ${room} ${room === 1 ? "space" : "spaces"} free, ${bags[item]} needed`] : [];
  });
  return shortages.length ? `Not enough storage: ${shortages.join("; ")}. Use or sell stored goods first.` : null;
};
export const canPickupMillBags = (snapshot: FarmSnapshot, id: string, now: number) => millStorageBlocker(snapshot, id, now) === null;

export const millPickupPath = (snapshot: FarmSnapshot, id: string, from: IsoCell, now: number) => {
  const mill = snapshot.buildings.find(b => b.id === id && b.type === "mill");
  if (!mill) return null;
  const stop = roadsideOutputPlacement(mill, snapshot.farm.roads, now).pickup;
  return stop ? pickupPath(snapshot, from, stop, now) : null;
};

export const millDeliveryDestination = (snapshot: FarmSnapshot, from: IsoCell, now: number) => {
  const delivery = snapshot.farm.millGoods.delivery;
  if (!delivery) return null;
  const warehouse = snapshot.buildings.find(b => b.type === "warehouse" && Date.parse(b.completesAt) <= now);
  const useWarehouse = (["flour", "brewersGroats"] as const).some(item => delivery.bags[item] > 0 &&
    physicalDeliveryStop(item, snapshot.inventory.find(entry => entry.itemKey === item), snapshot.buildings, now,
      porterStorageReservation(snapshot.farm.production.porter, item)).location === "warehouse");
  const building = useWarehouse ? warehouse! : farmOrigin;
  const target = useWarehouse ? warehouse!.loadingTile ?? { column: warehouse!.column, row: warehouse!.row + 2 } : INITIAL_FARM_CONFIG.farmerSpawn;
  const path = pickupPath(snapshot, from, target, now);
  return path ? { path, building } : null;
};
