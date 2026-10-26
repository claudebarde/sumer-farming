import { expect, it, vi } from "vitest";
vi.mock("phaser", () => ({ default: {} }));
import { brewingTestPose, brewingFoamHeight, brewingFoamPerimeter, BREWING_WORKER_BOUNDS, BREWING_FOAM_BASE, BREWING_WORK_PLACEMENTS, createBrewingTest } from "../../src/client/game/phaser/breweryAnimation";
import type Phaser from "phaser";

it.each([0, 1, 2])("layers the worker for %i visible vessels and cleans up", count => {
  const images: Record<string, ReturnType<typeof vi.fn>>[] = [];
  const drawn: Record<string, ReturnType<typeof vi.fn>>[] = [];
  const image = () => {
    const obj = Object.fromEntries(["setOrigin", "setDisplaySize", "setVisible", "setCrop", "setTexture", "setPosition", "setDepth", "destroy"]
      .map(key => [key, vi.fn().mockReturnThis()]));
    images.push(obj); return obj;
  };
  const graphics = () => {
    const obj = Object.fromEntries(["clear", "once", "setDepth", "fillStyle", "fillRoundedRect", "fillRect", "fillEllipse", "fillCircle", "destroy"]
      .map(key => [key, vi.fn().mockReturnThis()]));
    Object.assign(obj, { scene });
    drawn.push(obj); return obj;
  };
  const scene = { events: { on: vi.fn(), off: vi.fn() }, add: { image, graphics } } as unknown as Phaser.Scene;
  const brewery = { x: 100, y: 200, depth: 176, displayWidth: 150, displayHeight: 150, originX: 0.5, originY: 120 / 128,
    texture: { key: "brewery", getSourceImage: () => ({ width: 256, height: 256 }) } } as unknown as Phaser.GameObjects.Image;
  const animation = createBrewingTest(scene, brewery, false, count);
  animation.render(1000, false);
  expect(images[0]!.setPosition).toHaveBeenLastCalledWith(count === 1 ? 73 : 104.5, count === 1 ? 136 : 144);
  expect(images[1]!.setPosition).toHaveBeenLastCalledWith(count === 1 ? 70 : 101.5, count === 1 ? 136 : 144);
  expect(images).toHaveLength(3); // Shell-only front wall, never a jar overlay.
  expect(images[2]!.setPosition).toHaveBeenLastCalledWith(100, 200);
  expect(images[2]!.setDepth).toHaveBeenLastCalledWith(176.75);
  expect(images[0]!.setDepth).toHaveBeenLastCalledWith(177);
  expect(images[1]!.setDepth).toHaveBeenLastCalledWith(176.5);
  for (const obj of images) expect(obj.setVisible).toHaveBeenLastCalledWith(count > 0);
  expect(drawn).toHaveLength(2); // Foam and progress only; paddle is in the sprite.
  animation.render(8000, false);
  expect(drawn[0]!.fillEllipse).toHaveBeenCalledTimes(count * 2);
  for (const obj of images) expect(obj.setVisible).toHaveBeenLastCalledWith(false);
  animation.destroy();
  for (const obj of images) expect(obj.destroy).toHaveBeenCalledOnce();
  for (const obj of drawn) expect(obj.destroy).toHaveBeenCalledOnce();
});

it("preserves the approved left preset and translates the pair together to the right jar", () => {
  const { left, right } = BREWING_WORK_PLACEMENTS;
  expect(left).toEqual({ x: -30, workerX: -27, seatY: -64, groundY: -40, size: 40 });
  expect(right.x - left.x).toBe(31.5);
  expect(right.workerX - left.workerX).toBe(31.5);
  expect(right.seatY - left.seatY).toBe(8);
  expect(right.groundY - left.groundY).toBe(8);
  expect(right.size).toBe(left.size);
});

it("adds fluffy details around all sides of the rounded cap", () => {
  for (const height of [2, 4, 8]) {
    const bubbles = brewingFoamPerimeter(height);
    expect(bubbles).toHaveLength(12);
    for (const x of [-1, 1]) for (const y of [-1, 1]) {
      expect(bubbles.some(b => b.x * x > 0 && (b.y + height / 3) * y > 0)).toBe(true);
    }
    expect(Math.max(...bubbles.map(b => b.radius))).toBeLessThan(4);
  }
});

it("covers the jar opening with a full oval even when the foam settles", () => {
  expect(BREWING_FOAM_BASE).toEqual({ width: 24, height: 12 });
});

it("stirs with a planted-foot pause and releases the preview worker after eight seconds", () => {
  expect([0, 375, 750, 1125].map(t => brewingTestPose(t).frame)).toEqual([0, 1, 0, 2]);
  for (const t of [3000, 3500, 3999, 7000, 7999]) expect(brewingTestPose(t).frame).toBe(0);
  expect(brewingTestPose(7999).preparing).toBe(true);
  expect(brewingTestPose(8000)).toMatchObject({ preparing: false, progress: 1 });
  expect(brewingTestPose(60000).preparing).toBe(false);
  expect(brewingTestPose(-100).progress).toBe(0);
});
it("shares the body registration across poses and respects reduced motion", () => {
  expect(BREWING_WORKER_BOUNDS.bottom - BREWING_WORKER_BOUNDS.top).toBe(1230);
  expect(brewingTestPose(375, true).frame).toBe(0);
  expect(brewingFoamHeight(0, 0, true)).toBe(brewingFoamHeight(1000, 1, true));
});
it("keeps two foam caps proportionate and out of sync", () => {
  expect(brewingFoamHeight(0, 0, false)).not.toBe(brewingFoamHeight(0, 1, false));
  for (let t = 0; t < 15000; t += 100) for (const jar of [0, 1]) {
    expect(brewingFoamHeight(t, jar, false)).toBeGreaterThanOrEqual(2);
    expect(brewingFoamHeight(t, jar, false)).toBeLessThanOrEqual(8);
  }
});
