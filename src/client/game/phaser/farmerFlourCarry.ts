import idle from "../../../assets/sprite_assets/pngs/v2/isometric-test/mill-active/farmer-carry-flour-idle.webp";
import walk01 from "../../../assets/sprite_assets/pngs/v2/isometric-test/mill-active/farmer-carry-flour-walk-01.webp";
import walk02 from "../../../assets/sprite_assets/pngs/v2/isometric-test/mill-active/farmer-carry-flour-walk-02.webp";

export const FARMER_FLOUR_SOURCES = {
  "farmer-flour-idle": idle,
  "farmer-flour-walk-0": walk01,
  "farmer-flour-walk-1": walk02,
} as const;

// Both walk exports share one frame; never fit each stride independently.
// The idle export is separately cropped, so register it to the same foot baseline.
export const farmerFlourBounds = (key: string) => key === "farmer-flour-idle"
  ? { left: 0, top: 0, right: 705, bottom: 1260 }
  : { left: 160, top: 90, right: 980, bottom: 1470 };

/** Same 70-world-pixel cycle as the default walk and other two-pose carries. */
export const farmerFlourCarryTexture = (distance: number, moving: boolean): string =>
  moving ? `farmer-flour-walk-${Math.floor(Math.max(0, distance) / 35) % 2}` : "farmer-flour-idle";
