import type { FarmSnapshot } from "../../schemas/farm";
import { activeBuildingUpgrade } from "../../game-data/buildingUpgrades";
import { estateResourceCapacity } from "../../game-data/storage";
import { millStorageReserved } from "./millStorage";

/** Shared UI/server guard. The initial home is not a player-built building. */
export const buildingDemolitionReason = (snapshot: FarmSnapshot, buildingId: string, now: number): string | null => {
  const building = snapshot.buildings.find(b => b.id === buildingId);
  if (!building) return "This building cannot be destroyed.";
  if (Date.parse(building.completesAt) > now || activeBuildingUpgrade(snapshot.farm.production.buildingUpgrades, buildingId, now))
    return "Finish construction or upgrading first.";
  if (building.storedBarley > 0) return "Empty the building’s barley storage first.";
  const { farm } = snapshot;
  // Pending journeys may refer to a source, destination or route around buildings.
  if (farm.production.planting || farm.production.delivery || farm.millGoods.delivery || farm.production.materialDelivery ||
    farm.production.porter?.job || farm.gathering || farm.fishing || farm.milling ||
    Object.keys(farm.production.baking).length > 0 || (farm.production.cropWork && !farm.production.cropWork.settled))
    return "Finish active work and deliveries first.";
  if (building.beerReadyAt || (farm.production.pending[buildingId]?.quantity ?? 0) > 0 ||
    Object.values(farm.millGoods.pending[buildingId] ?? {}).some(quantity => quantity > 0))
    return "Finish production and collect the goods first.";
  if (building.type === "warehouse") {
    const remaining = snapshot.buildings.filter(b => b.id !== buildingId);
    if ((["flour", "brewersGroats"] as const).some(item =>
      (snapshot.inventory.find(entry => entry.itemKey === item)?.quantity ?? 0) + millStorageReserved(farm, item)
        > estateResourceCapacity(item, remaining, now)))
      return "Use or sell the mill goods that need warehouse storage first.";
    if (snapshot.inventory.some(item => item.quantity > estateResourceCapacity(item.itemKey, remaining, now)))
      return "Reduce stored goods to fit without the warehouse first.";
  }
  return null;
};

/** Remove only state owned by the demolished building; preserve payment history. */
export const withoutBuildingState = (snapshot: FarmSnapshot, buildingId: string) => {
  const omit = <T>(record: Readonly<Record<string, T>>) => Object.fromEntries(Object.entries(record).filter(([id]) => id !== buildingId));
  return {
    production: { ...snapshot.farm.production,
      pending: omit(snapshot.farm.production.pending),
      baking: omit(snapshot.farm.production.baking),
      buildingUpgrades: omit(snapshot.farm.production.buildingUpgrades ?? {}),
      shrineBlessing: snapshot.farm.production.shrineBlessing?.buildingId === buildingId ? null : snapshot.farm.production.shrineBlessing },
    millGoods: { ...snapshot.farm.millGoods, pending: omit(snapshot.farm.millGoods.pending) }
  };
};
