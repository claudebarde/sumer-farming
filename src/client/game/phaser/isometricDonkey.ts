import type { FarmSnapshot } from "../../../schemas/farm";
import { INITIAL_FARM_CONFIG as config } from "../../../game-data/initialFarm";
import { isArableGround } from "../../../game-core/farm/land";
import { roadIsComplete } from "../../../game-data/roads";
import { previewWalkable } from "./isometricWalking";
import { sameCell } from "./isometricFarm";
import { isoPoint, type IsoCell } from "./isometricProjection";
import { marketEntrance } from "./isometricMarket";
import { SWEEP_TILES } from "./farmerSweeping";
import { getBuildingFootprint } from "../../../game-core/farm/buildings";

// Preserve the flat-map donkey's grazing pace and rest interval.
export const DONKEY_STEP_MS = 900;
export const DONKEY_REST_MS = 30_000;
export const DONKEY_START = { column: config.worldBounds.minimumColumn + 1, row: config.roadRow - 1 } as const;
// New placement revision deliberately ignores the old market-side resting tile.
export const donkeyRestKey = (farmId: string) => `sumer:donkey:west-v2:${farmId}`;
export type DonkeyWander = {
  position: IsoCell; facingLeft: boolean; facingBack?: boolean; rest: number;
  heading?: 1 | -1;
  motion: { from: IsoCell; to: IsoCell; elapsed: number; remaining?: readonly IsoCell[]; escape?: readonly IsoCell[] } | null;
};

/** Only the construction site containing the donkey may be crossed on exit. */
export const donkeyEscapeFootprint = (snapshot: FarmSnapshot, state: DonkeyWander | null, now: number): readonly IsoCell[] => {
  if (!state) return [];
  const cell = { column: Math.round(state.position.column), row: Math.round(state.position.row) };
  return snapshot.buildings.filter(b => Date.parse(b.completesAt) > now)
    .map(b => getBuildingFootprint(b.type, b)).find(cells => cells.some(p => sameCell(p, cell))) ?? [];
};

const escapePath = (start: IsoCell, footprint: readonly IsoCell[], cells: readonly IsoCell[], occupied: readonly IsoCell[]) => {
  const origin = { column: Math.round(start.column), row: Math.round(start.row) };
  const queue = [{ cell: origin, path: [] as IsoCell[] }];
  const visited = new Set([`${origin.column}:${origin.row}`]);
  for (const entry of queue) {
    if (entry.path.length && cells.some(p => sameCell(p, entry.cell))) return entry.path;
    for (const next of [...cells, ...footprint]) {
      const key = `${next.column}:${next.row}`;
      if (visited.has(key) || occupied.some(p => sameCell(p, next)) ||
        Math.abs(next.column - entry.cell.column) + Math.abs(next.row - entry.cell.row) !== 1) continue;
      visited.add(key);
      queue.push({ cell: next, path: [...entry.path, next] });
    }
  }
  return [];
};

export const donkeyGround = (snapshot: FarmSnapshot, now: number): readonly IsoCell[] => {
  const cells: IsoCell[] = [];
  const blocked = [...snapshot.crops, ...snapshot.groundItems];
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

/** Access tiles may be crossed, but must remain clear during grazing breaks. */
export const donkeyNoRestTiles = (snapshot: FarmSnapshot): readonly IsoCell[] => [
  ...SWEEP_TILES, marketEntrance, ...snapshot.buildings.flatMap(b => b.loadingTile ? [b.loadingTile] : [])
];

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
  escapeFootprint?: readonly IsoCell[];
  noRest?: readonly IsoCell[];
}): DonkeyWander | null => {
  const escape = state?.motion?.escape ?? [];
  const allowed = (p: IsoCell) => input.cells.some(c => sameCell(c, p)) || escape.some(c => sameCell(c, p));
  const occupied = (p: IsoCell) => input.occupied.some(c => sameCell(c, p));
  const offRoad = (p: IsoCell) => p.row !== config.roadRow && !input.roads.some(c => sameCell(c, p)) &&
    !input.noRest?.some(c => sameCell(c, p));
  if (state && !state.motion?.escape && input.movingAllowed && input.escapeFootprint?.length) {
    const [to, ...remaining] = escapePath(state.position, input.escapeFootprint, input.cells, input.occupied);
    if (to) return { ...state, rest: 0, facingLeft: isoPoint(to).x < isoPoint(state.position).x,
      facingBack: isoPoint(to).y < isoPoint(state.position).y,
      motion: { from: state.position, to, elapsed: 0, remaining, escape: input.escapeFootprint } };
  }
  if (!state || (!state.motion?.escape && !allowed(state.motion?.from ?? state.position)) ||
    (state.motion?.escape && !input.movingAllowed)) {
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
    if (!allowed(to) || occupied(to)) {
      // Backtrack smoothly to the previous junction, then plan around the obstacle.
      if (state.motion.elapsed > 0) return { ...state,
        facingLeft: isoPoint(from).x < isoPoint(state.position).x,
        facingBack: isoPoint(from).y < isoPoint(state.position).y,
        motion: { from: state.position, to: from, elapsed: 0, escape: state.motion.escape }, rest: 0 };
      state = { ...state, position: from, motion: null, rest: 0 };
      return advanceDonkeyWander(state, { ...input, delta: 0 });
    }
    const total = state.motion.elapsed + delta;
    if (total >= DONKEY_STEP_MS) {
      const [next, ...remaining] = state.motion.remaining ?? [];
      if (next && allowed(next) && !occupied(next)) {
        const elapsed = total - DONKEY_STEP_MS;
        const t = elapsed / DONKEY_STEP_MS;
        return { ...state, position: { column: to.column + (next.column - to.column) * t, row: to.row + (next.row - to.row) * t },
          facingLeft: isoPoint(next).x < isoPoint(to).x, facingBack: isoPoint(next).y < isoPoint(to).y, rest: 0,
          motion: { from: to, to: next, elapsed, remaining, escape: state.motion.escape } };
      }
      return { ...state, position: to, motion: null, rest: offRoad(to) ? DONKEY_REST_MS : 0 };
    }
    const elapsed = total;
    const t = elapsed / DONKEY_STEP_MS;
    return { ...state, position: { column: from.column + (to.column - from.column) * t, row: from.row + (to.row - from.row) * t },
      motion: { ...state.motion, elapsed }, rest: 0 };
  }
  if (offRoad(state.position) && state.rest > delta) return { ...state, rest: state.rest - delta };
  // Search the entire reachable area: roads are bridges, not forbidden routes.
  // Keep a heading across strolls so local randomness still explores the estate.
  const length = input.random < 0.5 ? 3 : 4;
  const queue = [{ cell: state.position, path: [] as IsoCell[] }];
  const visited = new Set([`${state.position.column}:${state.position.row}`]);
  const offset = Math.floor(input.random * input.cells.length);
  const ordered = [...input.cells.slice(offset), ...input.cells.slice(0, offset)];
  for (const entry of queue) {
    for (const next of ordered) {
      const key = `${next.column}:${next.row}`;
      if (visited.has(key) || occupied(next) || Math.abs(next.column - entry.cell.column) + Math.abs(next.row - entry.cell.row) !== 1) continue;
      visited.add(key); queue.push({ cell: next, path: [...entry.path, next] });
    }
  }
  const destinations = queue.filter(entry => entry.path.length && offRoad(entry.cell));
  let heading: 1 | -1 = state.heading ?? (input.random < 0.5 ? 1 : -1);
  let choices = destinations.filter(entry => (entry.cell.column - state.position.column) * heading > 0);
  if (!choices.length) {
    heading = heading === 1 ? -1 : 1;
    choices = destinations.filter(entry => (entry.cell.column - state.position.column) * heading > 0);
  }
  // A narrow north/south corridor remains useful when neither horizontal direction is reachable.
  if (!choices.length) choices = destinations;
  const fullStrolls = choices.filter(entry => entry.path.length >= length);
  if (fullStrolls.length) choices = fullStrolls;
  const distance = Math.min(...choices.map(entry => Math.abs(entry.path.length - length)));
  choices = choices.filter(entry => Math.abs(entry.path.length - length) === distance);
  const selected = choices[Math.min(choices.length - 1, Math.floor(input.random * choices.length))];
  const [to, ...remaining] = selected?.path ?? [];
  return to ? { ...state, heading, rest: 0, facingLeft: isoPoint(to).x < isoPoint(state.position).x,
    facingBack: isoPoint(to).y < isoPoint(state.position).y,
    motion: { from: state.position, to, elapsed: 0, remaining } } : { ...state, rest: DONKEY_REST_MS };
};
