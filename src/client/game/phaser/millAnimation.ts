import Phaser from "phaser";
import bowl from "../../../assets/sprite_assets/pngs/v2/isometric-test/mill-active/mill-active-bowl.png";
import bags from "../../../assets/sprite_assets/pngs/v2/isometric-test/mill-active/mill-active-bags.png";
import base from "../../../assets/sprite_assets/pngs/v2/isometric-test/mill-active/mill-active-base.png";
import lever from "../../../assets/sprite_assets/pngs/v2/isometric-test/mill-active/mill-lever-01.png";
import farmerFront from "../../../assets/sprite_assets/pngs/v2/isometric-test/mill-active/farmer-mill-push-01.png";
import farmerBack from "../../../assets/sprite_assets/pngs/v2/isometric-test/mill-active/farmer-mill-push-03.png";
import { isoPoint } from "./isometricProjection";
import { prepareBuildingTexture } from "./buildingTexture";

// Player-approved animation v1. Presentation only; production stays server-owned.
export const MILL_ANIMATION_VERSION = 1;
export const MILL_CYCLE_MS = 5600;
export const MILL_PUSH_ANGLE = 40 * Math.PI / 180;
export const MILL_ACTIVE_SIZE = 160;
export const MILL_WORKER_SIZE = 88; // Original preview scale, not the rejected miniaturized worker.
/** Raise the worker and held lever together, preserving the current push layering. */
export const millWorkerForegroundDepths = (farmer: number, lever: number, minimum: number) => {
  const lift = Math.max(0, minimum - farmer);
  return { farmer: farmer + lift, lever: lever + lift };
};
export const MILL_ANIMATION_SOURCES = [
  { key: "mill-v1-bowl", url: bowl },
  { key: "mill-v1-bags", url: bags },
  { key: "mill-v1-base", url: base },
  { key: "mill-v1-lever", url: lever },
  { key: "mill-v1-farmer-front", url: farmerFront },
  { key: "mill-v1-farmer-back", url: farmerBack },
];
const pivot = { x: -30, y: -35 };
const reach = 365 / 1024 * MILL_ACTIVE_SIZE;

export const millAnimationPose = (elapsed: number) => {
  const phase = (Math.max(0, elapsed) % MILL_CYCLE_MS) / MILL_CYCLE_MS;
  const southward = phase < 0.5;
  // Ease to a stop at each turn, then retrace the same 40° arc northward.
  const leverRotation = MILL_PUSH_ANGLE * (1 - Math.cos(phase * Math.PI * 2)) / 2;
  const hand = { x: pivot.x + Math.cos(leverRotation) * reach, y: pivot.y + Math.sin(leverRotation) * reach };
  // A true rear-view drawing, not flipX (which cannot reveal his back).
  const grip = southward ? { x: 251.5 / 512, y: 301.5 / 512 } : { x: 270 / 512, y: 229 / 512 };
  const feet = { x: hand.x + (0.5 - grip.x) * MILL_WORKER_SIZE,
    y: hand.y + (450 / 512 - grip.y) * MILL_WORKER_SIZE };
  return { feet, hand, grip, southward, leverRotation, leverScale: 1,
    leverDepth: southward ? 2.5 : 1,
    farmerTexture: southward ? "mill-v1-farmer-front" : "mill-v1-farmer-back" };
};

export const millFlourParticles = (elapsed: number) => Array.from({ length: 10 }, (_, i) => {
  const progress = ((Math.max(0, elapsed) + i * 113) % 1100) / 1100;
  return { x: pivot.x - 15 + Math.sin(i * 2.4) * 3 + Math.sin(progress * Math.PI) * 2,
    y: pivot.y + 44 + progress * 16, alpha: (1 - progress) * 0.8, radius: i % 3 === 0 ? 1.3 : 0.85 };
});

export const prepareMillAnimation = (scene: Phaser.Scene) => {
  for (const { key } of MILL_ANIMATION_SOURCES) {
    const source = scene.textures.get(`source-${key}`).getSourceImage() as HTMLImageElement;
    // Whole-frame preparation preserves the supplied foot/grip/pivot registration.
    // Small props need averaging near their display size to avoid skipped detail.
    // Retain roughly 2× resolution for zoom, then sharpen without altering alpha.
    const options = key === "mill-v1-bowl" ? { maxSize: 64, sharpen: 0.45 }
      : key === "mill-v1-bags" ? { maxSize: 96, sharpen: 0.45 } : undefined;
    const canvas = prepareBuildingTexture(source, options);
    scene.textures.addCanvas(key, canvas)?.setFilter(Phaser.Textures.FilterMode.LINEAR);
  }
};
export type MillAnimationImages = {
  base: Phaser.GameObjects.Image; lever: Phaser.GameObjects.Image;
  bowl: Phaser.GameObjects.Image; bags: Phaser.GameObjects.Image;
  farmer: Phaser.GameObjects.Image; flour: Phaser.GameObjects.Graphics;
};
export const renderMillAnimation = (scene: Phaser.Scene, images: MillAnimationImages | null, cell: { column: number; row: number }, elapsed: number | null): MillAnimationImages => {
  const p = isoPoint({ column: cell.column + 0.5, row: cell.row + 0.5 });
  const active = elapsed !== null;
  const size = MILL_ACTIVE_SIZE;
  const centre = { x: p.x + pivot.x, y: p.y + pivot.y };
  const sprites = images ?? {
    base: scene.add.image(0, 0, "mill-v1-base"),
    bowl: scene.add.image(0, 0, "mill-v1-bowl"),
    bags: scene.add.image(0, 0, "mill-v1-bags"),
    lever: scene.add.image(0, 0, "mill-v1-lever"),
    farmer: scene.add.image(0, 0, "mill-v1-farmer-front"),
    flour: scene.add.graphics(),
  };
  sprites.base.setTexture("mill-v1-base")
    .setOrigin(550 / 1024, 505 / 1024)
    .setPosition(centre.x, centre.y).setDisplaySize(size, size).setDepth(p.y);
  // Props are tightly cropped: preserve their native aspect ratios.
  sprites.bowl.setOrigin(0.5, 0.5).setPosition(p.x - 45, p.y + 20)
    .setDisplaySize(25, 25 * 99 / 138).setDepth(p.y + 3);
  sprites.bags.setOrigin(0.5, 1).setPosition(p.x + 28, p.y + 12)
    .setDisplaySize(43, 43 * 232 / 258).setDepth(p.y + 1).setVisible(!active);
  const pose = millAnimationPose(elapsed ?? 0);
  sprites.lever.setVisible(true).setOrigin(550 / 1024, 505 / 1024).setPosition(centre.x, centre.y)
    .setDisplaySize(size * pose.leverScale, size * pose.leverScale).setRotation(pose.leverRotation).setDepth(p.y + pose.leverDepth);
  sprites.farmer.setVisible(active);
  sprites.flour.clear().setVisible(active).setDepth(p.y + 3.1);
  if (elapsed === null) return sprites;
  sprites.farmer.setTexture(pose.farmerTexture).setOrigin(pose.grip.x, pose.grip.y).setDisplaySize(MILL_WORKER_SIZE, MILL_WORKER_SIZE)
    .setPosition(p.x + pose.hand.x, p.y + pose.hand.y).setRotation(0).setDepth(p.y + 2);
  for (const particle of millFlourParticles(elapsed)) {
    sprites.flour.fillStyle(0xffedc8, particle.alpha).fillCircle(p.x + particle.x, p.y + particle.y, particle.radius);
  }
  return sprites;
};
