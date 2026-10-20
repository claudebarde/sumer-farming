import { PORTER_STEP_MS, type Porter } from "../../../game-data/porter";
import { isoPoint } from "./isometricProjection";
import { PORTER_MARKET } from "../../../game-core/farm/porter";

export const visiblePorterPosition = (porter: Porter | null | undefined, now: number) =>
  porter && (porter.expiresAt > now || porter.job !== null || porter.returnTrip) ? porter.position : null;

/** Sample only persisted times: animation callbacks never transfer goods. */
export const porterPose = (porter: Porter | null | undefined, now: number, reducedMotion = false) => {
  const resting = visiblePorterPosition(porter, now);
  if (!porter || !resting) return null;
  const trip = porter.job ?? porter.returnTrip;
  const path = trip?.path ?? [resting];
  const step = trip ? Math.max(0, Math.min(path.length - 1, (now - trip.startedAt) / PORTER_STEP_MS)) : 0;
  const index = Math.min(Math.floor(step), Math.max(0, path.length - 2));
  const from = path[index] ?? resting, to = path[index + 1] ?? from;
  const fraction = step - index;
  const position = { column: from.column + (to.column - from.column) * fraction, row: from.row + (to.row - from.row) * fraction };
  const moving = !!trip && now >= trip.startedAt && step < path.length - 1;
  const carrying = porter.job && now >= porter.job.pickupAt && now < porter.job.completesAt;
  const cargo = carrying ? porter.job!.itemKey === "beer" || porter.job!.itemKey === "emptyBeerJar" ? "jars" : "bags" : "empty";
  const distance = step * Math.hypot(48, 24);
  const home = porter.home ?? PORTER_MARKET;
  const waitingAtMarket = !moving && !carrying && position.column === home.column && position.row === home.row;
  return { position, moving, facingLeft: waitingAtMarket || isoPoint(to).x < isoPoint(from).x,
    texture: `porter-${cargo}-${moving && !reducedMotion ? `walk-${Math.floor(distance / 35) % 2}` : "idle"}` };
};

/** Goods are economically reserved at booking but remain visible until pickup. */
export const porterAwaitingPickup = (porter: Porter | null | undefined, buildingId: string, now: number) =>
  porter?.job?.itemKey !== "emptyBeerJar" && porter?.job?.buildingId === buildingId && now < porter.job.pickupAt ? porter.job.quantity : 0;
