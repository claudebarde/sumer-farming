import idle from "../../../assets/sprite_assets/pngs/v2/isometric-test/sesame/farmer-carrying-sesame-idle.png";
import walk01 from "../../../assets/sprite_assets/pngs/v2/isometric-test/sesame/farmer-carry-sesame-walk-01.png";
import walk02 from "../../../assets/sprite_assets/pngs/v2/isometric-test/sesame/farmer-carry-sesame-walk-02.png";
import walk03 from "../../../assets/sprite_assets/pngs/v2/isometric-test/sesame/farmer-carry-sesame-walk-03.png";
import walk04 from "../../../assets/sprite_assets/pngs/v2/isometric-test/sesame/farmer-carry-sesame-walk-04.png";

// Frames share the approved date carrier's canvas, foot anchor and scale.
export const FARMER_SESAME_SOURCES = {
  "farmer-sesame-idle": idle, "farmer-sesame-walk-0": walk01,
  "farmer-sesame-walk-1": walk02, "farmer-sesame-walk-2": walk03, "farmer-sesame-walk-3": walk04
} as const;
export const farmerSesameCarryTexture = (elapsed: number, moving = true) => moving
  ? `farmer-sesame-walk-${Math.floor(Math.max(0, elapsed) / 160) % 4}` : "farmer-sesame-idle";
