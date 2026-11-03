import idle from "../../../assets/sprite_assets/pngs/v2/isometric-test/clay/farmer-carry-clay-idle-test.png";
import walk01 from "../../../assets/sprite_assets/pngs/v2/isometric-test/clay/farmer-carry-clay-walk-01.png";
import walk02 from "../../../assets/sprite_assets/pngs/v2/isometric-test/clay/farmer-carry-clay-walk-02.png";

export const FARMER_CLAY_SOURCES = { "farmer-clay-idle": idle, "farmer-clay-walk-0": walk01, "farmer-clay-walk-1": walk02 } as const;
// One registration for the 1254px frames keeps the basket stable across strides.
export const FARMER_CLAY_BOUNDS = { left: 275, top: 75, right: 980, bottom: 1180 };
export const farmerClayCarryTexture = (distance: number, moving: boolean) => moving
  ? `farmer-clay-walk-${Math.floor(Math.max(0, distance) / 35) % 2}` : "farmer-clay-idle";
