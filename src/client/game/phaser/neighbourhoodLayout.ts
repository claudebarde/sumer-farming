import { isoPoint, footprintFront, type IsoCell } from "./isometricProjection";
import { ROAD_CONNECTIONS } from "./isometricRoads";
import type { Neighbourhood } from "../../../schemas/neighbourhood";

import { neighbourhoodPlotOrigins as origins, neighbourhoodMarket, neighbourhoodRoads } from "../../../game-data/neighbourhoodGeometry";
export { neighbourhoodBounds, neighbourhoodMarket, neighbourhoodRoads, neighbourhoodMarketRoadLoop } from "../../../game-data/neighbourhoodGeometry";
// Dedicated loop around the market, directly beside its footprint.
// Ordered cardinal steps are shared by terrain rendering and character routes.
export const neighbourhoodMarketDepth = footprintFront(neighbourhoodMarket,
  neighbourhoodMarket.columns, neighbourhoodMarket.rows).y - 24;
/** Sort around the two front footprint edges, including their side corners. */
export const neighbourhoodMarketCharacterDepth = (position: IsoCell) => {
  const inFront = position.column >= neighbourhoodMarket.column + neighbourhoodMarket.columns - 0.5 ||
    position.row >= neighbourhoodMarket.row + neighbourhoodMarket.rows - 0.5;
  const groundDepth = isoPoint(position).y + 1;
  return inFront ? Math.max(groundDepth, neighbourhoodMarketDepth + 1)
    : Math.min(groundDepth, neighbourhoodMarketDepth - 1);
};
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
    [11, 11], [4, 14], [-8, 13], [-12, -4], [5, 7]].map(([column, row], index) => ({
    column: column!, row: row!, type: "rock" as const, texture: index % 2 ? "rocks02" : "rocks01",
  })),
] as const;
