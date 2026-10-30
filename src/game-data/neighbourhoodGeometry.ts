export const neighbourhoodPlotOrigins = [[-6, -8], [0, -8], [6, -8], [8, -2], [8, 4],
  [6, 10], [0, 10], [-6, 10], [-11, 4], [-11, -2]] as const;
export const neighbourhoodBounds = { minimumColumn: -13, maximumColumn: 13, minimumRow: -10, maximumRow: 15 };
export const neighbourhoodMarket = { column: 2, row: 3, columns: 2, rows: 2 } as const;
const marketRoadCorners = [{ column: 1, row: 2 }, { column: 4, row: 2 },
  { column: 4, row: 5 }, { column: 1, row: 5 }] as const;
export const neighbourhoodMarketRoadLoop = marketRoadCorners.flatMap((from, index) => {
  const to = marketRoadCorners[(index + 1) % marketRoadCorners.length]!;
  const length = Math.abs(to.column - from.column) + Math.abs(to.row - from.row);
  return Array.from({ length }, (_, step) => ({
    column: from.column + Math.sign(to.column - from.column) * step,
    row: from.row + Math.sign(to.row - from.row) * step,
  }));
});
const mainRoads = Array.from({ length: 14 * 14 }, (_, i) => ({
  column: i % 14 - 6, row: Math.floor(i / 14) - 4,
})).filter(p => p.column === -6 || p.column === 7 || p.row === -4 || p.row === 9 || p.column === 1 || p.row === 2);
// Divert the central crossing around the market courtyard, not through it.
export const neighbourhoodRoads = [...mainRoads.filter(p =>
  !(p.column >= neighbourhoodMarket.column && p.column < neighbourhoodMarket.column + neighbourhoodMarket.columns &&
    p.row >= neighbourhoodMarket.row && p.row < neighbourhoodMarket.row + neighbourhoodMarket.rows)),
  ...neighbourhoodMarketRoadLoop].filter((p, index, roads) =>
    roads.findIndex(other => other.column === p.column && other.row === p.row) === index);
