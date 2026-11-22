import { afterEach, describe, expect, it, vi } from "vitest";
import type Phaser from "phaser";
import { createRiverRippleLayer } from "../../src/client/game/phaser/riverRippleLayer";
import { riverRipples } from "../../src/client/game/phaser/riverRipples";

vi.mock("phaser", () => ({ default: { Textures: { FilterMode: { LINEAR: 0 } } } }));
afterEach(() => vi.unstubAllGlobals());
const setup = () => {
  const context = { scale: vi.fn(), translate: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn() };
  vi.stubGlobal("document", { createElement: vi.fn(() => ({ getContext: () => context })) });
  const keys = new Set<string>();
  const images: ReturnType<typeof makeImage>[] = [];
  function makeImage() {
    return { setDisplaySize: vi.fn().mockReturnThis(), setDepth: vi.fn().mockReturnThis(), setAlpha: vi.fn().mockReturnThis(), setPosition: vi.fn().mockReturnThis() };
  }
  const addCanvas = vi.fn((key: string) => { keys.add(key); return { setFilter: vi.fn() }; });
  const scene = { textures: { exists: (key: string) => keys.has(key), addCanvas }, add: { image: () => {
    const image = makeImage(); images.push(image); return image;
  } } } as unknown as Phaser.Scene;
  return { scene, images, context, addCanvas };
};
describe("cached river ripples", () => {
  it("draws only four shapes across frames and scene redraws", () => {
    const { scene, images, context, addCanvas } = setup();
    const tiles = [{ column: 3, x: 40, y: 80, timeOffset: 1700 }];
    const layer = createRiverRippleLayer(scene, tiles);
    for (let frame = 0; frame < 600; frame++) layer.render(frame * 16);
    const expected = riverRipples(3, 599 * 16 + 1700);
    expect(images[0]!.setPosition).toHaveBeenLastCalledWith(40 + expected[0]!.points[4]!.x, 80 + expected[0]!.points[4]!.y);
    expect(images[0]!.setAlpha).toHaveBeenLastCalledWith(expected[0]!.alpha);
    createRiverRippleLayer(scene, tiles).render(10000);
    expect(addCanvas).toHaveBeenCalledTimes(4);
    expect(context.stroke).toHaveBeenCalledTimes(4);
  });
  it("holds reduced motion still and resumes when enabled", () => {
    const { scene, images } = setup();
    const layer = createRiverRippleLayer(scene, [{ column: 0, x: 0, y: 0, timeOffset: 0 }]);
    layer.render(100, true);
    layer.render(200, true);
    expect(images[0]!.setPosition).toHaveBeenCalledTimes(1);
    expect(images[0]!.setAlpha).toHaveBeenLastCalledWith(0.4);
    layer.render(200, false);
    expect(images[0]!.setPosition).toHaveBeenCalledTimes(2);
  });
});
