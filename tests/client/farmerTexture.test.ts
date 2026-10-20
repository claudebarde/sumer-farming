import { afterEach, describe, expect, it, vi } from "vitest";
import { prepareFarmerTexture, sharpenFarmerPixels } from "../../src/client/game/phaser/farmerTexture";

afterEach(() => vi.unstubAllGlobals());

const setup = (width: number, height: number, visible: boolean) => {
  const data = new Uint8ClampedArray(width * height * 4);
  if (visible) for (let y = 10; y < height - 10; y++) for (let x = 10; x < width - 10; x++) data[(y * width + x) * 4 + 3] = 255;
  const contexts: { drawImage: ReturnType<typeof vi.fn>; getImageData: () => { data: Uint8ClampedArray } }[] = [];
  vi.stubGlobal("document", { createElement: () => {
    const context = { drawImage: vi.fn(), getImageData: () => ({ data }), putImageData: vi.fn() };
    contexts.push(context);
    return { width: 0, height: 0, getContext: () => context };
  } });
  return { contexts, source: { naturalWidth: width, naturalHeight: height } as HTMLImageElement };
};

describe("farmer display texture", () => {
  it("supports higher-resolution porter textures without changing normalized size or foot alignment", () => {
    const { source, contexts } = setup(600, 1200, true);
    const result = prepareFarmerTexture(source, 0, undefined, 256);
    expect(result.width).toBe(256);
    expect(result.height).toBe(256);
    const [, x, y, width, height] = contexts[1]!.drawImage.mock.calls[0]!;
    expect((y + height) / 256).toBe(120 / 128);
    expect(height / 256).toBe(112 / 128);
    expect(Math.abs(x + width / 2 - 128)).toBeLessThanOrEqual(0.5);
  });
  it("uses a shared animation crop instead of fitting individual silhouettes", () => {
    const { source, contexts } = setup(1024, 1536, true);
    prepareFarmerTexture(source, 0, { left: 100, top: 70, right: 960, bottom: 1470 });
    expect(contexts[2]!.drawImage.mock.calls[0]!.slice(1)).toEqual([100, 70, 861, 1401, 0, 0, 861, 1401]);
  });
  it("preserves the approved baseline when sharpening is disabled", () => {
    const data = new Uint8ClampedArray([12, 34, 56, 255]);
    expect(sharpenFarmerPixels(data, 1, 1, 0)).toEqual(data);
  });
  it("gently strengthens opaque detail without modifying alpha or input pixels", () => {
    const data = new Uint8ClampedArray(3 * 3 * 4);
    for (let i = 0; i < data.length; i += 4) data.set([100, 100, 100, 255], i);
    data.set([150, 150, 150, 255], 16);
    const result = sharpenFarmerPixels(data, 3, 3, 0.15);
    expect(result[16]).toBe(158);
    expect(data[16]).toBe(150);
    expect(result[19]).toBe(255);
    data[7] = 0;
    expect(sharpenFarmerPixels(data, 3, 3, 0.15)).toEqual(data);
  });
  it("trims padding, progressively downsamples and anchors the feet consistently", () => {
    const { source, contexts } = setup(600, 1200, true);
    const result = prepareFarmerTexture(source);
    expect(result.width).toBe(128);
    expect(result.height).toBe(128);
    expect(contexts.length).toBeGreaterThan(4);
    expect(contexts[2]!.drawImage.mock.calls[0]!.slice(1)).toEqual([10, 10, 580, 1180, 0, 0, 580, 1180]);
    const [, x, y, width, height] = contexts[1]!.drawImage.mock.calls[0]!;
    expect(y + height).toBe(120);
    expect(height).toBe(112);
    expect(Math.abs(x + width / 2 - 64)).toBeLessThanOrEqual(0.5);
  });
  it("handles fully transparent assets without invalid crop dimensions", () => {
    const { source, contexts } = setup(40, 80, false);
    expect(prepareFarmerTexture(source).width).toBe(128);
    expect(contexts[1]!.drawImage).not.toHaveBeenCalled();
  });
});
