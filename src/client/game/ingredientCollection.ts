import type { FarmSnapshot } from "../../schemas/farm";
import { millingJobs } from "../../game-data/millingJobs";
import { FARM_SPRITES } from "../../assets/farmSprites";
import flour from "../../assets/sprite_assets/pngs/v2/isometric-test/mill-active/mill-flour-bags-isometric.webp";
import sesame from "../../assets/sprite_assets/pngs/v2/isometric-test/sesame/sesame-basket-isometric.png";
import groats from "../../assets/sprite_assets/pngs/v2/isometric-test/brewery/brewers-groats-icon.webp";

/** Ingredient preparation only; completed production runs keep their own UI. */
export function ingredientCollection(snapshot: FarmSnapshot, now: number) {
  if (Object.values(snapshot.farm.production.baking).some(job => now < Date.parse(job.startedAt))) {
    return { icon: flour, label: "Collecting flour for baking…" };
  }
  const mill = millingJobs(snapshot.farm).find(job => now < Date.parse(job.startedAt));
  if (mill) return mill.recipe === "oil"
    ? { icon: sesame, label: "Collecting sesame for oil…" }
    : { icon: FARM_SPRITES.harvestedBarley, label: "Collecting barley for milling…" };
  const brewery = Object.values(snapshot.farm.production.brewing ?? {}).find(job => now < Date.parse(job.startedAt));
  if (brewery) return { icon: groats, label: now < Date.parse(brewery.arrivedAt) ? "Collecting groats for brewing…" : "Preparing beer…" };
  return null;
}

