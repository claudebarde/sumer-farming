import { INITIAL_FARM_CONFIG } from "../../../game-data/initialFarm";

type Rectangle = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export const MARKET_SIZE = 2;

/** Keep the market directly above the road; avoid obstacles by moving sideways. */
export const getMarketPosition = (
  width: number,
  height: number,
  tileSize: number,
  obstacles: readonly Rectangle[]
): { readonly x: number; readonly y: number } => {
  const size = MARKET_SIZE * tileSize;
  const right = Math.max(0, width - size);
  const y = Math.max(0, Math.min((INITIAL_FARM_CONFIG.roadRow - MARKET_SIZE) * tileSize, height - size));
  const columns = Array.from({ length: Math.ceil(right / tileSize) + 1 }, (_, i) =>
    Math.max(0, right - i * tileSize)
  );
  const positions = columns.map(x => ({ x, y }));
  return positions.find(({ x, y }) => obstacles.every(obstacle =>
    x + size <= obstacle.x || x >= obstacle.x + obstacle.width ||
    y + size <= obstacle.y || y >= obstacle.y + obstacle.height
  )) ?? { x: right, y };
};
