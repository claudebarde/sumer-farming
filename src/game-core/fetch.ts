export type FetchPoint = { readonly x: number; readonly y: number };
export type FetchRun = { readonly start: FetchPoint; readonly end: FetchPoint; readonly duration: number };
export const FETCH_FLIGHT_MS = 650;
export const FETCH_TOLERANCE = 22;

/** A short grid path for visible repositioning; the occupied starting tile may be exited. */
export const findDogWalk = (
  from: FetchPoint, to: FetchPoint,
  origin: { readonly column: number; readonly row: number; readonly columns?: number; readonly rows?: number },
  isClear: (column: number, row: number) => boolean, tileSize: number
): readonly FetchPoint[] | null => {
  const start = { column: Math.floor(from.x / tileSize), row: Math.floor(from.y / tileSize) };
  const goal = { column: Math.floor(to.x / tileSize), row: Math.floor(to.y / tileSize) };
  const queue = [{ ...start, path: [] as FetchPoint[] }];
  const visited = new Set([`${start.column}:${start.row}`]);
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i]!;
    if (current.column === goal.column && current.row === goal.row) {
      const centre = { x: (start.column + 0.5) * tileSize, y: (start.row + 0.5) * tileSize };
      const next = current.path[0];
      const aligned = next !== undefined && ((from.x === centre.x && next.x === centre.x) ||
        (from.y === centre.y && next.y === centre.y));
      return [...(aligned ? [] : [centre]), ...current.path, to].filter((p, index, points) => {
        const previous = index === 0 ? from : points[index - 1]!;
        return Math.hypot(p.x - previous.x, p.y - previous.y) > 0.1;
      });
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const column = current.column + dx, row = current.row + dy;
      const key = `${column}:${row}`;
      if (column < origin.column || column >= origin.column + (origin.columns ?? 8) || row < origin.row || row >= origin.row + (origin.rows ?? 8) ||
        visited.has(key) || !isClear(column, row)) continue;
      visited.add(key);
      queue.push({ column, row, path: [...current.path, { x: (column + 0.5) * tileSize, y: (row + 0.5) * tileSize }] });
    }
  }
  return null;
};

/** Follow to a reachable neighbouring tile, or wait; never target the farmer's tile. */
export const planDogFollow = (
  dog: FetchPoint, farmer: FetchPoint,
  bounds: { readonly column: number; readonly row: number; readonly columns: number; readonly rows: number },
  isClear: (column: number, row: number) => boolean, tileSize: number
): readonly FetchPoint[] => {
  if (Math.hypot(dog.x - farmer.x, dog.y - farmer.y) <= tileSize) return [];
  const column = Math.floor(farmer.x / tileSize), row = Math.floor(farmer.y / tileSize);
  const clear = (x: number, y: number) => !(x === column && y === row) && isClear(x, y);
  const paths = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).flatMap(([dx, dy]) => {
    const x = column + dx, y = row + dy;
    if (x < bounds.column || x >= bounds.column + bounds.columns || y < bounds.row || y >= bounds.row + bounds.rows || !clear(x, y)) return [];
    const target = { x: (x + 0.5) * tileSize, y: (y + 0.5) * tileSize };
    const path = findDogWalk(dog, target, bounds, clear, tileSize);
    return path === null ? [] : [path];
  });
  return paths.sort((a, b) => a.length - b.length)[0] ?? [];
};

export const findFetchRoutes = (
  origin: { readonly column: number; readonly row: number },
  isClear: (column: number, row: number) => boolean,
  tileSize: number
): FetchRun[] => {
  const candidates: FetchRun[] = [];
  const free = (column: number, row: number) => column >= origin.column && column < origin.column + 8 &&
    row >= origin.row && row < origin.row + 8 && isClear(column, row);
  for (let row = origin.row; row < origin.row + 8; row++) {
    for (let column = origin.column; column < origin.column + 8; column++) {
      if (!free(column, row)) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        let steps = 0;
        while (free(column + dx * (steps + 1), row + dy * (steps + 1))) steps++;
        if (steps < 3) continue;
        candidates.push({
          start: { x: (column + 0.5) * tileSize, y: (row + 0.5) * tileSize },
          end: { x: (column + 0.5 + dx * steps) * tileSize, y: (row + 0.5 + dy * steps) * tileSize },
          duration: 7_000
        });
      }
    }
  }
  return candidates;
};

// Constant pace for the first 75%, followed by a visible, smooth slowdown.
export const fetchProgress = (elapsed: number, duration: number): number => {
  const t = Math.max(0, Math.min(1, elapsed / duration));
  return t <= 0.75 ? t / 0.875 : (0.75 + (t - 0.75) - 2 * (t - 0.75) ** 2) / 0.875;
};
export const fetchPosition = (run: FetchRun, elapsed: number): FetchPoint => {
  const p = fetchProgress(elapsed, run.duration);
  return { x: run.start.x + (run.end.x - run.start.x) * p, y: run.start.y + (run.end.y - run.start.y) * p };
};
export const evaluateFetchThrow = (run: FetchRun, target: FetchPoint, landingTime: number) => {
  const dx = run.end.x - run.start.x;
  const dy = run.end.y - run.start.y;
  const length = Math.hypot(dx, dy);
  if (length === 0 || landingTime >= run.duration) return "stopped";
  const along = ((target.x - run.start.x) * dx + (target.y - run.start.y) * dy) / length;
  const sideways = Math.abs((target.x - run.start.x) * dy - (target.y - run.start.y) * dx) / length;
  if (sideways > FETCH_TOLERANCE) return "wide";
  if (along <= fetchProgress(landingTime, run.duration) * length) return "behind";
  if (along >= length) return "too_far";
  return "catchable";
};
