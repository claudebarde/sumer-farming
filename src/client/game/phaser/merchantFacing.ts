import { isoPoint, type IsoCell } from "./isometricProjection";

export type MerchantFacing = Readonly<{ flipX: boolean; waitingMs: number }>;
export const initialMerchantFacing = (): MerchantFacing => ({ flipX: true, waitingMs: 0 });
const NOTICE_RADIUS = 3;
const NEUTRAL_WIDTH = 12;
const TURN_DELAY_MS = 250;

/** Local presentation only; project direction before choosing a left/right pose. */
export function advanceMerchantFacing(state: MerchantFacing, merchant: IsoCell, farmer: IsoCell, delta: number): MerchantFacing {
  const dx = isoPoint(farmer).x - isoPoint(merchant).x;
  const nearby = Math.hypot(farmer.column - merchant.column, farmer.row - merchant.row) <= NOTICE_RADIUS;
  if (!nearby || Math.abs(dx) <= NEUTRAL_WIDTH || (dx < 0) === state.flipX) {
    return state.waitingMs === 0 ? state : { ...state, waitingMs: 0 };
  }
  // Ignore long suspension gaps: only visible scene frames count towards a turn.
  const waitingMs = state.waitingMs + Math.max(0, Math.min(delta, 80));
  return waitingMs >= TURN_DELAY_MS ? { flipX: dx < 0, waitingMs: 0 } : { ...state, waitingMs };
}
