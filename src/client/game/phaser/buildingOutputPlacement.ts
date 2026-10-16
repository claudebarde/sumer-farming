import { isoPoint, type IsoCell } from "./isometricProjection";

import { connectedRoadKeys, roadKey, roadNeighbors } from "../../../game-core/farm/roads";
import { INITIAL_FARM_CONFIG } from "../../../game-data/initialFarm";
import type { FarmRoad } from "../../../game-data/roads";

type Coordinate = { readonly column: number; readonly row: number };

/** Display finished goods inside the bottom-left tile, never on the access road. */
export const buildingOutputTile = (
  building: Coordinate,
  footprint: { readonly rows: number }
): Coordinate => ({ column: building.column, row: building.row + footprint.rows - 1 });

/** Choose only B/C; use the nearest connected adjacent road for collection too. */
export const roadsideOutputPlacement = (building: IsoCell & { loadingTile?: IsoCell | null }, roads: readonly FarmRoad[], now: number) => {
  const candidates = [{ column: building.column, row: building.row + 1 }, { column: building.column + 1, row: building.row }];
  const footprint = [0, 1].flatMap(row => [0, 1].map(column => ({ column: building.column + column, row: building.row + row })));
  const inside = new Set(footprint.map(roadKey));
  const connected = connectedRoadKeys(roads, now);
  const bounds = INITIAL_FARM_CONFIG.worldBounds;
  const adjacent = [...new Map(footprint.flatMap(roadNeighbors).map(tile => [roadKey(tile), tile])).values()]
    .filter(tile => !inside.has(roadKey(tile)) && tile.column >= bounds.minimumColumn && tile.column <= bounds.maximumColumn &&
      tile.row >= bounds.minimumRow && tile.row <= bounds.maximumRow &&
      (tile.row === INITIAL_FARM_CONFIG.roadRow || connected.has(roadKey(tile))));
  const distance = (a: IsoCell, b: IsoCell) => (a.column - b.column) ** 2 + (a.row - b.row) ** 2;
  const saved = adjacent.find(tile => building.loadingTile && roadKey(tile) === roadKey(building.loadingTile));
  const choices = candidates.map((tile, index) => {
    const ranked = [...adjacent].sort((a, b) => distance(tile, a) - distance(tile, b) ||
      Number(!!saved && roadKey(b) === roadKey(saved)) - Number(!!saved && roadKey(a) === roadKey(saved)) || a.row - b.row || a.column - b.column);
    return { tile, pickup: ranked[0] ?? null, distance: ranked[0] ? distance(tile, ranked[0]) : Infinity,
      savedDistance: saved ? distance(tile, saved) : Infinity, index };
  }).sort((a, b) => a.distance - b.distance || a.savedDistance - b.savedDistance || a.index - b.index);
  const chosen = choices[0]!;
  return { tile: chosen.tile, pickup: chosen.pickup };
};
export const isometricOutputPosition = (tile: IsoCell) => {
  const p = isoPoint(tile);
  return { x: p.x, y: p.y + 16 };
};
