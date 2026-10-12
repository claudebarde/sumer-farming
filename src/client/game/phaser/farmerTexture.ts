// Approved October 9 baseline: pass 0 to restore it exactly. Trial affects RGB only.
export const FARMER_SHARPEN_AMOUNT = 0.15;

export const sharpenFarmerPixels = (data: Uint8ClampedArray, width: number, height: number, amount: number): Uint8ClampedArray => {
  const result = new Uint8ClampedArray(data);
  if (amount <= 0) return result;
  for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
    const index = (y * width + x) * 4;
    const neighbours = [index - 4, index + 4, index - width * 4, index + width * 4];
    // Leave translucent silhouette pixels alone: no dark fringe or harder alpha edge.
    if (data[index + 3]! < 250 || neighbours.some(i => data[i + 3]! < 250)) continue;
    for (let channel = 0; channel < 3; channel++) {
      const average = neighbours.reduce((sum, i) => sum + data[i + channel]!, 0) / 4;
      result[index + channel] = data[index + channel]! + amount * (data[index + channel]! - average);
    }
  }
  return result;
};

/** Prepare artwork near its display resolution rather than minifying a huge texture every frame. */
export const prepareFarmerTexture = (source: HTMLImageElement, sharpenAmount = FARMER_SHARPEN_AMOUNT, frameBounds?: { left: number; top: number; right: number; bottom: number }): HTMLCanvasElement => {
  const original = document.createElement("canvas");
  original.width = source.naturalWidth || source.width;
  original.height = source.naturalHeight || source.height;
  const context = original.getContext("2d")!;
  context.drawImage(source, 0, 0);
  const { data } = context.getImageData(0, 0, original.width, original.height);
  let left = original.width, top = original.height, right = -1, bottom = -1;
  for (let y = 0; y < original.height; y++) for (let x = 0; x < original.width; x++) {
    if (data[(y * original.width + x) * 4 + 3]! > 16) {
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
  }
  const output = document.createElement("canvas");
  // Animation frames share one crop: never rescale each pose to its own silhouette.
  if (frameBounds) ({ left, top, right, bottom } = frameBounds);
  output.width = output.height = 128;
  if (right < left) return output;
  let current = document.createElement("canvas");
  current.width = right - left + 1;
  current.height = bottom - top + 1;
  current.getContext("2d")!.drawImage(original, left, top, current.width, current.height, 0, 0, current.width, current.height);
  // Successive reductions average fine detail instead of skipping over outline pixels.
  while (current.height > 224) {
    const reduced = document.createElement("canvas");
    reduced.width = Math.max(1, Math.round(current.width / 2));
    reduced.height = Math.round(current.height / 2);
    const ctx = reduced.getContext("2d")!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(current, 0, 0, reduced.width, reduced.height);
    current = reduced;
  }
  const scale = Math.min(112 / current.height, 112 / current.width);
  const width = Math.round(current.width * scale), height = Math.round(current.height * scale);
  const target = output.getContext("2d")!;
  target.imageSmoothingEnabled = true;
  target.imageSmoothingQuality = "high";
  // A 56px visible character, centered horizontally, feet at y=60 in the 64px actor tile.
  target.drawImage(current, Math.round((128 - width) / 2), 120 - height, width, height);
  if (sharpenAmount > 0) {
    const pixels = target.getImageData(0, 0, output.width, output.height);
    pixels.data.set(sharpenFarmerPixels(pixels.data, output.width, output.height, sharpenAmount));
    target.putImageData(pixels, 0, 0);
  }
  return output;
};
