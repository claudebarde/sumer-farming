import walk01 from "../../../assets/sprite_assets/pngs/v2/walking-test/farmer-walk-01.png";
import walk02 from "../../../assets/sprite_assets/pngs/v2/walking-test/farmer-walk-02.png";
import walk04 from "../../../assets/sprite_assets/pngs/v2/walking-test/farmer-walk-04.png";
import walk05 from "../../../assets/sprite_assets/pngs/v2/walking-test/farmer-walk-05.png";
import walk06 from "../../../assets/sprite_assets/pngs/v2/walking-test/farmer-walk-06.png";
import walk08 from "../../../assets/sprite_assets/pngs/v2/walking-test/farmer-walk-08.png";

export const FARMER_WALK_SOURCES = [walk01, walk02, walk04, walk05, walk06, walk08] as const;
export const FARMER_WALK_BOUNDS = { left: 100, top: 70, right: 960, bottom: 1470 } as const;
// Reverse through intermediate poses so the loop has no last-to-first snap.
export const FARMER_WALK_CYCLE = [0, 1, 2, 3, 4, 5, 4, 3, 2, 1] as const;
export const farmerWalkTexture = (distance: number): string =>
  `farmer-walk-v2-${FARMER_WALK_CYCLE[Math.floor(Math.max(0, distance) / 7) % FARMER_WALK_CYCLE.length]}`;
