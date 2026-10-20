import type { FarmSnapshot } from "../../../schemas/farm";
import { INITIAL_FARM_CONFIG as config } from "../../../game-data/initialFarm";
import { isArableGround } from "../../../game-core/farm/land";
import { roadIsComplete } from "../../../game-data/roads";
import { previewWalkable } from "./isometricWalking";
import { sameCell } from "./isometricFarm";
import { isoPoint, type IsoCell } from "./isometricProjection";
import { marketEntrance } from "./isometricMarket";
import { SWEEP_TILES } from "./farmerSweeping";

// Preserve the flat-map donkey's grazing pace and rest interval.
export const DONKEY_STEP_MS = 900;
export const DONKEY_REST_MS = 30_000;
export const DONKEY_START = { column: config.worldBounds.minimumColumn + 1, row: config.roadRow - 1 } as const;
// New placement revision deliberately ignores the old market-side resting tile.
export const donkeyRestKey = (farmId: string) => `sumer:donkey:west-v2:${farmId}`;
export type DonkeyWander = {
  position: IsoCell; facingLeft: boolean; facingBack?: boolean; rest: number;
  motion: { from: IsoCell; to: IsoCell; elapsed: number; remaining?: readonly IsoCell[] } | null;
};

export const donkeyGround = (snapshot: FarmSnapshot, now: number): readonly IsoCell[] => {
  const cells: IsoCell[] = [];
  const blocked = [...snapshot.crops, ...snapshot.groundItems,
    ...snapshot.buildings.flatMap(b => b.loadingTile ? [b.loadingTile] : []),
    ...SWEEP_TILES, marketEntrance];
  for (let row = config.worldBounds.minimumRow; row <= config.roadRow; row++) {
    for (let column = config.worldBounds.minimumColumn; column <= config.worldBounds.maximumColumn; column++) {
      const cell = { column, row };
      const road = snapshot.farm.roads.find(r => sameCell(r, cell));
      if (isArableGround(cell) || !previewWalkable(snapshot, cell, now) ||
        (road && !roadIsComplete(road, now)) || blocked.some(p => sameCell(p, cell))) continue;
      cells.push(cell);
    }
  }
  return cells;
};

export const donkeyOwnedAndIdle = (snapshot: FarmSnapshot) =>
  snapshot.inventory.some(i => i.itemKey === "donkey" && i.quantity > 0) && snapshot.farm.milling?.worker !== "donkey";

/** Enter beside the market and walk onto reachable northern ground. */
export const arrivingDonkey = (cells: readonly IsoCell[], occupied: readonly IsoCell[]): DonkeyWander | null => {
  const allowed = cells.filter(p => !occupied.some(o => sameCell(o, p)));
  const start = [...allowed].sort((a, b) =>
    Math.abs(a.column - marketEntrance.column) + Math.abs(a.row - marketEntrance.row) -
    Math.abs(b.column - marketEntrance.column) - Math.abs(b.row - marketEntrance.row))[0];
  if (!start) return null;
  const queue = [{ cell: start, path: [] as IsoCell[] }], visited = new Set([`${start.column}:${start.row}`]);
  for (const entry of queue) {
    if (entry.cell.row < config.roadRow) {
      const [to, ...remaining] = entry.path;
      return { position: start, facingLeft: to ? isoPoint(to).x < isoPoint(start).x : true,
        facingBack: to ? isoPoint(to).y < isoPoint(start).y : false,
        rest: to ? 0 : DONKEY_REST_MS, motion: to ? { from: start, to, elapsed: 0, remaining } : null };
    }
    for (const next of allowed) {
      const key = `${next.column}:${next.row}`;
      if (visited.has(key) || Math.abs(next.column - entry.cell.column) + Math.abs(next.row - entry.cell.row) !== 1) continue;
      visited.add(key); queue.push({ cell: next, path: [...entry.path, next] });
    }
  }
  return { position: start, facingLeft: true, rest: DONKEY_REST_MS, motion: null };
};

/** Pure cosmetic state. Only adjacent steps; no time-away movement backlog. */
export const advanceDonkeyWander = (state: DonkeyWander | null, input: {
  cells: readonly IsoCell[]; roads: readonly IsoCell[]; occupied: readonly IsoCell[];
  delta: number; movingAllowed: boolean; random: number;
}): DonkeyWander | null => {
  const allowed = (p: IsoCell) => input.cells.some(c => sameCell(c, p));
  const occupied = (p: IsoCell) => input.occupied.some(c => sameCell(c, p));
  const offRoad = (p: IsoCell) => p.row !== config.roadRow && !input.roads.some(c => sameCell(c, p));
  if (!state || !allowed(state.motion?.from ?? state.position)) {
    const candidates = input.cells.filter(p => !occupied(p));
    // Start on western ground just north of the road, without reserving land.
    const position = [...candidates].sort((a, b) => Number(offRoad(b)) - Number(offRoad(a)) ||
      Math.abs(a.column - DONKEY_START.column) + Math.abs(a.row - DONKEY_START.row) -
      Math.abs(b.column - DONKEY_START.column) - Math.abs(b.row - DONKEY_START.row))[0];
    return position ? { position, facingLeft: true, rest: DONKEY_REST_MS, motion: null } : null;
  }
  if (!input.movingAllowed) return state;
  const delta = Math.min(80, Math.max(0, input.delta));
  if (state.motion) {
    const { from, to } = state.motion;
    if (!allowed(to)) return { ...state, position: from, motion: null, rest: DONKEY_REST_MS };
    if (occupied(to)) return state;
    const total = state.motion.elapsed + delta;
    if (total >= DONKEY_STEP_MS) {
      const [next, ...remaining] = state.motion.remaining ?? [];
      if (next && allowed(next) && !occupied(next)) {
        const elapsed = total - DONKEY_STEP_MS;
        const t = elapsed / DONKEY_STEP_MS;
        return { ...state, position: { column: to.column + (next.column - to.column) * t, row: to.row + (next.row - to.row) * t },
          facingLeft: isoPoint(next).x < isoPoint(to).x, facingBack: isoPoint(next).y < isoPoint(to).y, rest: 0,
          motion: { from: to, to: next, elapsed, remaining } };
      }
      return { ...state, position: to, motion: null, rest: DONKEY_REST_MS };
    }
    const elapsed = total;
    const t = elapsed / DONKEY_STEP_MS;
    return { ...state, position: { column: from.column + (to.column - from.column) * t, row: from.row + (to.row - from.row) * t },
      motion: { ...state.motion, elapsed }, rest: 0 };
  }
  if (state.rest > delta) return { ...state, rest: state.rest - delta };
  // Short connected strolls, without pacing back and forth to pad the distance.
  const length = input.random < 0.5 ? 3 : 4;
  const paths: IsoCell[][] = [];
  const explore = (from: IsoCell, path: IsoCell[]) => {
    if (path.length) paths.push(path);
    if (path.length === length) return;
    for (const next of input.cells) {
      if (Math.abs(next.column - from.column) + Math.abs(next.row - from.row) !== 1 || occupied(next) ||
        sameCell(next, state.position) || path.some(p => sameCell(p, next))) continue;
      explore(next, [...path, next]);
    }
  };
  explore(state.position, []);
  const longest = Math.max(0, ...paths.map(p => p.length));
  const candidates = paths.filter(p => p.length === longest);
  const groundCount = (path: readonly IsoCell[]) => path.filter(offRoad).length;
  const mostGround = Math.max(0, ...candidates.map(groundCount));
  const ground = candidates.filter(path => groundCount(path) === mostGround);
  const choices = ground.length && input.random < 0.75 ? ground : candidates;
  const [to, ...remaining] = choices[Math.min(choices.length - 1, Math.floor(input.random * choices.length))] ?? [];
  return to ? { ...state, rest: 0, facingLeft: isoPoint(to).x < isoPoint(state.position).x,
    facingBack: isoPoint(to).y < isoPoint(state.position).y,
    motion: { from: state.position, to, elapsed: 0, remaining } } : { ...state, rest: DONKEY_REST_MS };
};
