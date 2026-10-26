import { expect, it } from "vitest";
import { LYRE_SOURCES, PROCESSION_COUNT, PROCESSION_DURATION_MS, processionPose } from "../../src/client/game/phaser/lyreProcession";
it("loads four poses and previews five staggered musicians", () => {
  expect(LYRE_SOURCES).toHaveLength(8);
  expect(new Set(LYRE_SOURCES.map(source => source.key)).size).toBe(8);
  expect(LYRE_SOURCES.every(source => source.url.endsWith(".webp"))).toBe(true);
  expect(PROCESSION_COUNT).toBe(5);
  const poses = Array.from({ length: 5 }, (_, i) => processionPose(6000, i));
  expect(poses.every(p => p.visible && p.cell.row === 5)).toBe(true);
  expect(new Set(poses.map(p => p.texture)).size).toBe(4);
  expect(poses[0]!.cell.column - poses[1]!.cell.column).toBeCloseTo(1.15);
});
it("alternates male/female frames from the leader through the entire walk cycle", () => {
  const keys = LYRE_SOURCES.map(source => source.key);
  for (let elapsed = 0; elapsed < 1440; elapsed += 180) {
    const poses = Array.from({ length: 5 }, (_, i) => processionPose(elapsed, i));
    expect(poses.map(p => p.texture.split("-")[1])).toEqual(["male", "female", "male", "female", "male"]);
    for (const pose of poses) expect(keys).toContain(pose.texture);
  }
});
it("enters from the left, moves right, and fully exits without looping", () => {
  expect(processionPose(0, 0).visible).toBe(false);
  expect(processionPose(3000, 0).cell.column).toBeGreaterThan(processionPose(2000, 0).cell.column);
  expect(Array.from({ length: 5 }, (_, i) => processionPose(PROCESSION_DURATION_MS, i)).every(p => !p.visible)).toBe(true);
});
