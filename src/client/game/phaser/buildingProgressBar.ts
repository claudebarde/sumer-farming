import type Phaser from "phaser";
import { ACTION_PROGRESS as bar } from "../../../game-data/actionProgress";
import { drawActionProgress } from "./actionProgressBar";

type Bounds = { x: number; y: number; width: number; height: number };
/** Clamp only bars whose building is still visible; offscreen buildings don't create edge markers. */
export const buildingProgressPosition = (bounds: Bounds, view: Bounds, zoom: number) => {
  const margin = 8 / zoom;
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
  return {
    visible: bounds.x + bounds.width > view.x && bounds.x < view.x + view.width &&
      bounds.y + bounds.height > view.y && bounds.y < view.y + view.height,
    x: clamp(bounds.x + bounds.width / 2, view.x + margin + bar.width / 2, view.x + view.width - margin - bar.width / 2),
    y: clamp(bounds.y - 8 - bar.height, view.y + margin, view.y + view.height - margin - bar.height),
  };
};

const tops = new WeakMap<object, number>();
const artworkBounds = (image: Phaser.GameObjects.Image): Bounds => {
  const bounds = image.getBounds();
  const source = image.texture.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  let top = tops.get(source);
  if (top === undefined) {
    const canvas = document.createElement("canvas"); canvas.width = source.width; canvas.height = source.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(source, 0, 0);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    top = 0;
    for (let i = 3; i < pixels.length; i += 4) if (pixels[i]! >= 32) {
      top = Math.floor((i / 4) / canvas.width) / canvas.height; break;
    }
    tops.set(source, top);
  }
  return { x: bounds.x, y: bounds.y + top * bounds.height, width: bounds.width, height: bounds.height * (1 - top) };
};
const anchors = new WeakMap<Phaser.GameObjects.Graphics, Phaser.GameObjects.Image>();

export const drawBuildingProgress = (graphics: Phaser.GameObjects.Graphics, image: Phaser.GameObjects.Image, fraction: number) => {
  if (!anchors.has(graphics)) {
    const scene = graphics.scene;
    const position = () => {
      const anchor = anchors.get(graphics);
      if (!anchor?.scene) { graphics.setVisible(false); return; }
      const camera = scene.cameras.main;
      // Farm cameras are unrotated. Derive the current view before camera preRender,
      // so zoom/pan/resize never use the previous frame's worldView.
      const width = camera.width / camera.zoom, height = camera.height / camera.zoom;
      const view = { x: camera.scrollX + (camera.width - width) / 2,
        y: camera.scrollY + (camera.height - height) / 2, width, height };
      const point = buildingProgressPosition(artworkBounds(anchor), view, camera.zoom);
      graphics.setPosition(point.x, point.y).setVisible(point.visible && anchor.visible);
    };
    scene.events.on("prerender", position);
    graphics.once("destroy", () => { scene.events.off("prerender", position); anchors.delete(graphics); });
  }
  anchors.set(graphics, image);
  drawActionProgress(graphics.setDepth(20000), 0, 0, fraction);
};
