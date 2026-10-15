import sweep01 from "../../../assets/sprite_assets/pngs/v2/isometric-test/farmer-sweep-01.png";
import sweep02 from "../../../assets/sprite_assets/pngs/v2/isometric-test/farmer-sweep-02.png";
import sweep03 from "../../../assets/sprite_assets/pngs/v2/isometric-test/farmer-sweep-03.png";
import sweep04 from "../../../assets/sprite_assets/pngs/v2/isometric-test/farmer-sweep-04.png";
import type { FarmSnapshot } from "../../../schemas/farm";
import { INITIAL_FARM_CONFIG as config } from "../../../game-data/initialFarm";
import { WORKER_MOVE_DURATION_PER_TILE } from "../../../game-data/movement";
import { previewWalkPath, previewWalkable } from "./isometricWalking";
import { isometricIdleEligible } from "./isometricIdle";
import { sameCell } from "./isometricFarm";
import { isoPoint, type IsoCell } from "./isometricProjection";
import { positionAlongPorterPath } from "./porterPresentation";

export const SWEEP_IDLE_DELAY = 10_000;
export const SWEEP_DWELL_MS = 4800;
export const SWEEP_SOURCES = [sweep01, sweep02, sweep03, sweep04] as const;
// Preserve the broom's full reach; feet are left of the full artwork's centre.
export const SWEEP_BOUNDS = { left: 80, top: 80, right: 1230, bottom: 1330 } as const;
export const SWEEP_ORIGIN = { x: 43 / 128, y: 118 / 128 } as const;
export const sweepTexture = (elapsed: number) => `farmer-sweep-${Math.floor(Math.max(0, elapsed) / (400 / 1.5)) % 4}`;
export const SWEEP_TILES: readonly IsoCell[] = [
  { column: config.buildingBounds.minimumColumn, row: config.roadRow },
  { column: config.buildingBounds.maximumColumn, row: config.roadRow },
];
export type SweepPlan = { readonly path: readonly IsoCell[]; readonly first: IsoCell; readonly second: IsoCell };
export const planSweeping = (snapshot: FarmSnapshot, from: IsoCell, now: number): SweepPlan | null => {
  if (!isometricIdleEligible(snapshot, now) ||
    !SWEEP_TILES.every(cell => previewWalkable(snapshot, cell, now))) return null;
  const choices = SWEEP_TILES.flatMap(first => {
    const path = previewWalkPath(snapshot, from, first, now);
    return path.length || sameCell(from, first) ? [{ path: [from, ...path], first,
      second: SWEEP_TILES.find(cell => !sameCell(cell, first))! }] : [];
  });
  return choices.sort((a, b) => Math.hypot(a.first.column - from.column, a.first.row - from.row) -
    Math.hypot(b.first.column - from.column, b.first.row - from.row) || a.path.length - b.path.length)[0] ?? null;
};

export const sweepingPose = (plan: SweepPlan, elapsed: number) => {
  const approachMs = (plan.path.length - 1) * WORKER_MOVE_DURATION_PER_TILE;
  const travel = (path: readonly IsoCell[], time: number, duration: number) => {
    const fraction = duration > 0 ? Math.min(1, Math.max(0, time / duration)) : 1;
    const position = positionAlongPorterPath(path, fraction);
    const previous = positionAlongPorterPath(path, Math.max(0, fraction - 0.001));
    return { type: "walking" as const, position, elapsed: time, facingLeft: isoPoint(position).x < isoPoint(previous).x,
      distance: fraction * path.slice(1).reduce((sum, cell, i) => {
        const a = isoPoint(path[i]!), b = isoPoint(cell); return sum + Math.hypot(b.x - a.x, b.y - a.y);
      }, 0) };
  };
  if (elapsed < approachMs) return travel(plan.path, elapsed, approachMs);
  const legMs = SWEEP_DWELL_MS + WORKER_MOVE_DURATION_PER_TILE;
  const time = Math.max(0, elapsed - approachMs);
  const reverse = Math.floor(time / legMs) % 2 === 1;
  const from = reverse ? plan.second : plan.first, to = reverse ? plan.first : plan.second;
  const phase = time % legMs;
  return phase < SWEEP_DWELL_MS
    ? { type: "sweeping" as const, position: from, elapsed: phase, facingLeft: false, distance: 0 }
    : travel([from, to], phase - SWEEP_DWELL_MS, WORKER_MOVE_DURATION_PER_TILE);
};
