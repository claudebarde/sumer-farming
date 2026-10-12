import { afterEach, expect, it, vi } from "vitest";
import { prepareBuildingTexture } from "../../src/client/game/phaser/buildingTexture";

afterEach(() => vi.unstubAllGlobals());
it("progressively reduces the full building frame without cropping or changing aspect ratio", () => {
  const canvases: HTMLCanvasElement[] = [];
  const draws: ReturnType<typeof vi.fn>[] = [];
  vi.stubGlobal("document", { createElement: () => {
    const drawImage = vi.fn(); draws.push(drawImage);
    const canvas = { width: 0, height: 0, getContext: () => ({ drawImage,
      getImageData: () => ({ data: new Uint8ClampedArray(canvas.width * canvas.height * 4) }), putImageData: vi.fn() }) };
    canvases.push(canvas as unknown as HTMLCanvasElement);
    return canvas;
  } });
  const source = { naturalWidth: 1024, naturalHeight: 1024 } as HTMLImageElement;
  const result = prepareBuildingTexture(source);
  expect(canvases.map(c => [c.width, c.height])).toEqual([[1024, 1024], [512, 512], [256, 256]]);
  expect(draws[1]).toHaveBeenCalledWith(canvases[0], 0, 0, 512, 512);
  expect(draws[2]).toHaveBeenCalledWith(canvases[1], 0, 0, 256, 256);
  expect(result).toBe(canvases[2]);
});
