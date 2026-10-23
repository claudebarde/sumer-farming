import { isoPoint } from "./isometricProjection";
import { ROAD_CONNECTIONS } from "./isometricRoads";
import type { Neighbourhood } from "../../../schemas/neighbourhood";

const origins = [[-6, -8], [0, -8], [6, -8], [8, -2], [8, 4],
  [6, 10], [0, 10], [-6, 10], [-11, 4], [-11, -2]] as const;
export const neighbourhoodBounds = { minimumColumn: -13, maximumColumn: 13, minimumRow: -10, maximumRow: 15 };
export const neighbourhoodRoads = Array.from({ length: 14 * 14 }, (_, i) => ({
  column: i % 14 - 6, row: Math.floor(i / 14) - 4,
})).filter(p => p.column === -6 || p.column === 7 || p.row === -4 || p.row === 9 || p.column === 1 || p.row === 2);
export const neighbourhoodRoadMask = (column: number, row: number) => ROAD_CONNECTIONS.reduce((mask, d) =>
  neighbourhoodRoads.some(p => p.column === column + d.column && p.row === row + d.row) ? mask | d.bit : mask, 0);

/** Persistent membership slots determine positions, never roster ordering or viewer. */
export const neighbourhoodPlots = (members: Neighbourhood["members"]) =>
  Array.from({ length: 10 }, (_, slot) => {
    const [column, row] = origins[slot]!;
    const point = isoPoint({ column: column + 1.5, row: row + 1.5 });
    const member = members.find(m => m.slot === slot + 1);
    const type = member ? member.isYou ? "self" : "neighbour" : "empty";
    return {
      slot, type,
      column, row, x: point.x, y: point.y,
      name: member?.name ?? "Empty lot",
      level: member?.level ?? null,
    } as const;
  });

/** Four-by-four plot, with a one-tile arable border around the 2×2 farmhouse. */
export const neighbourhoodPlotTiles = Array.from({ length: 16 }, (_, index) => {
  const column = index % 4, row = Math.floor(index / 4);
  return { column, row, arable: column === 0 || row === 0 || column === 3 || row === 3 };
});

/** Hand-scattered once, shared by every neighbourhood; never randomized on entry. */
export const neighbourhoodScenery = [
  ...[[-8, -8], [-2, -9], [5, -6], [12, -4], [12, 5],
    [5, 14], [-2, 14], [-12, 10], [-12, 1], [-3, 5]].map(([column, row], index) => ({
    column: column!, row: row!, type: "bush" as const, texture: index % 2 ? "bush02" : "bush01",
  })),
  ...[[-10, -6], [-3, -10], [4, -9], [11, -6], [12, 1],
    [11, 11], [4, 14], [-8, 13], [-12, -4], [4, 6]].map(([column, row], index) => ({
    column: column!, row: row!, type: "rock" as const, texture: index % 2 ? "rocks02" : "rocks01",
  })),
] as const;
