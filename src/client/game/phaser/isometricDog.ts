import { findDogWalk, planDogFollow } from "../../../game-core/fetch";
import { INITIAL_FARM_CONFIG as config } from "../../../game-data/initialFarm";
import type { FarmSnapshot } from "../../../schemas/farm";
import { previewWalkable } from "./isometricWalking";
import { sameCell } from "./isometricFarm";
import { isoPoint, type IsoCell } from "./isometricProjection";
import { dogFacingMouse } from "./dogFacing";

export const DOG_SOURCES = Object.fromEntries<string>([
  ["sit", new URL("../../../assets/sprite_assets/pngs/v2/isometric-test/dog-idle-sitting.png", import.meta.url).href],
  ...Object.entries(import.meta.glob("../../../assets/sprite_assets/pngs/v2/isometric-test/dog-walk-*.webp", { eager: true, query: "?url", import: "default" }))
    .sort(([a], [b]) => a.localeCompare(b)).map(([, url], index): [string, string] => [String(index), url as string]),
]);
export type DogState = Readonly<{ position: IsoCell; target: IsoCell | null; elapsed: number; walking: boolean; flip: boolean; checkIn: number;
  constructionExit?: Readonly<{ footprint: readonly IsoCell[]; path: readonly IsoCell[] }> }>;
export const dogClear = (snapshot: FarmSnapshot, cell: IsoCell, now: number) =>
  previewWalkable(snapshot, cell, now) && !snapshot.crops.some(c => sameCell(c, cell)) && !snapshot.groundItems.some(i => sameCell(i, cell));
export const initialDog = (snapshot: FarmSnapshot, farmer: IsoCell, now: number): DogState => {
  const road = Array.from({ length: 16 }, (_, i) => ({ column: config.worldBounds.minimumColumn + i, row: config.roadRow }))
    .filter(cell => dogClear(snapshot, cell, now) && !sameCell(cell, farmer))
    .sort((a, b) => Math.hypot(a.column - farmer.column, a.row - farmer.row) - Math.hypot(b.column - farmer.column, b.row - farmer.row));
  return { position: road[0] ?? { column: 0, row: 5 }, target: null, elapsed: 0, walking: false, flip: false, checkIn: 0 };
};
export const stepDog = (state: DogState, snapshot: FarmSnapshot, farmer: IsoCell, delta: number, now: number, mouseX: number | null, reserved: readonly IsoCell[] = []): DogState => {
  const dt = Math.max(0, Math.min(delta, 50));
  let target = state.target;
  let checkIn = Math.max(0, state.checkIn - dt);
  const isReserved = (cell: IsoCell) => reserved.some(r => r.column === Math.round(cell.column) && r.row === Math.round(cell.row));
  if (reserved.length) {
    // Leave the working area even when already close to the farmer. Keep walking
    // to the clear tile centre, then sit there until sweeping ends.
    if (target && isReserved(target)) target = null;
    if (!target && isReserved(state.position)) {
      const point = (cell: IsoCell) => ({ x: cell.column + 0.5, y: cell.row + 0.5 });
      const candidates = reserved.flatMap(cell => [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dc, dr]) =>
        ({ column: cell.column + dc!, row: cell.row + dr! })))
        .filter(cell => !isReserved(cell) && dogClear(snapshot, cell, now));
      const paths = candidates.flatMap(cell => {
        const path = findDogWalk(point(state.position), point(cell), { column: -4, row: 0, columns: 16, rows: config.riverRow },
          (column, row) => !isReserved({ column, row }) && dogClear(snapshot, { column, row }, now), 1);
        return path?.length ? [path] : [];
      }).sort((a, b) => a.length - b.length);
      const next = paths[0]?.[0];
      target = next ? { column: next.x - 0.5, row: next.y - 0.5 } : null;
    }
  }
  else if (Math.hypot(state.position.column - farmer.column, state.position.row - farmer.row) <= 1) target = null;
  else if (!target && checkIn === 0) {
    const point = (cell: IsoCell) => ({ x: cell.column + 0.5, y: cell.row + 0.5 });
    const path = planDogFollow(point(state.position), point(farmer), { column: -4, row: 0, columns: 16, rows: config.riverRow },
      (column, row) => dogClear(snapshot, { column, row }, now), 1);
    target = path[0] ? { column: path[0].x - 0.5, row: path[0].y - 0.5 } : null;
    checkIn = 150;
  }
  if (target && !dogClear(snapshot, target, now)) target = null;
  return moveDog({ ...state, target, checkIn }, dt, mouseX);
};
/** Shared normal-speed movement for following and cosmetic wandering. */
export const moveDog = (state: DogState, delta: number, mouseX: number | null): DogState => {
  const dt = Math.max(0, Math.min(delta, 50));
  const { target, checkIn } = state;
  if (!target) return { ...state, target: null, checkIn, walking: false, elapsed: 0, flip: dogFacingMouse(isoPoint(state.position).x, mouseX, state.flip) };
  const dc = target.column - state.position.column, dr = target.row - state.position.row;
  const distance = Math.hypot(dc, dr), step = Math.min(distance, dt * 0.12 / 64);
  const position = distance ? { column: state.position.column + dc / distance * step, row: state.position.row + dr / distance * step } : target;
  const dx = isoPoint(target).x - isoPoint(state.position).x;
  return { position, target: step >= distance ? null : target, checkIn: 0, elapsed: state.elapsed + dt, walking: step > 0, flip: dx === 0 ? state.flip : dx < 0 };
};
export const dogTexture = (state: DogState) => `dog-${state.walking ? Math.floor(state.elapsed / 120) % 6 : "sit"}`;
