import type { FarmSnapshot } from "../../../schemas/farm";
import { findDogWalk } from "../../../game-core/fetch";
import { dogClear, moveDog, stepDog, type DogState } from "./isometricDog";
import type { IsoCell } from "./isometricProjection";

export type DogWandering = Readonly<{ idleMs: number; goal: IsoCell | null; pauseMs: number }>;
export const initialWandering = (): DogWandering => ({ idleMs: 0, goal: null, pauseMs: 0 });
const distance = (a: IsoCell, b: IsoCell) => Math.hypot(a.column - b.column, a.row - b.row);
const point = (cell: IsoCell) => ({ x: cell.column + 0.5, y: cell.row + 0.5 });
const bounds = { column: -4, row: 0, columns: 16, rows: 10 };

export const stepWandering = (
  dog: DogState, state: DogWandering, snapshot: FarmSnapshot, farmer: IsoCell,
  delta: number, now: number, mouseX: number | null, reserved: readonly IsoCell[],
  enabled = true, random: () => number = Math.random,
): { dog: DogState; state: DogWandering } => {
  const dt = Math.max(0, Math.min(delta, 50));
  const idleMs = enabled ? state.idleMs + dt : 0;
  const blocked = (cell: IsoCell) => reserved.some(r => r.column === Math.round(cell.column) && r.row === Math.round(cell.row));
  const clear = (cell: IsoCell) => dogClear(snapshot, cell, now) && !blocked(cell);
  if (idleMs < 20_000) {
    // Return as close as safely reachable, without entering the working area.
    let following = stepDog(dog, snapshot, farmer, delta, now, mouseX, reserved);
    if (reserved.length && !blocked(dog.position)) {
      if (dog.target && clear(dog.target)) return {
        dog: moveDog(dog, dt, mouseX), state: { idleMs, goal: null, pauseMs: 0 },
      };
      const candidates: IsoCell[] = [];
      for (let row = 0; row < bounds.rows; row++) for (let column = bounds.column; column < bounds.column + bounds.columns; column++) {
        const cell = { column, row };
        if (clear(cell) && distance(cell, farmer) >= 1) candidates.push(cell);
      }
      candidates.sort((a, b) => distance(a, farmer) - distance(b, farmer));
      for (const cell of candidates) {
        if (distance(dog.position, farmer) <= distance(cell, farmer) + 0.1) break;
        const path = findDogWalk(point(dog.position), point(cell), bounds, (column, row) => clear({ column, row }), 1);
        const next = path?.[0];
        if (!next) continue;
        following = moveDog({ ...dog, target: { column: next.x - 0.5, row: next.y - 0.5 } }, dt, mouseX);
        break;
      }
    }
    return { dog: following, state: { idleMs, goal: null, pauseMs: 0 } };
  }
  const needsEscape = blocked(dog.position) || distance(dog.position, farmer) > 3;
  const pauseMs = needsEscape ? 0 : Math.max(0, state.pauseMs - dt);
  if (pauseMs > 0) return { dog: moveDog({ ...dog, target: null }, dt, mouseX), state: { idleMs, goal: null, pauseMs } };
  const allowed = (cell: IsoCell) => clear(cell) && distance(cell, farmer) <= 3 && distance(cell, farmer) >= 1;
  const route = (goal: IsoCell) => findDogWalk(point(dog.position), point(goal), bounds,
    (column, row) => clear({ column, row }) && (needsEscape || distance({ column, row }, farmer) <= 3), 1);
  let goal = state.goal && allowed(state.goal) ? state.goal : null;
  // Finish the current tile step before asking the grid pathfinder for another.
  // Replanning at fractional positions can alternate between recentering and
  // turning, causing a stationary left/right flicker at corners.
  if (goal && dog.target && clear(dog.target) && (needsEscape || distance(dog.target, farmer) <= 3)) return {
    dog: moveDog(dog, dt, mouseX), state: { idleMs, goal, pauseMs: 0 },
  };
  let path = goal ? route(goal) : null;
  if (goal && distance(dog.position, goal) <= 0.001) return {
    dog: moveDog({ ...dog, target: null }, dt, mouseX),
    state: { idleMs, goal: null, pauseMs: 2000 + random() * 4000 },
  };
  if (!path?.length) {
    const candidates: { goal: IsoCell; path: NonNullable<typeof path> }[] = [];
    for (let row = 0; row < bounds.rows; row++) for (let column = bounds.column; column < bounds.column + bounds.columns; column++) {
      const cell = { column, row };
      if (!allowed(cell) || distance(cell, dog.position) < 0.5) continue;
      const candidate = route(cell);
      if (candidate?.length) candidates.push({ goal: cell, path: candidate });
    }
    const chosen = candidates[Math.min(candidates.length - 1, Math.floor(random() * candidates.length))];
    goal = chosen?.goal ?? null; path = chosen?.path ?? null;
  }
  const next = path?.[0];
  return {
    dog: moveDog({ ...dog, target: next ? { column: next.x - 0.5, row: next.y - 0.5 } : null }, dt, mouseX),
    state: { idleMs, goal, pauseMs: next ? 0 : 2000 },
  };
};
