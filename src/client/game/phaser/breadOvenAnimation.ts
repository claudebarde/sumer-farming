import Phaser from "phaser";
import { drawActionProgress } from "./actionProgressBar";
import base from "../../../assets/sprite_assets/pngs/v2/isometric-test/bread-oven-active/bread-oven-active-base.png";
import rest from "../../../assets/sprite_assets/pngs/v2/isometric-test/bread-oven-active/farmer-bake-rest.png";
import half from "../../../assets/sprite_assets/pngs/v2/isometric-test/bread-oven-active/farmer-bake-push-half.png";
import full from "../../../assets/sprite_assets/pngs/v2/isometric-test/bread-oven-active/farmer-bake-push-full.png";
import pull from "../../../assets/sprite_assets/pngs/v2/isometric-test/bread-oven-active/farmer-bake-pull-half.png";
import tableTwo from "../../../assets/sprite_assets/pngs/v2/isometric-test/bread-oven-active/bread-table-dough-2.png";
import tableOne from "../../../assets/sprite_assets/pngs/v2/isometric-test/bread-oven-active/bread-table-dough-1.png";
import tableEmpty from "../../../assets/sprite_assets/pngs/v2/isometric-test/bread-oven-active/bread-table-empty.png";
import basketUrl from "../../../assets/sprite_assets/pngs/v2/isometric-test/bread-oven-active/bread-basket-isometric.png";
import { prepareBuildingTexture } from "./buildingTexture";
import { bakingProgress, type BakingJob } from "./isometricBaking";

export const BAKING_SOURCES = [base, rest, half, full, pull, tableTwo, tableOne, tableEmpty, basketUrl];
export const BAKING_CYCLE_MS = 5200;
/** Dough stages follow authoritative production progress, not the paddle cycle. */
export const bakingTableTexture = (progress: number) => progress >= 2 / 3 ? "baking-7" : progress >= 1 / 3 ? "baking-6" : "baking-5";
// Prepare the 70px worker near 2× display resolution, averaging fine lines
// before GPU minification. Keep full-frame registration and alpha unchanged.
export const BAKING_WORKER_TEXTURE_OPTIONS = { maxSize: 140, sharpen: 0.15 } as const;
/** Two gentle strokes, then a planted-foot rest. Cosmetic clock only. */
export const bakingPose = (elapsed: number, reduced = false) => {
  const t = Math.max(0, elapsed) % BAKING_CYCLE_MS;
  const frames = [1, 2, 3, 2, 4, 1] as const;
  return { frame: reduced || t >= 3000 ? 1 : frames[Math.floor(t / 250) % frames.length]!,
    glow: reduced ? 0.25 : 0.25 + Math.sin(elapsed / 650) * 0.055 };
};
export const bakingWisps = (elapsed: number) => Array.from({ length: 3 }, (_, i) => {
  const t = ((Math.max(0, elapsed) + i * 1400) % 4200) / 4200;
  return { x: Math.sin(t * Math.PI * 1.5 + i) * 4 + t * 5,
    y: -t * 26, width: 5 + t * 10, height: 3 + t * 5,
    alpha: Math.sin(t * Math.PI) * 0.42 };
});

export const prepareBakingAnimation = (scene: Phaser.Scene) => {
  BAKING_SOURCES.forEach((_, i) => {
    const source = scene.textures.get(`source-baking-${i}`).getSourceImage() as HTMLImageElement;
    const canvas = prepareBuildingTexture(source, i === 0 ? undefined : i >= 5
      ? { maxSize: 128, sharpen: 0.35 } : BAKING_WORKER_TEXTURE_OPTIONS);
    scene.textures.addCanvas(`baking-${i}`, canvas)?.setFilter(Phaser.Textures.FilterMode.LINEAR);
  });
};

/** Pure presentation of the saved job; no economic animation callbacks. */
export const createBakingAnimation = (scene: Phaser.Scene, oven: Phaser.GameObjects.Image) => {
  const worker = scene.add.image(0, 0, "baking-1").setOrigin(0, 0);
  const table = scene.add.image(0, 0, "baking-5").setOrigin(0.5, 1);
  const glow = scene.add.graphics(), smoke = scene.add.graphics(), progress = scene.add.graphics();
  // Mask only the forward paddle end: it enters the dark opening rather than
  // drawing across the oven's right-hand brickwork. Coordinates share the oven frame.
  const maskShape = scene.make.graphics({ x: 0, y: 0 }, false);
  const mask = maskShape.createGeometryMask();
  worker.setMask(mask);
  let shadowVisible = false;
  return {
    // Foot contact in the shared full-frame worker artwork, not the canvas
    // centre (which includes the extended paddle and transparent padding).
    shadowAnchor: () => ({ x: oven.x - 44, y: oven.y - 21, visible: shadowVisible }),
    render(job: BakingJob | undefined, now: number, reduced: boolean) {
      const batch = bakingProgress(job, now);
      const active = batch !== null;
      shadowVisible = active;
      oven.setTexture(active ? "baking-0" : "breadOven").setDisplaySize(150, 150);
      worker.setVisible(active); table.setVisible(active); glow.clear(); smoke.clear(); progress.clear();
      if (!batch) return;
      const elapsed = batch.elapsed;
      const pose = bakingPose(elapsed, reduced);
      const x = oven.x, y = oven.y, depth = oven.depth;
      table.setTexture(bakingTableTexture(batch.fraction)).setDisplaySize(62, 62)
        .setPosition(x + 22, y + 9).setDepth(depth + 2.5);
      worker.setTexture(`baking-${pose.frame}`).setDisplaySize(70, 70 * 1254 / 1318)
        .setPosition(x - 66, y - 81).setDepth(depth + 2);
      maskShape.clear().fillStyle(0xffffff).fillRect(x - 100, y - 150, 80, 180)
        .fillRect(x - 20, y - 48, 100, 78);
      glow.setDepth(depth + 1).fillStyle(0xff9b32, pose.glow)
        .fillEllipse(x - 10, y - 55, 25, 17);
      smoke.setDepth(depth + 3);
      if (!reduced) for (const w of bakingWisps(elapsed)) {
        smoke.fillStyle(0xfffaf1, w.alpha).fillEllipse(x + 3 + w.x, y - 103 + w.y, w.width, w.height);
      }
      drawActionProgress(progress.setDepth(depth + 4), x, y + 2, batch.fraction);
    },
    destroy() {
      shadowVisible = false;
      worker.clearMask(); mask.destroy(); maskShape.destroy();
      worker.destroy(); table.destroy(); glow.destroy(); smoke.destroy(); progress.destroy();
    }
  };
};
