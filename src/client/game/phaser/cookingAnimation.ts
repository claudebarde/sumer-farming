import type Phaser from "phaser";
import idle from "../../../assets/sprite_assets/pngs/v2/isometric-test/kitchen/farmer-cooking-idle.png";
import first from "../../../assets/sprite_assets/pngs/v2/isometric-test/kitchen/farmer-cooking-01.png";
import second from "../../../assets/sprite_assets/pngs/v2/isometric-test/kitchen/farmer-cooking-02.png";
import third from "../../../assets/sprite_assets/pngs/v2/isometric-test/kitchen/farmer-cooking-03.png";
import front0 from "../../../assets/sprite_assets/pngs/v2/isometric-test/kitchen/farmer-cooking-front-idle-test.png";
import front1 from "../../../assets/sprite_assets/pngs/v2/isometric-test/kitchen/farmer-cooking-front-01-test.png";
import front2 from "../../../assets/sprite_assets/pngs/v2/isometric-test/kitchen/farmer-cooking-front-02-test.png";
import front3 from "../../../assets/sprite_assets/pngs/v2/isometric-test/kitchen/farmer-cooking-front-03-test.png";
import { isoPoint, type IsoCell } from "./isometricProjection";
import { kitchenAppearance } from "./kitchenAppearance";

export const COOKING_FRAMES = [idle, first, second, third];
// One crop and foot registration for every frame, matching normal farmer preparation.
// Symmetric extra room preserves the centre/scale while retaining the extended hands.
export const COOKING_BOUNDS = { left: 250, top: 50, right: 1000, bottom: 1180 };
export const COOKING_FRONT_FRAMES = [front0, front1, front2, front3];
export const COOKING_FRONT_BOUNDS = { left: 250, top: 50, right: 1000, bottom: 1200 };
const sequence = [0, 1, 2, 3, 2, 1] as const;
export const cookingFrame = (elapsed: number, reduced: boolean, front = false) =>
  `farmer-cooking-${front ? "front-" : ""}${reduced ? 0 : sequence[Math.floor(elapsed / 260) % sequence.length]}`;

/** Visual reach from the connecting road; does not change the farmer's saved tile. */
export const cookingWorkPosition = (kitchen: IsoCell, road: IsoCell) => {
  const front = road.column < kitchen.column || road.row < kitchen.row;
  const reach = front ? 0.7 : 0.42;
  return isoPoint({
    column: road.column + (kitchen.column - road.column) * reach,
    row: road.row + (kitchen.row - road.row) * reach,
  });
};

export const renderCookingAnimation = (actor: Phaser.GameObjects.Image, shadow: Phaser.GameObjects.Ellipse,
  effects: Phaser.GameObjects.Graphics, steam: Phaser.GameObjects.Graphics, kitchen: IsoCell, road: IsoCell, elapsed: number, reduced: boolean) => {
  const feet = cookingWorkPosition(kitchen, road), appearance = kitchenAppearance(kitchen, road);
  const vertical = appearance.texture === "kitchen-vertical";
  const pot = { x: appearance.x + (vertical ? 8 : -8), y: appearance.y - 44 };
  const front = road.column < kitchen.column || road.row < kitchen.row;
  actor.setTexture(cookingFrame(elapsed, reduced, front)).setOrigin(0.5, 120 / 128)
    .setDisplaySize(64, 64).setPosition(feet.x, feet.y).setFlipX(pot.x < feet.x)
    .setDepth(front ? appearance.y - 1 : Math.max(feet.y + 2, appearance.y + 1)).setAngle(0);
  shadow.setPosition(feet.x, feet.y).setDepth(feet.y);
  // Keep fire above the stove but below the farmer, even where his face overlaps it.
  effects.clear().setDepth(front ? appearance.y + 0.5 : actor.depth - 0.5);
  steam.clear().setDepth(Math.max(feet.y + 3, appearance.y + 2));
  for (const side of [-1, 1]) {
    // Sit against the pot's lower sides, above the stove's front face.
    // The horizontal artwork's pot base is slightly lower in its source frame.
    const x = pot.x + side * 9, y = pot.y + (vertical ? 0 : 4);
    const flicker = reduced ? 0 : Math.sin(elapsed / 110 + side) * 2;
    effects.fillStyle(0xed7a20, 0.85).fillEllipse(x, y, 7, 10 + flicker);
    effects.fillStyle(0xffd468, 0.95).fillEllipse(x, y + 2, 3, 6 + flicker);
  }
  if (!reduced) for (let i = 0; i < 4; i++) {
    const t = ((elapsed + i * 650) % 2600) / 2600;
    steam.fillStyle(0xfff7e8, Math.sin(t * Math.PI) * 0.4)
      .fillEllipse(pot.x + Math.sin(t * 5 + i) * 3, pot.y - 12 - t * 29, 5 + t * 8, 4 + t * 6);
  }
};
