import type { FarmSnapshot } from "../../../schemas/farm";
import { INITIAL_FARM_CONFIG } from "../../../game-data/initialFarm";
import { estateResourceCapacity } from "../../../game-data/storage";
import { porterReserved } from "../../../game-data/porter";
import { sharedDeliveryStop } from "../../../game-core/farm/storageDelivery";
import { plantingBlocker } from "./isometricPlanting";
import { pickupPath } from "./isometricPickup";
import { farmOrigin } from "./isometricFarm";
import type { IsoCell } from "./isometricProjection";
import { roadsideOutputPlacement } from "./buildingOutputPlacement";

export const canPickupMillBags = (snapshot: FarmSnapshot, id: string, now: number) => {
  const bags = snapshot.farm.millGoods.pending[id];
  return !!bags && !snapshot.farm.carriedItem && !plantingBlocker(snapshot, now) &&
    (["flour", "brewersGroats"] as const).some(item => bags[item] > 0 &&
      estateResourceCapacity(item, snapshot.buildings, now) >
      (snapshot.inventory.find(entry => entry.itemKey === item)?.quantity ?? 0) + porterReserved(snapshot.farm.production.porter, item));
};

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
    sharedDeliveryStop(item, (snapshot.inventory.find(entry => entry.itemKey === item)?.quantity ?? 0)
      + porterReserved(snapshot.farm.production.porter, item), !!warehouse).location === "warehouse");
  const building = useWarehouse ? warehouse! : farmOrigin;
  const target = useWarehouse ? warehouse!.loadingTile ?? { column: warehouse!.column, row: warehouse!.row + 2 } : INITIAL_FARM_CONFIG.farmerSpawn;
  const path = pickupPath(snapshot, from, target, now);
  return path ? { path, building } : null;
};
