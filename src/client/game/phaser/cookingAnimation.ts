import idle from "../../../assets/sprite_assets/pngs/v2/isometric-test/kitchen/farmer-cooking-idle.png";
import first from "../../../assets/sprite_assets/pngs/v2/isometric-test/kitchen/farmer-cooking-01.png";
import second from "../../../assets/sprite_assets/pngs/v2/isometric-test/kitchen/farmer-cooking-02.png";
import third from "../../../assets/sprite_assets/pngs/v2/isometric-test/kitchen/farmer-cooking-03.png";

export const COOKING_FRAMES = [idle, first, second, third];
// One crop and foot registration for every frame, matching normal farmer preparation.
// Symmetric extra room preserves the centre/scale while retaining the extended hands.
export const COOKING_BOUNDS = { left: 250, top: 50, right: 1000, bottom: 1180 };
const sequence = [0, 1, 2, 3, 2, 1] as const;
export const cookingFrame = (elapsed: number, reduced: boolean, front = false) =>
  `farmer-cooking-${front ? "front-" : ""}${reduced ? 0 : sequence[Math.floor(elapsed / 260) % sequence.length]}`;
