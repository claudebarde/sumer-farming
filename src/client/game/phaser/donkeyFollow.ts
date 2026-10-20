import type { IsoCell } from "./isometricProjection";
import { isoPoint } from "./isometricProjection";
import { isMarketRoad } from "./isometricMarketLayout";
import { WORKER_MOVE_DURATION_PER_TILE } from "../../../game-data/movement";

export type DonkeyArrival = "purchase";
export type DonkeyFollow = {
  readonly position: IsoCell;
  readonly trail: readonly IsoCell[];
  readonly distance: number;
  readonly facingLeft: boolean;
  readonly facingBack: boolean;
  readonly walking: boolean;
};
const distance = (a: IsoCell, b: IsoCell) => Math.abs(a.column - b.column) + Math.abs(a.row - b.row);

/** A neighbouring road position, never inside a stand or across a corner. */
export const startDonkeyFollow = (leader: IsoCell): DonkeyFollow | null => {
  const position = [{ column: -1, row: 0 }, { column: 1, row: 0 }, { column: 0, row: -1 }, { column: 0, row: 1 }]
    .map(d => ({ column: leader.column + d.column, row: leader.row + d.row }))
    .find(p => isMarketRoad(p) && isMarketRoad({ column: (p.column + leader.column) / 2, row: (p.row + leader.row) / 2 }));
  return position ? { position, trail: [leader], distance: 0, facingLeft: true, facingBack: false, walking: false } : null;
};

export const appendDonkeyTrail = (state: DonkeyFollow, leader: IsoCell): DonkeyFollow =>
  distance(state.trail.at(-1) ?? state.position, leader) < 0.00001 ? state : { ...state, trail: [...state.trail, leader] };

/** Follow recorded road segments, retaining a one-tile gap unless entering the exit. */
export const advanceDonkeyFollow = (state: DonkeyFollow, delta: number, finish = false): DonkeyFollow => {
  let position = state.position;
  let trail = state.trail;
  let available = 0, last = position;
  for (const p of trail) { available += distance(last, p); last = p; }
  let budget = Math.min(Math.max(0, Math.min(80, delta)) / WORKER_MOVE_DURATION_PER_TILE, Math.max(0, available - (finish ? 0 : 1)));
  let travelled = 0, facingLeft = state.facingLeft, facingBack = state.facingBack;
  while (budget > 0.00001 && trail[0]) {
    const target = trail[0], remaining = distance(position, target);
    if (remaining < 0.00001) { trail = trail.slice(1); continue; }
    const step = Math.min(budget, remaining), from = isoPoint(position), to = isoPoint(target);
    facingLeft = to.x < from.x; facingBack = to.y < from.y;
    position = step === remaining ? target : {
      column: position.column + (target.column - position.column) * step / remaining,
      row: position.row + (target.row - position.row) * step / remaining,
    };
    travelled += step; budget -= step;
    if (step === remaining) trail = trail.slice(1);
  }
  while (trail[0] && distance(position, trail[0]) < 0.00001) {
    position = trail[0]; trail = trail.slice(1);
  }
  return { position, trail, facingLeft, facingBack, distance: state.distance + travelled, walking: travelled > 0.00001 };
};

export const donkeyFollowPose = (state: DonkeyFollow, reducedMotion = false) => ({
  texture: `isometric-donkey-${state.facingBack ? "back" : "front"}-${!state.walking || reducedMotion ? 0 : Math.floor(state.distance * 4) % 4}`,
  flipX: !state.facingLeft,
});

/** Only a newly accepted ownership transition starts a purchase presentation. */
export const newlyPurchasedDonkey = (before: readonly { itemKey: string; quantity: number }[], after: readonly { itemKey: string; quantity: number }[]) =>
  !before.some(i => i.itemKey === "donkey" && i.quantity > 0) && after.some(i => i.itemKey === "donkey" && i.quantity > 0);
