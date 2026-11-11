import type { FarmSnapshot } from "../../../schemas/farm";
import { ACTION_POINTS } from "../../../game-data/points";
import { millingJobs } from "../../../game-data/millingJobs";
import { roadsideOutputPlacement } from "./buildingOutputPlacement";
import { breweryOutputPlacement } from "./isometricBrewing";
import type { HarvestGain } from "./isometricHarvesting";

/** Confirmed live completions only. Initial snapshots and offline history never replay. */
export const productionGains = (before: FarmSnapshot, after: FarmSnapshot, now: number): readonly HarvestGain[] => {
  if (before.farm.id !== after.farm.id) return [];
  const completed = [
    ...millingJobs(before.farm).filter(job => !millingJobs(after.farm).some(next =>
      next.buildingId === job.buildingId && next.startedAt === job.startedAt)).map(job => ({
      id: job.buildingId, at: Date.parse(job.completesAt), points: ACTION_POINTS[job.worker === "donkey" ? "millDonkey" : "millFarmer"]
    })),
    ...Object.entries(before.farm.production.baking).filter(([id, job]) =>
      after.farm.production.baking[id]?.startedAt !== job.startedAt).map(([id, job]) => ({
      id, at: Date.parse(job.completesAt), points: ACTION_POINTS.bakeBread
    })),
    ...before.buildings.filter(b => b.type === "brewery" && b.beerReadyAt &&
      after.buildings.find(next => next.id === b.id)?.beerReadyAt !== b.beerReadyAt).map(b => ({
      id: b.id, at: Date.parse(b.beerReadyAt!), points: ACTION_POINTS.brewBeer
    }))
  ];
  return completed.flatMap(job => {
    if (job.at > now || now - job.at > 10_000) return [];
    const building = after.buildings.find(b => b.id === job.id);
    if (!building) return [];
    const cell = (building.type === "brewery" ? breweryOutputPlacement(building)
      : roadsideOutputPlacement(building, after.farm.roads, now)).tile;
    // Output sprites sit 16px below the tile centre; begin just above their chips.
    return [{ cell, at: now, quantity: job.points, offsetY: -32 }];
  });
};
