import { findRoadPreferredPath } from "../../../game-core/farm/roadPath";
import { roadKey, type RoadCoordinate } from "../../../game-core/farm/roads";

// Keep the bottom stand (rows 8–9) visible on short landscape screens too.
export const marketSceneZoom = (width: number, height: number, tileSize: number) =>
  Math.min(1, width / (10 * tileSize), height / (10 * tileSize));

export const marketSceneLayout = (columns: number) => {
  const left = Math.max(3, Math.floor(columns / 2) - 2);
  return { left, right: left + 4, top: 3, bottom: 7, roadRow: 5,
    farm: { column: 0, row: 3 },
    farmer: { column: 1, row: 5 },
    stands: [
      { column: left + 1, row: 1 },
      { column: left + 1, row: 4 },
      { column: left + 1, row: 8 }
    ] } as const;
};

export const marketRoadTiles = (columns: number): readonly RoadCoordinate[] => {
  const { left, right, top, bottom, roadRow } = marketSceneLayout(columns);
  return Array.from({ length: columns * (bottom + 1) }, (_, index) => ({
    column: index % columns, row: Math.floor(index / columns)
  })).filter(({ column, row }) =>
    ((row === top || row === bottom) && column >= left && column <= right) ||
    ((column === left || column === right) && row >= top && row <= bottom) ||
    (row === roadRow && (column < left || column > right))
  );
};

export const marketStandStop = (columns: number, standIndex: number): RoadCoordinate => {
  const layout = marketSceneLayout(columns);
  const stand = layout.stands[standIndex]!;
  // The central beer stand is approached from the side of the road loop;
  // keep its stop distinct from the bread stand on the southern road.
  if (standIndex === 1) return { column: layout.left, row: layout.roadRow };
  return { column: stand.column, row: standIndex === 0 ? layout.top : layout.bottom };
};

/** Only road tiles are traversable, including on the way back to the farm. */
export const marketWalkingPath = (columns: number, start: RoadCoordinate, target: RoadCoordinate) => {
  const roads = new Set(marketRoadTiles(columns).map(roadKey));
  const rows = marketSceneLayout(columns).bottom + 1;
  const blocked = new Set(Array.from({ length: columns * rows }, (_, index) =>
    roadKey({ column: index % columns, row: Math.floor(index / columns) })
  ).filter(key => !roads.has(key)));
  return findRoadPreferredPath(start, target, { columns, rows }, blocked, roads);
};
