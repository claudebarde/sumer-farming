import { prepareBuildingTexture } from "./buildingTexture";

export const breweryVesselCount = (inventory: readonly { itemKey: string; quantity: number }[]) =>
  Math.min(2, Math.max(0, Math.floor(inventory.find(item => item.itemKey === "brewingVessels")?.quantity ?? 0)));

export const breweryVesselTexture = (rightTop: boolean, count: number) =>
  `${rightTop ? "brewery-right-top-full" : "brewery"}${count === 2 ? "" : `-${count}`}`;

/** Fixed registrations in the shell's 1024px reference frame. */
export const BREWERY_VESSEL_LAYOUT = [
  { x: 435, bottom: 645, width: 253 },
  { x: 650, bottom: 700, width: 253 },
] as const;

const drawFrontWall = (context: CanvasRenderingContext2D, shell: HTMLImageElement, rightTop = false) => {
  context.save(); context.beginPath();
  if (rightTop) {
    context.moveTo(210, 565); context.lineTo(510, 735); context.lineTo(830, 565);
    context.lineTo(910, 710); context.lineTo(540, 920); context.lineTo(200, 720);
  } else {
  context.moveTo(490, 735); context.lineTo(780, 565);
  context.lineTo(900, 630); context.lineTo(900, 900); context.lineTo(490, 900);
  }
  context.closePath(); context.clip(); context.drawImage(shell, 0, 0, 1024, 1024); context.restore();
};

/** Shell-only overlay: never bring the vessels in front of the stool/worker. */
export const prepareBreweryFrontWall = (shell: HTMLImageElement, rightTop = false): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1024;
  drawFrontWall(canvas.getContext("2d")!, shell, rightTop);
  return prepareBuildingTexture(canvas);
};

export const prepareBreweryLayout = (shell: HTMLImageElement, jar: HTMLImageElement, rightTop = false, vesselCount = 2): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  canvas.width = 1024; canvas.height = 1024;
  const context = canvas.getContext("2d")!;
  context.drawImage(shell, 0, 0, 1024, 1024);
  // The jar export retains a full transparent frame. Crop only for drawing the
  // repeated vessel, not the source asset, so both copies have the same scale.
  const source = document.createElement("canvas");
  source.width = jar.naturalWidth; source.height = jar.naturalHeight;
  const sourceContext = source.getContext("2d")!;
  sourceContext.drawImage(jar, 0, 0);
  const pixels = sourceContext.getImageData(0, 0, source.width, source.height).data;
  let left = source.width, top = source.height, right = -1, bottom = -1;
  for (let y = 0; y < source.height; y++) for (let x = 0; x < source.width; x++) {
    if (pixels[(y * source.width + x) * 4 + 3]! < 16) continue;
    left = Math.min(left, x); right = Math.max(right, x);
    top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  if (right >= left && bottom >= top) {
    const width = right - left + 1, height = bottom - top + 1;
    for (const vessel of BREWERY_VESSEL_LAYOUT.slice(0, Math.max(0, Math.min(2, vesselCount)))) {
      const h = vessel.width * height / width;
      context.drawImage(jar, left, top, width, height, vessel.x - vessel.width / 2, vessel.bottom - h, vessel.width, h);
    }
  }
  // Repaint the low front wall over the vessels; keep the open entrance clear.
  drawFrontWall(context, shell, rightTop);
  // Use the same antialiasing/sharpening pipeline as the other buildings.
  return prepareBuildingTexture(canvas);
};
