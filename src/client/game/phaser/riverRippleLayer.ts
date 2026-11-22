import Phaser from "phaser";
import { riverRippleDefinitions, riverRipplePose, riverRippleShape } from "./riverRipples";

type RiverTile = { readonly column: number; readonly x: number; readonly y: number; readonly timeOffset: number };
const width = 24;
const height = 8;
const resolution = 4;
const textureKey = (halfWidth: number) => `river-ripple-${halfWidth}`;

/** Rasterize the four stroke shapes once; frames only move/fade batched images. */
export const createRiverRippleLayer = (scene: Phaser.Scene, tiles: readonly RiverTile[]) => {
  for (let halfWidth = 7; halfWidth <= 10; halfWidth++) {
    const key = textureKey(halfWidth);
    if (scene.textures.exists(key)) continue;
    const canvas = document.createElement("canvas");
    canvas.width = width * resolution;
    canvas.height = height * resolution;
    const context = canvas.getContext("2d")!;
    context.scale(resolution, resolution);
    context.translate(width / 2, height / 2);
    context.strokeStyle = "#ffffff";
    context.lineWidth = 2;
    context.beginPath();
    riverRippleShape(halfWidth).forEach((point, index) => {
      if (index === 0) context.moveTo(point.x, point.y);
      else context.lineTo(point.x, point.y);
    });
    context.stroke();
    scene.textures.addCanvas(key, canvas)?.setFilter(Phaser.Textures.FilterMode.LINEAR);
  }
  const entries = tiles.flatMap(tile => riverRippleDefinitions(tile.column).map(ripple => ({
    tile, ripple,
    image: scene.add.image(tile.x, tile.y, textureKey(ripple.halfWidth))
      .setDisplaySize(width, height).setDepth(-940).setAlpha(0),
  })));
  let previousTime = NaN;
  let previousReducedMotion = false;
  return {
    render(elapsed: number, reducedMotion = false) {
      const time = reducedMotion ? 0 : elapsed;
      if (time === previousTime && reducedMotion === previousReducedMotion) return;
      previousTime = time;
      previousReducedMotion = reducedMotion;
      for (const { tile, ripple, image } of entries) {
        const pose = riverRipplePose(ripple, time + tile.timeOffset, reducedMotion);
        image.setPosition(tile.x + pose.x, tile.y + pose.y).setAlpha(pose.alpha);
      }
    },
  };
};
