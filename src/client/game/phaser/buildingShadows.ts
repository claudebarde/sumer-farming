import type Phaser from "phaser";
import { isoPoint } from "./isometricProjection";
import { buildingShadowBottom, buildingShadowContourBottom, buildingShadowTransform, middayBuildingOval, middayShadowWeight, morningMillOval, opaqueTop, opaqueBaseContour, opaqueBottom, usesBuildingBaseContour, usesMorningMillOval } from "./buildingShadowProjection";
import { daylightShadow, type ShadowBounds } from "./daylightShadows";

// Prepared frame silhouettes survive scene redraws, without retaining destroyed textures.
const silhouettes = new WeakMap<Phaser.Textures.Frame, { canvas: HTMLCanvasElement; top: number; bottom: number; contour: readonly number[] }>();
const silhouette = (frame: Phaser.Textures.Frame) => {
  const cached = silhouettes.get(frame);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = frame.cutWidth; canvas.height = frame.cutHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true })!;
  context.drawImage(frame.texture.getSourceImage(frame.name) as HTMLImageElement | HTMLCanvasElement,
    frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight, 0, 0, canvas.width, canvas.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const bottom = opaqueBottom(pixels, canvas.width, canvas.height);
  const top = opaqueTop(pixels, canvas.width, canvas.height);
  const contour = opaqueBaseContour(pixels, canvas.width, canvas.height);
  context.globalCompositeOperation = "source-in";
  context.fillStyle = "#504739"; context.fillRect(0, 0, canvas.width, canvas.height);
  const result = { canvas, top, bottom, contour }; silhouettes.set(frame, result); return result;
};

/** One cached, ground-clipped texture per scene redraw; never read pixels every frame. */
export const createBuildingShadows = (scene: Phaser.Scene, bounds: ShadowBounds) => {
  const corners = [
    { column: bounds.minimumColumn - 0.5, row: bounds.minimumRow - 0.5 },
    { column: bounds.maximumColumn + 0.5, row: bounds.minimumRow - 0.5 },
    { column: bounds.maximumColumn + 0.5, row: bounds.maximumRow + 0.5 },
    { column: bounds.minimumColumn - 0.5, row: bounds.maximumRow + 0.5 },
  ].map(isoPoint);
  const left = Math.floor(Math.min(...corners.map(p => p.x))), top = Math.floor(Math.min(...corners.map(p => p.y)));
  const width = Math.ceil(Math.max(...corners.map(p => p.x))) - left;
  const height = Math.ceil(Math.max(...corners.map(p => p.y))) - top;
  // Union the projected strips before applying opacity, avoiding dark seams
  // where neighbouring strips overlap. Reuse this surface for every building.
  const surface = document.createElement("canvas");
  surface.width = width; surface.height = height;
  const ink = surface.getContext("2d")!;
  const key = `building-shadows-${scene.sys.settings.key}`;
  const texture = scene.textures.createCanvas(key, width, height)!;
  const image = scene.add.image(left, top, key).setOrigin(0).setDepth(-811);
  image.once("destroy", () => scene.textures.remove(key));
  const buildings: Phaser.GameObjects.Image[] = [];
  let previous = "";
  return {
    destroy() { image.destroy(); },
    add(building: Phaser.GameObjects.Image) { buildings.push(building); previous = ""; },
    render(hour: number) {
      // Minute precision is visually continuous at this scale and avoids GPU uploads every frame.
      const sampledHour = Math.floor(hour * 60) / 60;
      const signature = JSON.stringify([sampledHour, buildings.map(b => [b.texture.key, b.frame.name, b.x, b.y, b.displayWidth, b.displayHeight, b.originX, b.originY, b.visible, b.alpha])]);
      if (signature === previous) return;
      previous = signature;
      const context = texture.getContext();
      context.clearRect(0, 0, width, height);
      context.save(); context.translate(-left, -top);
      context.beginPath(); corners.forEach((p, i) => i === 0 ? context.moveTo(p.x, p.y) : context.lineTo(p.x, p.y));
      context.closePath(); context.clip();
      const sun = daylightShadow(sampledHour);
      const midday = middayShadowWeight(sampledHour);
      for (const building of buildings) {
        if (!building.visible || building.alpha === 0) continue;
        const { canvas, top: artworkTop, bottom, contour } = silhouette(building.frame);
        if (midday > 0) {
          const oval = middayBuildingOval(building, { width: canvas.width, height: canvas.height, bottom, contour });
          if (oval) {
            context.save(); context.globalAlpha = sun.alpha * building.alpha * midday;
            context.fillStyle = "#504739"; context.beginPath();
            context.ellipse(oval.x, oval.y, oval.radiusX, oval.radiusY, 0, 0, Math.PI * 2);
            context.fill(); context.restore();
          }
          if (midday === 1) continue;
        }
        if (usesMorningMillOval(building.texture.key, sampledHour)) {
          const oval = morningMillOval(sun, building, { width: canvas.width, height: canvas.height, top: artworkTop, bottom, contour });
          if (oval) {
            context.save(); context.globalAlpha = sun.alpha * building.alpha * (1 - midday);
            context.fillStyle = "#504739"; context.beginPath();
            context.ellipse(oval.x, oval.y, oval.width / 2, oval.height / 2, oval.rotation, 0, Math.PI * 2);
            context.fill(); context.restore();
          }
          continue;
        }
        if (usesBuildingBaseContour(building.texture.key) && sun.phase > 0.5 && sun.length > 0) {
          ink.clearRect(0, 0, width, height);
          for (let x = 0; x < canvas.width; x++) {
            if (!contour[x]) continue;
            const contact = buildingShadowContourBottom(contour[x]!, bottom, sun);
            const m = buildingShadowTransform(sun, building, { width: canvas.width, height: canvas.height, bottom: contact });
            ink.save(); ink.translate(-left, -top);
            ink.transform(m.a, m.b, m.c, m.d, m.e, m.f);
            // A subpixel overlap closes raster seams without enlarging the artwork.
            const stripWidth = Math.min(1.25, canvas.width - x);
            ink.drawImage(canvas, x, 0, stripWidth, canvas.height, x, 0, stripWidth, canvas.height);
            ink.restore();
          }
          context.save(); context.globalAlpha = sun.alpha * building.alpha * (1 - midday);
          context.drawImage(surface, left, top); context.restore();
          continue;
        }
        const contactBottom = buildingShadowBottom(building.texture.key, bottom, canvas.height, sun);
        const m = buildingShadowTransform(sun, building, { width: canvas.width, height: canvas.height, bottom: contactBottom });
        context.save(); context.globalAlpha = sun.alpha * building.alpha * (1 - midday);
        context.transform(m.a, m.b, m.c, m.d, m.e, m.f);
        context.drawImage(canvas, 0, 0); context.restore();
      }
      context.restore(); texture.refresh();
    },
  };
};
