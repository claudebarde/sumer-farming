import { sharpenFarmerPixels } from "./farmerTexture";

/** Average fine outlines before GPU minification; retain the complete source frame. */
export const prepareBuildingTexture = (source: HTMLImageElement | HTMLCanvasElement, { maxSize = 256, sharpen = 0.35 }: { readonly maxSize?: number; readonly sharpen?: number } = {}): HTMLCanvasElement => {
  let current = document.createElement("canvas");
  current.width = "naturalWidth" in source ? source.naturalWidth : source.width;
  current.height = "naturalHeight" in source ? source.naturalHeight : source.height;
  current.getContext("2d")!.drawImage(source, 0, 0);
  // The granary displays at 256 world pixels. Successive halving integrates thin
  // outline pixels instead of sampling intermittently from the 1024px source.
  while (Math.max(current.width, current.height) > maxSize) {
    const reduced = document.createElement("canvas");
    const scale = Math.max(0.5, maxSize / Math.max(current.width, current.height));
    reduced.width = Math.max(1, Math.round(current.width * scale));
    reduced.height = Math.max(1, Math.round(current.height * scale));
    const context = reduced.getContext("2d")!;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(current, 0, 0, reduced.width, reduced.height);
    current = reduced;
  }
  const context = current.getContext("2d")!;
  const pixels = context.getImageData(0, 0, current.width, current.height);
  pixels.data.set(sharpenFarmerPixels(pixels.data, current.width, current.height, sharpen));
  context.putImageData(pixels, 0, 0);
  return current;
};
