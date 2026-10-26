import idle from "../../../assets/sprite_assets/pngs/v2/isometric-test/farmer-fishing-idle.png";
import lift from "../../../assets/sprite_assets/pngs/v2/isometric-test/farmer-fishing-cast-01.png";
import backswing from "../../../assets/sprite_assets/pngs/v2/isometric-test/farmer-fishing-cast-02.png";
import forward from "../../../assets/sprite_assets/pngs/v2/isometric-test/farmer-fishing-cast-03.webp";
import followThrough from "../../../assets/sprite_assets/pngs/v2/isometric-test/farmer-fishing-cast-04.png";

export const FISHING_SOURCES = { "fishing-idle": idle, "fishing-lift": lift, "fishing-backswing": backswing,
  "fishing-forward": forward, "fishing-follow-through": followThrough };
export const FISHING_CAST_DURATION = 1100;
/** One seated cast, never looped. A restored session goes straight to waiting. */
export const fishingTexture = (elapsed: number | null, reducedMotion = false): keyof typeof FISHING_SOURCES => {
  if (elapsed === null || elapsed < 0 || elapsed >= FISHING_CAST_DURATION || reducedMotion) return "fishing-idle";
  if (elapsed < 250) return "fishing-lift";
  if (elapsed < 550) return "fishing-backswing";
  if (elapsed < 750) return "fishing-forward";
  return "fishing-follow-through";
};
