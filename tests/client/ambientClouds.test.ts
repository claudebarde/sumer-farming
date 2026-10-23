import { expect, it, vi } from "vitest";
import { advanceClouds, initialClouds, cloudPose, CLOUD_CYCLE_MS, randomCloudStyle, createAmbientCloudLayer } from "../../src/client/game/phaser/ambientClouds";

it("drifts slowly left to right without changing opacity mid-flight", () => {
  const style = randomCloudStyle(() => 0.5);
  const a = cloudPose(0.25, 1000, 600, style), b = cloudPose(0.25 + 1000 / CLOUD_CYCLE_MS, 1000, 600, style);
  expect(b.x).toBeGreaterThan(a.x);
  expect(b.x - a.x).toBeLessThan(12);
  expect(b.alpha).toBe(a.alpha);
  expect(a.alpha).toBeCloseTo(0.27);
});
it.each([320, 1000, 2000])("keeps one to three clouds visible at viewport width %i", width => {
  for (const value of [0, 0.5, 0.999]) {
  const random = () => value;
  let state = initialClouds(random);
  for (let elapsed = 0; elapsed < CLOUD_CYCLE_MS * 10; elapsed += 80) {
    const visible = state.clouds.map(c => cloudPose(c.progress, width, 600, c.style))
      // Count the central opaque part, not merely transparent texture margins.
      .filter(p => p.x + p.width * 0.25 > 0 && p.x - p.width * 0.25 < width);
    expect(visible.length).toBeGreaterThanOrEqual(1);
    expect(state.clouds.length).toBeLessThanOrEqual(3);
    state = advanceClouds(state, 80, random);
  }
  }
});
it("offers four silhouettes and keeps each cloud's shape and opacity through its crossing", () => {
  expect([0, 0.25, 0.5, 0.75].map(value => randomCloudStyle(() => value).shape)).toEqual([0, 1, 2, 3]);
  const start = initialClouds(() => 0.25);
  const next = advanceClouds(start, 80, () => 0.9);
  expect(next.clouds[0]!.style).toEqual(start.clouds[0]!.style);
});

it("pauses scene clouds while hidden/reduced and destroys every sprite", () => {
  const sprites = Array.from({ length: 3 }, () => ({
    setDepth: vi.fn().mockReturnThis(), setVisible: vi.fn().mockReturnThis(),
    setTexture: vi.fn().mockReturnThis(), setPosition: vi.fn().mockReturnThis(),
    setDisplaySize: vi.fn().mockReturnThis(), setAlpha: vi.fn().mockReturnThis(), destroy: vi.fn(),
  }));
  let index = 0;
  const preference = { matches: false };
  vi.stubGlobal("window", { matchMedia: () => preference });
  vi.stubGlobal("document", { hidden: false });
  try {
    const scene = { textures: { exists: () => true }, add: { image: () => sprites[index++] },
      cameras: { main: { width: 1000, height: 600, zoom: 2, getWorldPoint: (x: number, y: number) => ({ x, y }) } } };
    const layer = createAmbientCloudLayer(scene as unknown as Parameters<typeof createAmbientCloudLayer>[0]);
    layer.update(0);
    const initial = sprites[0]!.setPosition.mock.lastCall![0];
    layer.update(80);
    const moved = sprites[0]!.setPosition.mock.lastCall![0];
    expect(moved).toBeGreaterThan(initial);
    vi.stubGlobal("document", { hidden: true }); layer.update(60000);
    expect(sprites[0]!.setPosition.mock.lastCall![0]).toBe(moved);
    vi.stubGlobal("document", { hidden: false }); preference.matches = true; layer.update(80);
    expect(sprites[0]!.setPosition.mock.lastCall![0]).toBe(moved);
    layer.destroy();
    sprites.forEach(sprite => expect(sprite.destroy).toHaveBeenCalledOnce());
  } finally { vi.unstubAllGlobals(); }
});
