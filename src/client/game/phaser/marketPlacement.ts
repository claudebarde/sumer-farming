type Rectangle = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export const MARKET_SIZE = 2;

/** Prefer the right edge, searching down from row two before trying other rows. */
export const getMarketPosition = (
  width: number,
  height: number,
  tileSize: number,
  obstacles: readonly Rectangle[]
): { readonly x: number; readonly y: number } => {
  const size = MARKET_SIZE * tileSize;
  const right = Math.max(0, width - size);
  const maximumRow = Math.max(0, Math.floor((height - size) / tileSize));
  const preferredRow = Math.min(2, maximumRow);
  const rows = [
    ...Array.from({ length: maximumRow - preferredRow + 1 }, (_, i) => preferredRow + i),
    ...Array.from({ length: preferredRow }, (_, i) => preferredRow - i - 1)
  ];
  const columns = Array.from({ length: Math.ceil(right / tileSize) + 1 }, (_, i) =>
    Math.max(0, right - i * tileSize)
  );
  const positions = columns.flatMap(x => rows.map(row => ({ x, y: row * tileSize })));
  return positions.find(({ x, y }) => obstacles.every(obstacle =>
    x + size <= obstacle.x || x >= obstacle.x + obstacle.width ||
    y + size <= obstacle.y || y >= obstacle.y + obstacle.height
  )) ?? { x: right, y: preferredRow * tileSize };
};
