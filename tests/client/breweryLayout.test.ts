import { afterEach, expect, it, vi } from "vitest";
vi.mock("../../src/client/game/phaser/buildingTexture", () => ({ prepareBuildingTexture: (canvas: HTMLCanvasElement) => canvas }));
import { BREWERY_VESSEL_LAYOUT, prepareBreweryLayout, breweryVesselCount } from "../../src/client/game/phaser/breweryLayout";

afterEach(() => vi.unstubAllGlobals());
it.each([0, 1, 2])("draws exactly %i vessels inside either shell, then overlays the front wall", count => {
  const pixels = new Uint8ClampedArray(4 * 4 * 4);
  for (const index of [5, 6, 9, 10]) pixels[index * 4 + 3] = 255;
  const context = { drawImage: vi.fn(), getImageData: () => ({ data: pixels }), save: vi.fn(), restore: vi.fn(),
    beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), closePath: vi.fn(), clip: vi.fn() };
  vi.stubGlobal("document", { createElement: () => ({ width: 0, height: 0, getContext: () => context }) });
  const shell = { naturalWidth: 1024, naturalHeight: 1024 } as HTMLImageElement;
  const jar = { naturalWidth: 4, naturalHeight: 4 } as HTMLImageElement;
  const canvas = prepareBreweryLayout(shell, jar, false, count);
  expect([canvas.width, canvas.height]).toEqual([1024, 1024]);
  expect(BREWERY_VESSEL_LAYOUT).toHaveLength(2);
  const copies = context.drawImage.mock.calls.filter(args => args[0] === jar && args.length === 9);
  expect(copies).toHaveLength(count);
  expect(copies.map(args => args.slice(5))).toEqual([[308.5, 392, 253, 253], [523.5, 447, 253, 253]].slice(0, count));
  expect(context.drawImage).toHaveBeenLastCalledWith(shell, 0, 0, 1024, 1024);
  expect(context.clip).toHaveBeenCalledOnce();
  context.drawImage.mockClear();
  prepareBreweryLayout(shell, jar, true, count);
  expect(context.drawImage.mock.calls.filter(args => args[0] === jar && args.length === 9)).toHaveLength(count);
});

it("tracks equipment purchases independently of packaging jars and finished beer", () => {
  expect(breweryVesselCount([])).toBe(0);
  for (const quantity of [0, 1, 2, 5]) expect(breweryVesselCount([
    { itemKey: "brewingVessels", quantity }, { itemKey: "emptyBeerJar", quantity: 10 }, { itemKey: "beer", quantity: 5 },
  ])).toBe(Math.min(2, quantity));
  expect(breweryVesselCount([{ itemKey: "emptyBeerJar", quantity: 2 }])).toBe(0);
});
