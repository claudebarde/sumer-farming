/** Reject stale input hits outside the sprite's currently rendered bounds. */
export const visibleSpriteHit = (
  visible: boolean,
  alpha: number,
  bounds: { x: number; y: number; width: number; height: number },
  point: { x: number; y: number },
): boolean => visible && alpha > 0 &&
  point.x >= bounds.x && point.x <= bounds.x + bounds.width &&
  point.y >= bounds.y && point.y <= bounds.y + bounds.height;
