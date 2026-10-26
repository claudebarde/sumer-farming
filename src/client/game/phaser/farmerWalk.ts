import walk01 from "../../../assets/sprite_assets/pngs/v2/walking-test/farmer-walk-01.webp";
import walk02 from "../../../assets/sprite_assets/pngs/v2/walking-test/farmer-walk-02.webp";
import walk04 from "../../../assets/sprite_assets/pngs/v2/walking-test/farmer-walk-04.webp";
import walk05 from "../../../assets/sprite_assets/pngs/v2/walking-test/farmer-walk-05.webp";
import walk06 from "../../../assets/sprite_assets/pngs/v2/walking-test/farmer-walk-06.webp";
import walk08 from "../../../assets/sprite_assets/pngs/v2/walking-test/farmer-walk-08.webp";

export const FARMER_WALK_SOURCES = [walk01, walk02, walk04, walk05, walk06, walk08] as const;
export const FARMER_WALK_BOUNDS = { left: 100, top: 70, right: 960, bottom: 1470 } as const;
// Reverse through intermediate poses so the loop has no last-to-first snap.
export const FARMER_WALK_CYCLE = [0, 1, 2, 3, 4, 5, 4, 3, 2, 1] as const;
export const farmerWalkTexture = (distance: number): string =>
  `farmer-walk-v2-${FARMER_WALK_CYCLE[Math.floor(Math.max(0, distance) / 7) % FARMER_WALK_CYCLE.length]}`;
