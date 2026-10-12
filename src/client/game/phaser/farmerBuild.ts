import build01 from "../../../assets/sprite_assets/pngs/v2/isometric-test/farmer-build-01.png";
import build02 from "../../../assets/sprite_assets/pngs/v2/isometric-test/farmer-build-02.png";
import build03 from "../../../assets/sprite_assets/pngs/v2/isometric-test/farmer-build-03.png";

export const FARMER_BUILD_SOURCES = [build01, build02, build03] as const;
// Shared square crop keeps the full tool swing and fixed foot baseline in all poses.
export const FARMER_BUILD_BOUNDS = { left: 48, top: 16, right: 479, bottom: 447 } as const;
const BUILD_CYCLE = [0, 1, 2, 1] as const;
export const farmerBuildTexture = (elapsed: number): string =>
  `farmer-build-v2-${BUILD_CYCLE[Math.floor(Math.max(0, elapsed) / 350) % BUILD_CYCLE.length]}`;
