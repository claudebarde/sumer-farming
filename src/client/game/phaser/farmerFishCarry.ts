import idle from "../../../assets/sprite_assets/pngs/v2/isometric-test/farmer-holding-fish-idle.png";
import walk01 from "../../../assets/sprite_assets/pngs/v2/isometric-test/farmer-holding-fish-walk-01.png";
import walk02 from "../../../assets/sprite_assets/pngs/v2/isometric-test/farmer-holding-fish-walk-02.png";

export const FARMER_FISH_SOURCES = {
  "farmer-fish-idle": idle,
  "farmer-fish-walk-0": walk01,
  "farmer-fish-walk-1": walk02,
} as const;

// Shared framing for all three 1101×1428 exports. Preserve pose alignment,
// removing only the common vertical padding rather than fitting each silhouette.
export const FARMER_FISH_BOUNDS = { left: 0, top: 40, right: 1100, bottom: 1390 } as const;

export const farmerFishCarryTexture = (distance: number, moving: boolean): string =>
  moving ? `farmer-fish-walk-${Math.floor(Math.max(0, distance) / 35) % 2}` : "farmer-fish-idle";
