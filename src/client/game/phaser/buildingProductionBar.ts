import type Phaser from "phaser";

/** Canvas graphics can sit below actors; DOM overlays cannot. */
export const createBuildingProductionBar = (
  scene: Phaser.Scene, x: number, y: number, width: number, actorDepth: number
) => {
  const graphic = scene.add.graphics({ x, y }).setDepth(actorDepth - 0.25);
  const update = (progress: number | null) => {
    graphic.clear().setVisible(progress !== null);
    if (progress === null) return;
    const left = -width / 2;
    graphic.fillStyle(0x000000, 0.2).fillRoundedRect(left, -4, width, 10, 5);
    graphic.fillStyle(0x493222).fillRoundedRect(left, -5, width, 10, 5);
    graphic.fillStyle(0xfff3dc).fillRoundedRect(left + 1, -4, width - 2, 8, 4);
    const fillWidth = (width - 6) * Math.max(0, Math.min(1, progress));
    if (fillWidth > 0) graphic.fillStyle(0x278fce).fillRoundedRect(left + 3, -2, fillWidth, 4, Math.min(2, fillWidth / 2));
  };
  return { graphic, update };
};
