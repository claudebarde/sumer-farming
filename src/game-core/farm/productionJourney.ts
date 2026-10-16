import type { FarmSnapshot } from "../../schemas/farm";
import type { ProductionJourney } from "../../game-data/productionJourney";
import { INITIAL_FARM_CONFIG } from "../../game-data/initialFarm";
import { WORKER_MOVE_DURATION_PER_TILE } from "../../game-data/movement";
import { porterPath } from "./porter";
import { farmerMovementDurationMultiplier } from "./wellbeing";

type Position = { column: number; row: number };
/** Positions are hints only. The server chooses accessible stops, routes and times. */
export const planProductionJourney = (
  snapshot: FarmSnapshot, targetId: string, now: number,
  hints: { farmerPosition?: Position; donkeyPosition?: Position },
  kind: "baking" | "brewing" | "milling" | "donkeyMilling"
): ProductionJourney | null => {
  const buildings = snapshot.buildings.map(b => ({ ...b, completesAt: Date.parse(b.completesAt) }));
  const obstacles = [...snapshot.objects, ...snapshot.improvements.filter(i =>
    i.row !== INITIAL_FARM_CONFIG.roadRow && !(i.destroyCompletesAt && Date.parse(i.destroyCompletesAt) <= now)),
    ...snapshot.farm.roads.filter(r => (r.completesAt ?? 0) > now)];
  const route = (from: Position, to: Position) => porterPath(buildings, snapshot.farm.roads, from, to, now, obstacles);
  const home = INITIAL_FARM_CONFIG.farmerSpawn;
  const target = buildings.find(b => b.id === targetId);
  if (!target) return null;
  const stop = (b: typeof target): Position | undefined => {
    const candidates = [b.loadingTile, { column: b.column, row: b.row + 2 },
      { column: b.column - 1, row: b.row }, { column: b.column + 2, row: b.row }, { column: b.column, row: b.row - 1 }];
    return candidates.find((p): p is Position => !!p && !!route(home, p));
  };
  const destination = stop(target);
  if (!destination) return null;
  const start = hints.farmerPosition && route(home, hints.farmerPosition) ? hints.farmerPosition : home;
  const path: Position[] = [start];
  const append = (to: Position) => {
    const leg = route(path[path.length - 1]!, to);
    if (!leg) return false;
    path.push(...leg.slice(1)); return true;
  };
  let donkeyPickupIndex: number | undefined;
  let donkeyDropIndex: number | undefined;
  if (kind === "donkeyMilling") {
    const donkey = hints.donkeyPosition && route(home, hints.donkeyPosition) ? hints.donkeyPosition : home;
    if (!append(donkey)) return null;
    donkeyPickupIndex = path.length - 1;
    if (!append(destination)) return null;
    donkeyDropIndex = path.length - 1;
  }
  const carried = snapshot.farm.carriedItem?.itemKey === "barley" ? snapshot.farm.carriedItem.quantity : 0;
  const supplyStops: NonNullable<ProductionJourney["supplyStops"]> = [];
  if (kind === "baking" || kind === "brewing") {
    if (!append(home)) return null;
  } else {
    let remaining = Math.max(0, (kind === "donkeyMilling" ? 6 : 2) - carried);
    for (const source of buildings.filter(b => (b.type === "granary" || b.type === "warehouse") && b.storedBarley > 0 && b.completesAt <= now)) {
      if (!remaining) break;
      const sourceStop = stop(source);
      if (!sourceStop || !append(sourceStop)) return null;
      const quantity = Math.min(remaining, source.storedBarley);
      supplyStops.push({ index: path.length - 1, quantity, buildingId: source.id, column: source.column, row: source.row });
      remaining -= quantity;
    }
    if (remaining > 0) {
      if (!append(home)) return null;
      supplyStops.push({ index: path.length - 1, quantity: remaining, buildingId: null,
        column: INITIAL_FARM_CONFIG.buildingBounds.minimumColumn, row: INITIAL_FARM_CONFIG.buildingBounds.minimumRow });
    }
  }
  const supplyIndex = path.length - 1;
  if (!append(destination)) return null;
  const stepDurationMs = WORKER_MOVE_DURATION_PER_TILE * farmerMovementDurationMultiplier(
    snapshot.farm.household.happiness, snapshot.farm.household.hungrySince !== null, snapshot.farm.progression?.level ?? 1);
  return { departedAt: now, stepDurationMs, path, supplyIndex, supplyStops, donkeyPickupIndex, donkeyDropIndex };
};

export const productionArrivalAt = (journey: ProductionJourney): number =>
  journey.departedAt + Math.ceil((journey.path.length - 1) * journey.stepDurationMs);
