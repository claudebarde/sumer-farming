import { expect, it } from "vitest";
import { advanceClouds, initialClouds, cloudPose, CLOUD_CYCLE_MS, randomCloudStyle } from "../../src/client/game/phaser/ambientClouds";

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
