import carry01 from "../../../assets/sprite_assets/pngs/v2/walking-test/farmer-carry-barley-01.png";
import carry02 from "../../../assets/sprite_assets/pngs/v2/walking-test/farmer-carry-barley-02.png";
import { farmerWalkTexture } from "./farmerWalk";

export const FARMER_CARRY_SOURCES = [carry01, carry02] as const;
export const FARMER_CARRY_BOUNDS = { left: 44, top: 24, right: 467, bottom: 447 } as const;

export const farmerTravelTexture = (distance: number, barley: number, moving: boolean): string => {
  // Match the normal walk's 70-world-pixel full cycle, not its per-pose interval.
  if (barley > 0) return `farmer-carry-v2-${moving ? Math.floor(Math.max(0, distance) / 35) % 2 : 0}`;
  return moving ? farmerWalkTexture(distance) : "farmer-idle";
};
