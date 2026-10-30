import { barleyHasExpired, barleyHarvestYield, BARLEY_WITHERING_MS, BARLEY_CLEARING_MS } from "../../../game-core/farm/barleyDecay";
import { countdownLabel } from "../../components/countdownLabel";
import type { FarmSnapshot } from "../../../schemas/farm";
import { plantableFields, harvestableFields, plantingSelectionLimit } from "../../../game-core/farm/batchPlanting";
import { FARMER_CARRY_CAPACITY, granaryCapacityForLevel, granaryLevelForFarmLevel } from "../../../game-data/storage";
import { buildingAt, buildingNames, farmOrigin, sameCell, tileInformation } from "./isometricFarm";
import { isItemDropGround } from "../../../game-core/farm/land";
import { footprintContains, type IsoCell } from "./isometricProjection";
import { plantingBlocker } from "./isometricPlanting";
import { harvestingBlocker } from "./isometricHarvesting";
import { canDestroyIrrigation, irrigationBuildBlocker } from "./isometricIrrigation";
import { INITIAL_FARM_CONFIG } from "../../../game-data/initialFarm";
import { roadBuildBlocker } from "./isometricRoads";
import { previewWalkable } from "./isometricWalking";
import { gatherableResource, transferBlocker } from "./isometricGathering";
import { canStartIsometricFishing } from "./isometricFishing";
import { buildingLevel } from "../../../game-data/buildingUpgrades";

/** Household status is available even when the farmer's hands are empty. */
export const hasFarmerPopup = (snapshot: FarmSnapshot): boolean =>
  !!snapshot.farm.household;

import { canStackMaterial } from "../../../game-core/farm/materialPiles";

export const isometricTilePopup = (snapshot: FarmSnapshot, cell: IsoCell, now: number) => {
  const building = buildingAt(snapshot, cell);
  const crop = snapshot.crops.find(c => sameCell(c, cell) && !barleyHasExpired(c, now));
  const home = !building && footprintContains(farmOrigin, 2, 2, cell);
  const level = home ? snapshot.farm.progression?.level ?? 1
    : building?.type === "granary" ? granaryLevelForFarmLevel(snapshot.farm.progression?.level ?? 1)
    : building && (building.type === "mill" || building.type === "breadOven" || building.type === "brewery") ? buildingLevel(snapshot.farm.production.buildingUpgrades, building.id, now) : null;
  const plantable = plantableFields(snapshot, now);
  const ripe = harvestableFields(snapshot, now);
  const canPlantHere = plantable.some(p => sameCell(p, cell));
  const canHarvestHere = ripe.some(p => sameCell(p, cell));
  const title = building ? buildingNames[building.type] : home ? "Farm" : tileInformation(snapshot, cell, now).split(" · ")[0]!;
  const details: string[] = [];
  if (crop && crop.cropKey === "barley") {
    const end = crop.harvestCompletesAt ?? (Date.parse(crop.plantedAt) > now ? crop.plantedAt : crop.growthCompletesAt);
    details.push(crop.harvestCompletesAt ? "Harvesting…" : Date.parse(crop.plantedAt) > now ? "Sowing…" : Date.parse(end) > now ? `Ready in ${Math.max(1, Math.ceil((Date.parse(end) - now) / 60_000))}m` : "Ready to harvest");
    if (crop.decayEligible && !crop.harvestStartedAt && now >= Date.parse(crop.growthCompletesAt)) {
      const quantity = barleyHarvestYield(crop, now);
      const deadline = Date.parse(crop.growthCompletesAt) + (quantity === 2 ? BARLEY_WITHERING_MS : BARLEY_CLEARING_MS);
      details.push(`${quantity} barley available`);
      details.push(`${quantity === 2 ? "Withers" : "Clears automatically"} in ${countdownLabel(deadline - now)}`);
    }
  } else if (building) {
    if (Date.parse(building.completesAt) > now) details.push("Under construction");
    else if (building.type === "mill") {
      const job = snapshot.farm.milling;
      if (job?.buildingId === building.id && Date.parse(job.startedAt) > now) details.push("Collecting barley…");
      const bags = snapshot.farm.millGoods.pending[building.id];
      if (bags?.flour) details.push(`${bags.flour} flour ${bags.flour === 1 ? "bag" : "bags"} ready`);
      if (bags?.brewersGroats) details.push(`${bags.brewersGroats} groats ${bags.brewersGroats === 1 ? "bag" : "bags"} ready`);
    }
    else if (building.type === "granary") details.push(`${building.storedBarley} / ${granaryCapacityForLevel(snapshot.farm.progression?.level ?? 1)} barley stored`);
    else if (building.type === "breadOven") {
      const job = snapshot.farm.production.baking[building.id];
      if (job && Date.parse(job.startedAt) > now) details.push("Collecting flour…");
      const bread = snapshot.farm.production.pending[building.id];
      if (bread) details.push(`${bread.quantity} bread ready`);
    }
    else if (building.type === "brewery") {
      const job = snapshot.farm.production.brewing?.[building.id];
      if (job && now < Date.parse(job.startedAt)) details.push(now < Date.parse(job.arrivedAt) ? "Collecting groats…" : "Preparing beer…");
      else if (!job && building.beerReadyAt) details.push(`Fermenting · ${Math.max(0, Math.ceil((Date.parse(building.beerReadyAt) - now) / 60000))}m`);
      const beer = snapshot.farm.production.pending[building.id];
      if (beer) details.push(`${beer.quantity} beer ready`);
    }
  } else if (!home && !crop) {
    details.push(...tileInformation(snapshot, cell, now).split(" · ").slice(1));
  }
  const showCarriedItem = home || !!building || !!crop;
  if (showCarriedItem && snapshot.farm.carriedItem) details.push(`Carrying ${snapshot.farm.carriedItem.quantity} ${snapshot.farm.carriedItem.itemKey}`);
  const plant = !home && canPlantHere;
  const harvest = !home && canHarvestHere;
  const plantDisabled = plantingBlocker(snapshot, now) ?? (plantingSelectionLimit(snapshot, now) === 0 ? "No barley seeds" : !plantable.length ? "No irrigated fields" : null);
  const harvestDisabled = harvestingBlocker(snapshot, now) ?? (!ripe.length ? "No ripe barley" : null);
  const drop = (title === "Arable ground" || title === "Ground") &&
    isItemDropGround(cell, snapshot.farm.carriedItem?.itemKey ?? "") &&
    !snapshot.improvements.some(item => sameCell(item, cell)) &&
    !snapshot.groundItems.some(item => sameCell(item, cell) && !canStackMaterial(snapshot.farm.carriedItem?.itemKey ?? "", item)) &&
    !!snapshot.farm.carriedItem && ["barley", "reed", "clay"].includes(snapshot.farm.carriedItem.itemKey) && snapshot.farm.carriedItem.quantity > 0;
  const dropDisabled = transferBlocker(snapshot, now);
  const groundItem = snapshot.groundItems.find(item => sameCell(item, cell));
  const pickup = snapshot.groundItems.some(item => sameCell(item, cell) && ["barley", "reed", "clay"].includes(item.itemKey) && item.quantity > 0 &&
    (item.expiresAt === null || Date.parse(item.expiresAt) > now));
  const pickupDisabled = transferBlocker(snapshot, now) ??
    (snapshot.farm.carriedItem && (groundItem?.itemKey === "clay" || groundItem?.itemKey === "reed") ? "Empty your hands first" : null) ??
    (snapshot.farm.carriedItem && snapshot.farm.carriedItem.itemKey !== groundItem?.itemKey ? "Empty your hands first" : null) ??
    ((snapshot.farm.carriedItem?.quantity ?? 0) >= FARMER_CARRY_CAPACITY ? "Hands full" : null);
  const irrigation = cell.row < INITIAL_FARM_CONFIG.riverRow && ["Arable ground", "Ground", "Rocks", "Bush"].includes(title);
  const irrigationDisabled = irrigationBuildBlocker(snapshot, cell, now);
  const road = irrigation;
  const roadDisabled = roadBuildBlocker(snapshot, cell, now);
  const actions = {
    destroyRoad: cell.row !== INITIAL_FARM_CONFIG.roadRow && snapshot.farm.roads.some(r => sameCell(r, cell) && !r.removing && (r.completesAt ?? 0) <= now) &&
      !snapshot.farm.carriedItem && !plantingBlocker(snapshot, now),
    destroyIrrigation: canDestroyIrrigation(snapshot, cell, now),
    destroyMaterial: !!groundItem && (groundItem.itemKey === "reed" || groundItem.itemKey === "clay") &&
      !transferBlocker(snapshot, now) && !snapshot.farm.carriedItem && !snapshot.farm.production.materialDelivery,
    fish: canStartIsometricFishing(snapshot, cell, now),
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
