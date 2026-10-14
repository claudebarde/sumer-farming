import type { FarmSnapshot } from "../../../schemas/farm";
import { INITIAL_FARM_CONFIG as config } from "../../../game-data/initialFarm";
import { FISH_CAPACITY } from "../../../game-data/fishing";
import { isIsometricRiverRow } from "./isometricRiver";
import { plantingBlocker } from "./isometricPlanting";
import { pickupPath } from "./isometricPickup";
import { previewWalkable } from "./isometricWalking";
import type { IsoCell } from "./isometricProjection";

export const canStartIsometricFishing = (snapshot: FarmSnapshot, cell: IsoCell, now: number) =>
  isIsometricRiverRow(cell.row) && cell.column >= config.worldBounds.minimumColumn && cell.column <= config.worldBounds.maximumColumn &&
  (snapshot.farm.progression?.level ?? 1) >= 4 && !snapshot.farm.carriedItem && !plantingBlocker(snapshot, now) &&
  (snapshot.inventory.find(item => item.itemKey === "fish")?.quantity ?? 0) < FISH_CAPACITY;

/** Nearest reachable north-bank tile to the selected water; shortest route breaks ties. */
export const fishingApproach = (snapshot: FarmSnapshot, from: IsoCell, water: IsoCell, now: number) => {
  const candidates = Array.from({ length: config.worldBounds.maximumColumn - config.worldBounds.minimumColumn + 1 }, (_, index) =>
    ({ column: config.worldBounds.minimumColumn + index, row: config.riverRow - 1 }));
  const paths = candidates.filter(cell => previewWalkable(snapshot, cell, now))
    .map(bank => ({ bank, path: pickupPath(snapshot, from, bank, now) }))
    .filter((option): option is { bank: IsoCell; path: readonly IsoCell[] } => option.path !== null)
    .sort((a, b) => Math.abs(a.bank.column - water.column) - Math.abs(b.bank.column - water.column) || a.path.length - b.path.length);
  const chosen = paths[0];
  return chosen ? { ...chosen, target: { column: chosen.bank.column, row: config.riverRow } } : null;
};
