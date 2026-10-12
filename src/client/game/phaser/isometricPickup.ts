import type { FarmSnapshot } from "../../../schemas/farm";
import { WORKER_MOVE_DURATION_PER_TILE } from "../../../game-data/movement";
import { sameCell } from "./isometricFarm";
import { isoPoint, type IsoCell } from "./isometricProjection";
import { previewWalkPath } from "./isometricWalking";
import { positionAlongPorterPath } from "./porterPresentation";
import { buildingFacingLeft } from "./buildingFacing";

export const PICKUP_REACH_MS = 600;
export const pickupPath = (snapshot: FarmSnapshot, from: IsoCell, target: IsoCell, now: number): readonly IsoCell[] | null => {
  const steps = previewWalkPath(snapshot, from, target, now);
  return sameCell(from, target) || steps.length ? [from, ...steps] : null;
};
export const pickupDuration = (path: readonly IsoCell[]) => (path.length - 1) * WORKER_MOVE_DURATION_PER_TILE + PICKUP_REACH_MS;

export type GroundTransfer = {
  readonly path: readonly IsoCell[];
  readonly startedAt: number;
  readonly carried: number;
} & ({ readonly type: "pickup" | "drop"; readonly item: FarmSnapshot["groundItems"][number] } |
  { readonly type: "store"; readonly before: FarmSnapshot; readonly building: IsoCell });

/** Keep the pre-transfer ground appearance until the reach finishes. */
export const transferGroundItems = (items: FarmSnapshot["groundItems"], transfer: GroundTransfer | null) => {
  if (!transfer || transfer.type === "store") return items;
  const other = items.filter(item => item.id !== transfer.item.id);
  return transfer.type === "pickup" ? [...other, transfer.item] : other;
};

/** Presentation only. The server has already committed the pickup or drop. */
export const pickupPose = (path: readonly IsoCell[], startedAt: number, now: number, building?: IsoCell) => {
  const elapsed = Math.max(0, now - startedAt);
  const travel = (path.length - 1) * WORKER_MOVE_DURATION_PER_TILE;
  const fraction = travel ? Math.min(1, elapsed / travel) : 1;
  const position = positionAlongPorterPath(path, fraction);
  const segment = Math.min(Math.max(0, path.length - 2), Math.floor(elapsed / WORKER_MOVE_DURATION_PER_TILE));
  const a = isoPoint(path[segment]!), b = isoPoint(path[segment + 1] ?? path[segment]!);
  const distance = path.slice(1).reduce((sum, cell, i) => {
    const p = isoPoint(path[i]!), q = isoPoint(cell);
    return sum + Math.hypot(q.x - p.x, q.y - p.y);
  }, 0) * fraction;
  return { position, distance, walking: elapsed < travel, done: elapsed >= travel + PICKUP_REACH_MS,
    facingLeft: building && elapsed >= travel ? buildingFacingLeft(position, building, b.x < a.x) : b.x < a.x,
    dip: elapsed < travel ? 0 : Math.sin(Math.min(1, (elapsed - travel) / PICKUP_REACH_MS) * Math.PI) * 5 };
};
