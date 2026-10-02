import type { FarmSnapshot } from "../../schemas/farm";
import type { FarmCoordinate } from "./irrigation";
import { INITIAL_FARM_CONFIG } from "../../game-data/initialFarm";
import { getBuildingFootprint } from "./buildings";
import { findRoadPreferredPath } from "./roadPath";
import { roadIsComplete } from "../../game-data/roads";
import { farmerMovementDurationMultiplier } from "./wellbeing";

export const FARMER_MOVE_DURATION_PER_TILE = 180;

/** Farm-local routing, independent of viewport size and animation frames. */
export const plantingTravelMs = (snapshot: FarmSnapshot, from: FarmCoordinate, to: FarmCoordinate, now: number): number => {
  const { worldBounds: bounds, buildingBounds: home, roadRow, riverRow } = INITIAL_FARM_CONFIG;
  const local = (p: FarmCoordinate) => ({ column: p.column - bounds.minimumColumn, row: p.row });
  const key = (p: FarmCoordinate) => `${p.column}:${p.row}`;
  const blocked = snapshot.buildings.flatMap(b => getBuildingFootprint(b.type, b));
  for (let row = home.minimumRow; row <= home.maximumRow; row++)
    for (let column = home.minimumColumn; column <= home.maximumColumn; column++) blocked.push({ column, row });
  for (let column = bounds.minimumColumn; column <= bounds.maximumColumn; column++) blocked.push({ column, row: riverRow });
  const roads = snapshot.farm.roads.filter(r => roadIsComplete(r, now)).map(local);
  for (let column = bounds.minimumColumn; column <= bounds.maximumColumn; column++) roads.push(local({ column, row: roadRow }));
  const path = findRoadPreferredPath(local(from), local(to),
    { columns: bounds.maximumColumn - bounds.minimumColumn + 1, rows: bounds.maximumRow + 1 },
    new Set(blocked.map(p => key(local(p)))), new Set(roads.map(key)));
  const steps = path ? path.length - 1 : Math.abs(from.column - to.column) + Math.abs(from.row - to.row);
  return Math.ceil(steps * FARMER_MOVE_DURATION_PER_TILE * farmerMovementDurationMultiplier(
    snapshot.farm.household.happiness, snapshot.farm.household.hungrySince !== null, snapshot.farm.progression?.level ?? 1));
};
