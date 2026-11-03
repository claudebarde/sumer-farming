import idle from "../../../assets/sprite_assets/pngs/v2/isometric-test/reeds/farmer-carry-reeds-idle.png";
import walk01 from "../../../assets/sprite_assets/pngs/v2/isometric-test/reeds/farmer-carry-reeds-walk-01.png";
import walk02 from "../../../assets/sprite_assets/pngs/v2/isometric-test/reeds/farmer-carry-reeds-walk-02.png";

export const FARMER_REED_SOURCES = { "farmer-reed-idle": idle, "farmer-reed-walk-0": walk01, "farmer-reed-walk-1": walk02 } as const;
// Shared registration preserves the head, bundle and feet across all 1254px frames.
export const FARMER_REED_BOUNDS = { left: 358, top: 52, right: 955, bottom: 1102 };
export const farmerReedCarryTexture = (distance: number, moving: boolean) => moving
  ? `farmer-reed-walk-${Math.floor(Math.max(0, distance) / 35) % 2}` : "farmer-reed-idle";
