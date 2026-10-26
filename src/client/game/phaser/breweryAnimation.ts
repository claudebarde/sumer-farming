import Phaser from "phaser";
import { drawBuildingProgress } from "./buildingProgressBar";
import rest from "../../../assets/sprite_assets/pngs/v2/isometric-test/brewery/farmer-brew-rest.webp";
import left from "../../../assets/sprite_assets/pngs/v2/isometric-test/brewery/farmer-brew-stir-left.webp";
import right from "../../../assets/sprite_assets/pngs/v2/isometric-test/brewery/farmer-brew-stir-right.webp";
import stool from "../../../assets/sprite_assets/pngs/v2/isometric-test/farmer-idle-stool.png";
import { prepareFarmerTexture } from "./farmerTexture";
import { prepareBuildingTexture } from "./buildingTexture";
import { prepareBreweryFrontWall } from "./breweryLayout";

export const BREWING_WORKER_SOURCES = [rest, left, right];
export const BREWING_STOOL_SOURCE = stool;
// Preserve the approved left-vessel registration. The right trial translates
// both sprites by the same mouth-to-mouth offset without changing their scale.
export const BREWING_WORK_PLACEMENTS = {
  left: { x: -30, workerX: -27, seatY: -64, groundY: -40, size: 40 },
  right: { x: 1.5, workerX: 4.5, seatY: -56, groundY: -32, size: 40 },
} as const;
export const BREWING_STOOL_PLACEMENT = BREWING_WORK_PLACEMENTS.right;
import { BREWING_PREPARATION_MS } from "../../../game-data/brewing";
export { BREWING_PREPARATION_MS } from "../../../game-data/brewing";
// Shared registration: body remains 56 world pixels tall, like the walking farmer.
export const BREWING_WORKER_BOUNDS = { left: 55, top: 48, right: 705, bottom: 1278 };
export const brewingTestPose = (elapsed: number, reduced = false) => {
  const t = Math.max(0, elapsed);
  const cycle = t % 4000;
  const frames = [0, 1, 0, 2] as const;
  return { preparing: t < BREWING_PREPARATION_MS,
    frame: reduced || cycle >= 3000 ? 0 : frames[Math.floor(cycle / 375) % frames.length]!,
    progress: Math.min(1, t / BREWING_PREPARATION_MS) };
};
export const brewingFoamHeight = (elapsed: number, vessel: number, reduced: boolean) =>
  reduced ? 4 : 2 + 6 * (0.5 + 0.5 * Math.sin(elapsed / 1150 + vessel * 2.2));
// A persistent oval covers the entire mouth even at the bottom of the foam cycle.
export const BREWING_FOAM_BASE = { width: 24, height: 12 } as const;
/** Small overlapping bubbles scallop the whole cap, including its front edge. */
export const brewingFoamPerimeter = (height: number) => Array.from({ length: 12 }, (_, i) => {
  const angle = i * Math.PI * 2 / 12;
  return { x: Math.cos(angle) * 10.5,
    y: -height / 3 + Math.sin(angle) * (5 + height / 2),
    radius: 2.2 + (i % 3) * 0.45 + height * 0.08 };
});

export const prepareBrewingAnimation = (scene: Phaser.Scene) => {
  scene.textures.addCanvas("brewing-front-wall-right", prepareBreweryFrontWall(
    scene.textures.get("source-brewery-right-top").getSourceImage() as HTMLImageElement, true))
    ?.setFilter(Phaser.Textures.FilterMode.LINEAR);
  scene.textures.addCanvas("brewing-front-wall", prepareBreweryFrontWall(
    scene.textures.get("source-brewery").getSourceImage() as HTMLImageElement))
    ?.setFilter(Phaser.Textures.FilterMode.LINEAR);
  scene.textures.addCanvas("brewing-stool", prepareBuildingTexture(
    scene.textures.get("source-brewing-stool").getSourceImage() as HTMLImageElement, { maxSize: 128 }))
    ?.setFilter(Phaser.Textures.FilterMode.LINEAR);
  BREWING_WORKER_SOURCES.forEach((_, i) => {
    const source = scene.textures.get(`source-brewing-worker-${i}`).getSourceImage() as HTMLImageElement;
    scene.textures.addCanvas(`brewing-worker-${i}`, prepareFarmerTexture(source, 0.15, BREWING_WORKER_BOUNDS))
      ?.setFilter(Phaser.Textures.FilterMode.LINEAR);
  });
};

/** Presentation only: elapsed time comes from the saved server schedule. */
export const createBrewingTest = (scene: Phaser.Scene, brewery: Phaser.GameObjects.Image, rightTop = false, vesselCount = 2) => {
  const placement = vesselCount === 1 ? BREWING_WORK_PLACEMENTS.left : BREWING_STOOL_PLACEMENT;
  const worker = scene.add.image(0, 0, "brewing-worker-0").setOrigin(0.5, 120 / 128).setDisplaySize(64, 64).setVisible(false);
  const seat = scene.add.image(0, 0, "brewing-stool").setOrigin(0.5, 0.3).setVisible(false);
  const wall = scene.add.image(0, 0, rightTop ? "brewing-front-wall-right" : "brewing-front-wall").setOrigin(brewery.originX, brewery.originY).setVisible(false);
  const foam = scene.add.graphics(), progress = scene.add.graphics();
  return {
    shadowAnchor: () => ({ x: brewery.x + placement.x,
      y: brewery.y + placement.groundY, visible: worker.visible }),
    render(elapsed: number | null, reduced: boolean, fermentationProgress?: number) {
      foam.clear(); progress.clear(); worker.setVisible(false); seat.setVisible(false); wall.setVisible(false);
      if (elapsed === null) return;
      const pose = brewingTestPose(elapsed, reduced);
      worker.setTexture(`brewing-worker-${pose.frame}`).setDisplaySize(64, 64)
        .setPosition(brewery.x + placement.workerX, brewery.y + placement.seatY).setDepth(brewery.depth + 1).setVisible(pose.preparing && vesselCount > 0);
      if (pose.preparing) {
        wall.setPosition(brewery.x, brewery.y).setDisplaySize(brewery.displayWidth, brewery.displayHeight)
          .setDepth(brewery.depth + 0.75).setVisible(vesselCount > 0);
        seat.setPosition(brewery.x + placement.x, brewery.y + placement.seatY)
          .setDisplaySize(placement.size, placement.size).setDepth(brewery.depth + 0.5).setVisible(vesselCount > 0);
        drawBuildingProgress(progress, brewery, pose.progress);
      } else {
        foam.setDepth(brewery.depth + 2);
        // Mouth centres in the approved 150px composite. No independent jar scaling.
        for (const [i, mouth] of [{ x: -11.3, y: -79 }, { x: 20.2, y: -71 }].slice(0, vesselCount).entries()) {
          const h = brewingFoamHeight(elapsed - BREWING_PREPARATION_MS, i, reduced);
          const x = brewery.x + mouth.x, y = brewery.y + mouth.y;
          foam.fillStyle(0xfff2ce, 0.92)
            .fillEllipse(x, y, BREWING_FOAM_BASE.width, BREWING_FOAM_BASE.height)
            .fillEllipse(x, y - h / 3, 24, 12 + h);
          for (const bubble of brewingFoamPerimeter(h)) {
            foam.fillCircle(x + bubble.x, y + bubble.y, bubble.radius);
          }
        }
      }
      if (fermentationProgress !== undefined) drawBuildingProgress(progress, brewery, fermentationProgress);
    },
    destroy() { worker.destroy(); seat.destroy(); wall.destroy(); foam.destroy(); progress.destroy(); },
  };
};
