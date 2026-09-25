export const CARRY_BUBBLE_RADIUS = 12;
const EDGE_INSET = CARRY_BUBBLE_RADIUS + 2; // Include the outline and a small gap.

export const getCarryBubblePosition = (
  farmerX: number,
  farmerY: number,
  tileSize: number,
  canvasWidth: number,
  canvasHeight: number
) => {
  const clampToCanvas = (position: number, size: number) => {
    const inset = Math.min(EDGE_INSET, size / 2);
    return Math.max(inset, Math.min(size - inset, position));
  };
  return {
    x: clampToCanvas(farmerX + tileSize * 0.78, canvasWidth),
    y: clampToCanvas(farmerY + tileSize * 0.08, canvasHeight)
  };
};
