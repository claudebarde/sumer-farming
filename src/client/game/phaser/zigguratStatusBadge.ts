import type Phaser from "phaser";
import { FARM_SPRITES } from "../../../assets/farmSprites";
import { artworkBounds } from "./buildingProgressBar";

export const preloadZigguratStatusBadge = (scene: Phaser.Scene) => {
  scene.load.image("ziggurat-status-clay", FARM_SPRITES.brickPile);
  scene.load.image("ziggurat-status-reeds", FARM_SPRITES.reedBundle);
};

export const createZigguratStatusBadge = (scene: Phaser.Scene, building: Phaser.GameObjects.Image, open: () => void) => {
  const background = scene.add.graphics();
  const clay = scene.add.image(0, 0, "ziggurat-status-clay").setDisplaySize(28, 28);
  const reeds = scene.add.image(0, 0, "ziggurat-status-reeds").setDisplaySize(28, 28);
  const text = scene.add.text(0, 0, "", { fontFamily: "Georgia", fontSize: "18px", fontStyle: "bold", color: "#3b2516" })
    .setResolution(2).setOrigin(0, 0.5);
  const hit = scene.add.zone(0, 0, 1, 40).setInteractive().on("pointerup", (pointer: Phaser.Input.Pointer) => {
    if (pointer.getDistance() < 8) open();
  });
  const container = scene.add.container(0, 0, [background, clay, reeds, text, hit]).setDepth(20001).setVisible(false);
  let previous: string | null = null;
  return {
    update: (label: string | null) => {
      container.setVisible(label !== null);
      if (label === null) return;
      if (label !== previous) {
        previous = label;
        const materials = label === "Materials needed";
        text.setText(label);
        const width = text.width + (materials ? 86 : 28);
        text.setX(-width / 2 + (materials ? 72 : 14));
        clay.setVisible(materials).setX(-width / 2 + 22);
        reeds.setVisible(materials).setX(-width / 2 + 49);
        background.clear().fillStyle(0xfff7e8).fillRoundedRect(-width / 2, -20, width, 40, 8)
          .lineStyle(2, 0xdabb82).strokeRoundedRect(-width / 2, -20, width, 40, 8);
        hit.setSize(width, 40);
      }
      const bounds = artworkBounds(building);
      container.setPosition(bounds.x + bounds.width / 2, bounds.y - 28);
    },
  };
};
