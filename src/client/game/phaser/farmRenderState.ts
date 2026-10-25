import type { FarmSnapshot } from "../../../schemas/farm";
import { isometricCropSprite } from "./isometricDatePalm";
import { hasFarmerPopup } from "./isometricTilePopup";
import { porterAwaitingPickup } from "./isometricPorter";
import { shrineBlessingActive } from "../../../game-data/shrine";

/** Only state used to create scene objects. Actor poses and clocks update in place. */
export const farmRenderKey = (s: FarmSnapshot, now: number): string => {
  const production = s.farm.production;
  const buildingWork = s.buildings.some(b => Date.parse(b.completesAt) > now);
  const infrastructureWork = s.improvements.some(i => Date.parse(i.completesAt) > now || (i.destroyCompletesAt && Date.parse(i.destroyCompletesAt) > now)) ||
    s.farm.roads.some(r => (r.completesAt ?? 0) > now);
  return JSON.stringify({
    level: s.farm.progression?.level, inventory: s.inventory,
    objects: s.objects, groundItems: s.groundItems,
    crops: s.crops.map(c => [c, isometricCropSprite(c, now, production.palmCycles?.[c.id])]),
    buildings: s.buildings.map(b => [b, Date.parse(b.completesAt) <= now, porterAwaitingPickup(production.porter, b.id, now)]),
    roads: s.farm.roads.map(r => [r, (r.completesAt ?? 0) <= now]),
    improvements: s.improvements.map(i => [i, Date.parse(i.completesAt) <= now, !!i.destroyCompletesAt && Date.parse(i.destroyCompletesAt) <= now]),
    pending: production.pending, millPending: s.farm.millGoods.pending,
    planting: production.planting, happiness: s.farm.household.happiness,
    farmerInteractive: hasFarmerPopup(s),
    blessing: shrineBlessingActive(production.shrineBlessing, now) ? production.shrineBlessing : null,
    // Construction bars are currently baked into the scene; retain their former
    // refresh cadence only while a job is active, not while the estate is idle.
    workProgress: buildingWork || infrastructureWork ? Math.floor(now / 5000) : null
  });
};
