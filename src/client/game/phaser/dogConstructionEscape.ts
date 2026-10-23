import { getBuildingFootprint } from "../../../game-core/farm/buildings";
import { INITIAL_FARM_CONFIG as config } from "../../../game-data/initialFarm";
import type { FarmSnapshot } from "../../../schemas/farm";
import { sameCell } from "./isometricFarm";
import type { IsoCell } from "./isometricProjection";
import { dogClear, moveDog, type DogState } from "./isometricDog";

const tile = (p: IsoCell): IsoCell => ({ column: Math.round(p.column), row: Math.round(p.row) });

/** Cosmetic only: construction is already saved and never waits for this walk. */
export const stepDogConstructionEscape = (dog: DogState, snapshot: FarmSnapshot, input: {
  now: number; delta: number; animate: boolean; occupied: readonly IsoCell[];
}): { dog: DogState; visible: boolean } | null => {
  const footprint = dog.constructionExit?.footprint ?? snapshot.buildings
    .filter(b => Date.parse(b.completesAt) > input.now)
    .map(b => getBuildingFootprint(b.type, b)).find(cells => cells.some(p => sameCell(p, tile(dog.position))));
  if (!footprint) return null;
  const occupied = (p: IsoCell) => input.occupied.some(o => sameCell(tile(o), p));
  const clear = (p: IsoCell) => dogClear(snapshot, p, input.now) && !occupied(p);
  const inside = (p: IsoCell) => footprint.some(c => sameCell(c, p));
  const traversable = (p: IsoCell) => clear(p) || (inside(p) && !occupied(p));
  let path = dog.constructionExit?.path ?? [];
  if (!path.length || !path.every(traversable) || !clear(path[path.length - 1]!)) {
    // Breadth-first exit search can cross only this construction site, never a
    // neighbouring building. Retain tile steps across frames to avoid jitter.
    const origin = tile(dog.position);
    const queue = [{ cell: origin, path: [] as IsoCell[] }];
    const visited = new Set([`${origin.column}:${origin.row}`]);
    path = [];
    for (const entry of queue) {
      if (entry.path.length && clear(entry.cell)) { path = entry.path; break; }
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const next = { column: entry.cell.column + dc!, row: entry.cell.row + dr! };
        const key = `${next.column}:${next.row}`;
        if (visited.has(key) || !traversable(next)) continue;
        visited.add(key);
        queue.push({ cell: next, path: [...entry.path, next] });
      }
    }
  }
  if (!input.animate || !path.length) {
    const candidates: IsoCell[] = [];
    for (let row = config.worldBounds.minimumRow; row < config.riverRow; row++) {
      for (let column = config.worldBounds.minimumColumn; column <= config.worldBounds.maximumColumn; column++) {
        const cell = { column, row };
        if (clear(cell)) candidates.push(cell);
      }
    }
    const distance = (p: IsoCell) => Math.hypot(p.column - dog.position.column, p.row - dog.position.row);
    const position = candidates.sort((a, b) => distance(a) - distance(b))[0];
    return { dog: { ...dog, position: position ?? dog.position, target: null, walking: false, elapsed: 0,
      checkIn: 150, constructionExit: position ? undefined : { footprint, path: [] } }, visible: !!position };
  }
  const moved = moveDog({ ...dog, target: path[0]! }, input.delta, null);
  const remaining = moved.target ? path : path.slice(1);
  return { dog: { ...moved, constructionExit: remaining.length ? { footprint, path: remaining } : undefined }, visible: true };
};
