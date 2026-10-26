import idle from "../../../assets/sprite_assets/pngs/v2/isometric-test/date-palms/farmer-carry-dates-idle-v2.webp";
import walk01 from "../../../assets/sprite_assets/pngs/v2/isometric-test/date-palms/farmer-carry-dates-walk-01.webp";
import walk02 from "../../../assets/sprite_assets/pngs/v2/isometric-test/date-palms/farmer-carry-dates-walk-02.webp";
import walk03 from "../../../assets/sprite_assets/pngs/v2/isometric-test/date-palms/farmer-carry-dates-walk-03.webp";
import walk04 from "../../../assets/sprite_assets/pngs/v2/isometric-test/date-palms/farmer-carry-dates-walk-04.webp";

export const FARMER_DATE_SOURCES = {
  "farmer-dates-idle": idle, "farmer-dates-walk-0": walk01,
  "farmer-dates-walk-1": walk02, "farmer-dates-walk-2": walk03, "farmer-dates-walk-3": walk04
} as const;
// One registration for every frame: never fit each stride independently.
export const FARMER_DATE_BOUNDS = { left: 0, top: 50, right: 1253, bottom: 1230 } as const;
export const FARMER_DATE_ORIGIN = { x: 0.55, y: 0.925 } as const;
// Compensate for the wide canvas, with a further 10% visual scale adjustment.
// Keep the shared foot origin unchanged so enlarging does not shift the road anchor.
export const FARMER_DATE_DISPLAY_SIZE = 77;
export const farmerDateCarryTexture = (elapsed: number, moving = true) => moving
  ? `farmer-dates-walk-${Math.floor(Math.max(0, elapsed) / 160) % 4}` : "farmer-dates-idle";

