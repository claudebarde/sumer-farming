type Position = { readonly column: number; readonly row: number };
const key = (p: Position) => `${p.column}:${p.row}`;

/** Goods keep their loading tile; the farmer uses the nearest free connected road. */
export const productionStandingTile = (target: Position, roads: readonly Position[], goods: readonly Position[]): Position => {
  const occupied = new Set(goods.map(key));
  if (!occupied.has(key(target))) return target;
  const roadKeys = new Set(roads.map(key));
  const queue = [target];
  const visited = new Set([key(target)]);
  for (let index = 0; index < queue.length; index++) {
    const p = queue[index]!;
    const neighbors = [
      { column: p.column - 1, row: p.row }, { column: p.column + 1, row: p.row },
      { column: p.column, row: p.row + 1 }, { column: p.column, row: p.row - 1 }
    ];
    for (const next of neighbors) {
      if (visited.has(key(next)) || !roadKeys.has(key(next))) continue;
      if (!occupied.has(key(next))) return next;
      visited.add(key(next));
      queue.push(next);
    }
  }
  return target;
};
