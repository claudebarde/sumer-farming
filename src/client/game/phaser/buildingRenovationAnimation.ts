import type Phaser from "phaser";
import { createRenovationBuilder } from "./renovationBuilder";
import { drawBuildingProgress } from "./buildingProgressBar";

type Visual = Phaser.GameObjects.Image | Phaser.GameObjects.Graphics;

/** Shared presentation for every saved building upgrade, independent of production. */
export const createBuildingRenovationAnimation = (scene: Phaser.Scene,
  position: { x: number; y: number }, originals: readonly Visual[]) => {
  const site = scene.add.image(position.x, position.y, "building-renovation")
    .setOrigin(0.5, 0.89).setDisplaySize(180, 180).setDepth(position.y - 24).setVisible(false);
  const builder = createRenovationBuilder(scene, site);
  const progress = scene.add.graphics();
  let hidden: { visual: Visual; visible: boolean }[] = [];
  const restore = () => {
    for (const { visual, visible } of hidden) visual.setVisible(visible);
    hidden = [];
  };
  return {
    site,
    // Restore before the ordinary building renderers calculate this frame's pose.
    restore,
    render(state: { fraction: number } | null, now: number, reduced: boolean) {
      site.setVisible(state !== null);
      builder.render(state !== null, now, reduced);
      progress.clear();
      if (!state) return;
      hidden = originals.map(visual => ({ visual, visible: visual.visible }));
      originals.forEach(visual => visual.setVisible(false));
      drawBuildingProgress(progress, site, state.fraction);
    },
    destroy() { restore(); builder.destroy(); progress.destroy(); site.destroy(); }
  };
};
