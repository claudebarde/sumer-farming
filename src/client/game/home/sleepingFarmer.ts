import { FARMER_SHARPEN_AMOUNT, sharpenFarmerPixels } from "../phaser/farmerTexture";
import { actorOccludingWalls } from "./interiorWalls";
import type { FurniturePlacement } from "../../../game-data/homeFurniture";

/** Sleeping artwork, centred over the mat rather than anchored by standing feet. */
export function sleepingFarmerTexture(source: HTMLImageElement, mat: FurniturePlacement) {
  const original = document.createElement("canvas");
  original.width = source.naturalWidth; original.height = source.naturalHeight;
  const sourceContext = original.getContext("2d")!;
  sourceContext.drawImage(source, 0, 0);
  const pixels = sourceContext.getImageData(0, 0, original.width, original.height);
  let left = original.width, top = original.height, right = 0, bottom = 0;
  for (let y = 0; y < original.height; y++) for (let x = 0; x < original.width; x++) {
    const i = (y * original.width + x) * 4;
    // Exclude the generated diffuse halo from the character's bounds and texture.
    if (pixels.data[i + 3]! < 200) pixels.data[i + 3] = 0;
    else { left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y); }
  }
  sourceContext.putImageData(pixels, 0, 0);
  const canvas = document.createElement("canvas"); canvas.width = 280; canvas.height = 200;
  const ctx = canvas.getContext("2d")!;
  const scale = Math.min(240 / (right - left + 1), 180 / (bottom - top + 1));
  const width = (right - left + 1) * scale, height = (bottom - top + 1) * scale;
  ctx.imageSmoothingQuality = "high";
  ctx.save();
  if (mat.orientation === "mirrored") { ctx.translate(280, 0); ctx.scale(-1, 1); }
  ctx.drawImage(original, left, top, right - left + 1, bottom - top + 1, (280 - width) / 2, (200 - height) / 2, width, height);
  ctx.restore();
  const sharp = ctx.getImageData(0, 0, 280, 200);
  sharp.data.set(sharpenFarmerPixels(sharp.data, 280, 200, FARMER_SHARPEN_AMOUNT)); ctx.putImageData(sharp, 0, 0);
  ctx.globalCompositeOperation = "destination-out";
  for (const polygon of actorOccludingWalls(mat)) {
    ctx.beginPath(); polygon.forEach(([x, y], i) => {
      const px = (x - mat.x + 70) * 2, py = (y - (mat.y - 30) + 50) * 2;
      if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }); ctx.closePath(); ctx.fill();
  }
  return canvas;
}
