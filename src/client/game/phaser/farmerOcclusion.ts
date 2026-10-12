export type OcclusionSprite = {
  left: number; top: number; width: number; height: number; depth: number;
  opaqueAt: (u: number, v: number) => boolean;
};

/** Sample actual artwork, not transparent rectangular margins. World-space only. */
export const farmerObscured = (farmer: OcclusionSprite, buildings: readonly OcclusionSprite[]): boolean => {
  const front = buildings.filter(b => b.depth > farmer.depth && b.left < farmer.left + farmer.width &&
    b.left + b.width > farmer.left && b.top < farmer.top + farmer.height && b.top + b.height > farmer.top);
  if (!front.length) return false;
  for (let row = 0; row < 20; row++) for (let column = 0; column < 16; column++) {
    const u = (column + 0.5) / 16, v = (row + 0.5) / 20;
    if (!farmer.opaqueAt(u, v)) continue;
    const x = farmer.left + u * farmer.width, y = farmer.top + v * farmer.height;
    if (front.some(b => x >= b.left && x < b.left + b.width && y >= b.top && y < b.top + b.height &&
      b.opaqueAt((x - b.left) / b.width, (y - b.top) / b.height))) return true;
  }
  return false;
};

export const hiddenFarmerBounce = (now: number, reducedMotion: boolean) =>
  reducedMotion ? 0 : -5 * (1 - Math.cos(now / 900 * Math.PI * 2)) / 2;
