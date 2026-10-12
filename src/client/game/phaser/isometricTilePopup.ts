import type { FarmSnapshot } from "../../../schemas/farm";
import { plantableFields, harvestableFields, plantingSelectionLimit } from "../../../game-core/farm/batchPlanting";
import { FARMER_CARRY_CAPACITY, granaryCapacityForLevel } from "../../../game-data/storage";
import { buildingAt, buildingNames, farmOrigin, insidePlot, sameCell, tileInformation } from "./isometricFarm";
import { footprintContains, type IsoCell } from "./isometricProjection";
import { plantingBlocker } from "./isometricPlanting";
import { harvestingBlocker } from "./isometricHarvesting";
import { irrigationBuildBlocker } from "./isometricIrrigation";
import { INITIAL_FARM_CONFIG } from "../../../game-data/initialFarm";
import { roadBuildBlocker } from "./isometricRoads";
import { previewWalkable } from "./isometricWalking";
import { gatherableResource, transferBlocker } from "./isometricGathering";
import { buildingLevel } from "../../../game-data/buildingUpgrades";

/** The farmer currently has popup content only when carrying barley. */
export const hasFarmerPopup = (snapshot: FarmSnapshot): boolean =>
  snapshot.farm.carriedItem?.itemKey === "barley" && snapshot.farm.carriedItem.quantity > 0;

export const isometricTilePopup = (snapshot: FarmSnapshot, cell: IsoCell, now: number) => {
  const building = buildingAt(snapshot, cell);
  const crop = snapshot.crops.find(c => sameCell(c, cell));
  const home = !building && footprintContains(farmOrigin, 2, 2, cell);
  const level = home ? snapshot.farm.progression?.level ?? 1
    : building?.type === "granary" ? buildingLevel(snapshot.farm.production.buildingUpgrades, building.id, now) : null;
  const plantable = plantableFields(snapshot, now);
  const ripe = harvestableFields(snapshot, now);
  const canPlantHere = plantable.some(p => sameCell(p, cell));
  const canHarvestHere = ripe.some(p => sameCell(p, cell));
  const title = building ? buildingNames[building.type] : home ? "Farm" : tileInformation(snapshot, cell, now).split(" · ")[0]!;
  const details: string[] = [];
  if (crop) {
    const end = crop.harvestCompletesAt ?? (Date.parse(crop.plantedAt) > now ? crop.plantedAt : crop.growthCompletesAt);
    details.push(crop.harvestCompletesAt ? "Harvesting…" : Date.parse(crop.plantedAt) > now ? "Sowing…" : Date.parse(end) > now ? `Ready in ${Math.max(1, Math.ceil((Date.parse(end) - now) / 60_000))}m` : "Ready to harvest");
  } else if (building) {
    if (Date.parse(building.completesAt) > now) details.push("Under construction");
    else if (building.type === "granary") details.push(`${building.storedBarley} / ${granaryCapacityForLevel(snapshot.farm.progression?.level ?? 1)} barley stored`);
  } else if (!home) {
    details.push(...tileInformation(snapshot, cell, now).split(" · ").slice(1));
  }
  if (snapshot.farm.carriedItem) details.push(`Carrying ${snapshot.farm.carriedItem.quantity} ${snapshot.farm.carriedItem.itemKey}`);
  const plant = home || canPlantHere;
  const harvest = home || canHarvestHere;
  const plantDisabled = plantingBlocker(snapshot, now) ?? (plantingSelectionLimit(snapshot, now) === 0 ? "No barley seeds" : !plantable.length ? "No irrigated fields" : null);
  const harvestDisabled = harvestingBlocker(snapshot, now) ?? (!ripe.length ? "No ripe barley" : null);
  const drop = title === "Arable ground" && insidePlot(cell) &&
    !snapshot.groundItems.some(item => sameCell(item, cell)) &&
    !!snapshot.farm.carriedItem && ["barley", "reed", "clay"].includes(snapshot.farm.carriedItem.itemKey) && snapshot.farm.carriedItem.quantity > 0;
  const dropDisabled = transferBlocker(snapshot, now);
  const groundItem = snapshot.groundItems.find(item => sameCell(item, cell));
  const pickup = snapshot.groundItems.some(item => sameCell(item, cell) && ["barley", "reed", "clay"].includes(item.itemKey) && item.quantity > 0 &&
    (item.expiresAt === null || Date.parse(item.expiresAt) > now));
  const pickupDisabled = transferBlocker(snapshot, now) ??
    (snapshot.farm.carriedItem && snapshot.farm.carriedItem.itemKey !== groundItem?.itemKey ? "Empty your hands first" : null) ??
    ((snapshot.farm.carriedItem?.quantity ?? 0) >= FARMER_CARRY_CAPACITY ? "Hands full" : null);
  const irrigation = cell.row < INITIAL_FARM_CONFIG.riverRow && ["Arable ground", "Ground", "Rocks", "Bush"].includes(title);
  const irrigationDisabled = irrigationBuildBlocker(snapshot, cell, now);
  const road = irrigation;
  const roadDisabled = roadBuildBlocker(snapshot, cell, now);
  const actions = {
    gather: gatherableResource(snapshot, cell, now),
    pickup: pickup && !pickupDisabled,
    irrigation: irrigation && !irrigationDisabled,
    road: road && !roadDisabled,
    drop: drop && !dropDisabled,
    plant: plant && !plantDisabled,
    harvest: harvest && !harvestDisabled,
    walk: previewWalkable(snapshot, cell, now) && !transferBlocker(snapshot, now),
  };
  return { title, level, details, building, home, groundItem, plant, harvest, plantDisabled, harvestDisabled, drop, dropDisabled, pickup, pickupDisabled, irrigation, irrigationDisabled, road, roadDisabled, actions };
};
