import { isArableGround, sceneryPositions } from "./land";
import type { InitialFarmObject } from "../../game-data/initialFarm";

type Scenery = InitialFarmObject & { readonly id: string };
const key = (p: { readonly column: number; readonly row: number }) => `${p.column}:${p.row}`;

/** Preserve scenery identity and count; never overwrite occupied land. */
export const planArableSceneryRelocation = (
  objects: readonly Scenery[], occupied: ReadonlySet<string>
): { readonly type: "ready"; readonly moves: readonly Scenery[] } | { readonly type: "no_space" } => {
  const blocked = new Set([...occupied, ...objects.map(key)]);
  const moves: Scenery[] = [];
  // Reserve the scarce riverbank positions for reeds before moving decorations.
  const displaced = objects.filter(isArableGround).sort((a, b) =>
    Number(b.type === "reeds") - Number(a.type === "reeds") || a.id.localeCompare(b.id));
  for (const object of displaced) {
    const destination = sceneryPositions(object.type === "reeds")
      .filter(p => !blocked.has(key(p)))
      .sort((a, b) => (Math.abs(a.column - object.column) + Math.abs(a.row - object.row)) -
        (Math.abs(b.column - object.column) + Math.abs(b.row - object.row)))[0];
    if (!destination) return { type: "no_space" };
    blocked.add(key(destination));
    moves.push({ ...object, ...destination });
  }
  return { type: "ready", moves };
};
