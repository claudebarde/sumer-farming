import idle from "../../../assets/sprite_assets/pngs/v2/isometric-test/bread-oven-active/farmer-carry-bread-idle.png";
import walk01 from "../../../assets/sprite_assets/pngs/v2/isometric-test/bread-oven-active/farmer-carry-bread-walk-01.png";
import walk02 from "../../../assets/sprite_assets/pngs/v2/isometric-test/bread-oven-active/farmer-carry-bread-walk-02.png";

export const FARMER_BREAD_SOURCES = { "farmer-bread-idle": idle, "farmer-bread-walk-0": walk01, "farmer-bread-walk-1": walk02 } as const;
// Shared registration for the two 1536px walking exports preserves stride alignment.
export const FARMER_BREAD_WALK_BOUNDS = { left: 350, top: 125, right: 1190, bottom: 1405 };
export const farmerBreadCarryTexture = (distance: number, moving: boolean) => moving
  ? `farmer-bread-walk-${Math.floor(Math.max(0, distance) / 35) % 2}` : "farmer-bread-idle";
