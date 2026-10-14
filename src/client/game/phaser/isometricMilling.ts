import type { FarmSnapshot } from "../../../schemas/farm";
import { millingUnavailableReason } from "../../../game-core/farm/milling";
import { millRecipe, type MillRecipe } from "../../../game-data/milling";
import { isoPoint } from "./isometricProjection";

export const millPopupState = (snapshot: FarmSnapshot, buildingId: string, now: number, recipe: MillRecipe = "flour") => {
  const building = snapshot.buildings.find(b => b.id === buildingId && b.type === "mill");
  const ready = !!building && Date.parse(building.completesAt) <= now;
  const stored = (snapshot.inventory.find(i => i.itemKey === "barley")?.quantity ?? 0) + snapshot.buildings
    .filter(b => (b.type === "granary" || b.type === "warehouse") && Date.parse(b.completesAt) <= now)
    .reduce((sum, b) => sum + b.storedBarley, 0);
  const insufficient = ready && stored < millRecipe("flour").barley;
  return { insufficient, canStart: ready && !insufficient && !snapshot.farm.carriedItem &&
    !snapshot.farm.roads.some(r => (r.completesAt ?? 0) > now) &&
    !millingUnavailableReason(snapshot, recipe, now, "farmer", buildingId) };
};

/** Render the saved server journey, never dispatch commands from animation callbacks. */
export const millingJourneyPose = (snapshot: FarmSnapshot, now: number) => {
  const job = snapshot.farm.milling, journey = job?.preparation;
  if (!job || !journey || now >= Date.parse(job.startedAt)) return null;
  const step = Math.max(0, Math.min(journey.path.length - 1, (now - journey.departedAt) / journey.stepDurationMs));
  const index = Math.floor(step), fraction = step - index;
  const from = journey.path[index]!, to = journey.path[index + 1] ?? from;
  const position = { column: from.column + (to.column - from.column) * fraction, row: from.row + (to.row - from.row) * fraction };
  const supplied = journey.supplyStops;
  const carried = supplied ? job.barley - supplied.reduce((sum, stop) => sum + stop.quantity, 0) + supplied
    .filter(stop => step >= stop.index).reduce((sum, stop) => sum + stop.quantity, 0)
    : step >= journey.supplyIndex ? job.barley : 0;
  const a = isoPoint(from), b = isoPoint(to);
  return { position, carried, distance: step * Math.hypot(48, 24), facingLeft: b.x < a.x };
};

export const millingProgress = (snapshot: FarmSnapshot, buildingId: string, now: number) => {
  const job = snapshot.farm.milling;
  if (!job || job.buildingId !== buildingId || now < Date.parse(job.startedAt) || now >= Date.parse(job.completesAt)) return null;
  return { elapsed: now - Date.parse(job.startedAt), fraction: (now - Date.parse(job.startedAt)) / (Date.parse(job.completesAt) - Date.parse(job.startedAt)), farmer: job.worker !== "donkey" };
};
