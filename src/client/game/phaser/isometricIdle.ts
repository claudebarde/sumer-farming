import type { FarmSnapshot } from "../../../schemas/farm";
import { INITIAL_FARM_CONFIG as config } from "../../../game-data/initialFarm";
import { plantingBlocker } from "./isometricPlanting";
import { previewWalkable } from "./isometricWalking";
import { idleKey, type IdleWorld } from "./farmerIdle";

export const isometricIdleEligible = (snapshot: FarmSnapshot, now: number) =>
  !snapshot.farm.carriedItem && plantingBlocker(snapshot, now) === null;

export const isometricIdleWorld = (snapshot: FarmSnapshot, now: number): IdleWorld => {
  const blocked = new Set([...snapshot.crops, ...snapshot.groundItems].map(idleKey));
  const roads = new Set(snapshot.farm.roads.filter(r => !r.completesAt || r.completesAt <= now).map(idleKey));
  for (let column = config.worldBounds.minimumColumn; column <= config.worldBounds.maximumColumn; column++) {
    roads.add(idleKey({ column, row: config.roadRow }));
  }
  return { roads, allowed: cell => !blocked.has(idleKey(cell)) && previewWalkable(snapshot, cell, now) };
};
