import { furnitureDefinition, type FurnitureKey, type FurniturePlacement } from "../../../game-data/homeFurniture";
import { furniturePosition, furnitureGroundAnchor } from "../../../game-core/home/furnitureSurfaces";
import { INTERIOR_WALLS, behindLeftInteriorWall, behindRightInteriorWall } from "../../../game-core/home/interiorWalls";
import { prepareBuildingTexture } from "../phaser/buildingTexture";

/** Shared framing, sharpening and wall clipping for the scene and drawer thumbnail. */
export function prepareFurnitureTexture(original: HTMLImageElement, key: FurnitureKey) {
  const definition = furnitureDefinition(key);
  const cropped = document.createElement("canvas");
  cropped.width = original.naturalWidth; cropped.height = original.naturalHeight;
  const context = cropped.getContext("2d")!;
  context.drawImage(original, 0, 0);
  const pixels = context.getImageData(0, 0, cropped.width, cropped.height).data;
  let left = cropped.width, top = cropped.height, right = -1, bottom = -1;
  // Ignore the faint baked glow when measuring the usable object's silhouette.
  for (let y = 0; y < cropped.height; y++) for (let x = 0; x < cropped.width; x++) {
    if (pixels[(y * cropped.width + x) * 4 + 3]! > 200) {
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
  }
  const frame = document.createElement("canvas");
  frame.width = Math.max(1, right - left + 1); frame.height = Math.max(1, bottom - top + 1);
  frame.getContext("2d")!.drawImage(original, left, top, frame.width, frame.height, 0, 0, frame.width, frame.height);
  const source = prepareBuildingTexture(frame);
  const canvas = document.createElement("canvas"); canvas.width = definition.width; canvas.height = definition.height;
  const scale = Math.min(definition.width / source.width, definition.height / source.height);
  const width = source.width * scale, height = source.height * scale;
  // Preview and placed objects use exactly the same proportionate, normalized frame.
  canvas.getContext("2d")!.drawImage(source, (definition.width - width) / 2, (definition.height - height) / 2, width, height);
  return canvas;
}

export function placedFurnitureTexture(source: HTMLCanvasElement, item: FurniturePlacement, items: readonly FurniturePlacement[]) {
  const position = furniturePosition(item, items);
  const anchor = furnitureGroundAnchor(item, items);
  const definition = furnitureDefinition(item.key);
  // Clip each item against its own room walls, independently of the farmer's room.
  const canvas = document.createElement("canvas"); canvas.width = definition.width; canvas.height = definition.height;
  const ctx = canvas.getContext("2d")!;
  ctx.save();
  if (item.orientation === "mirrored") { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  ctx.restore();
  ctx.globalCompositeOperation = "destination-out";
  const walls = [...INTERIOR_WALLS.front, ...(behindLeftInteriorWall(anchor) ? INTERIOR_WALLS.left : []), ...(behindRightInteriorWall(anchor) ? INTERIOR_WALLS.right : [])];
  for (const points of walls) {
    ctx.beginPath(); points.forEach(([x,y], i) => { const px = x - position.x + canvas.width / 2, py = y - position.y + canvas.height * .78; if (i) ctx.lineTo(px,py); else ctx.moveTo(px,py); }); ctx.closePath(); ctx.fill();
  }
  return canvas;
}
