import type Phaser from "phaser";
import { PROCESSION_COUNT, processionPose } from "./lyreProcession";
import { isoPoint } from "./isometricProjection";
import { ZIGGURAT_CELEBRATION_MS, zigguratCelebrationPose } from "../../../game-data/zigguratCelebration";

/** Cosmetic only: server has already recorded completion and this viewer's visit. */
export const createZigguratCelebration = (scene: Phaser.Scene, building: Phaser.GameObjects.Image) => {
  const started = Date.now();
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const sprites = Array.from({ length: PROCESSION_COUNT }, (_, i) => ({
    actor: scene.add.image(0, 0, processionPose(0, i).texture).setOrigin(.5, 108 / 128).setDisplaySize(72, 72),
    arrow: scene.add.text(0, 0, "↓", { fontSize: "24px", color: "#ffd568", stroke: "#624728", strokeThickness: 2 })
      .setOrigin(.5, 1).setDepth(10001).setVisible(false),
  }));
  const destroy = () => sprites.forEach(({ actor, arrow }) => { actor.destroy(); arrow.destroy(); });
  return { destroy, update: () => {
    const elapsed = Date.now() - started;
    if (elapsed >= ZIGGURAT_CELEBRATION_MS) { destroy(); return false; }
    sprites.forEach(({ actor, arrow }, i) => {
      const pose = zigguratCelebrationPose(elapsed, i), point = isoPoint(pose.position);
      const from = isoPoint(pose.from), to = isoPoint(pose.to);
      const behind = pose.position.row < -2 || pose.position.column < -5;
      actor.setTexture(processionPose(reduced ? 0 : elapsed, i).texture).setDisplaySize(72, 72)
        .setFlipX(to.x < from.x).setPosition(point.x, point.y)
        .setAlpha(pose.alpha).setDepth(behind ? Math.min(point.y + 2, building.depth - 1) : Math.max(point.y + 2, building.depth + 1));
      const bounds = building.getBounds();
      arrow.setVisible(behind && bounds.contains(point.x, point.y - 40)).setPosition(point.x, point.y - 72).setAlpha(pose.alpha);
    });
    return true;
  } };
};
