import { expect, it } from "vitest";
import { renovationBuilderPose, RENOVATION_BUILDER_CYCLE_MS } from "../../src/client/game/phaser/renovationBuilderMotion";

it("plays all eight poses in order and loops directly into the next pickup", () => {
  const changes: number[] = [];
  for (let time = 0; time < RENOVATION_BUILDER_CYCLE_MS; time++) {
    const { frame } = renovationBuilderPose(time);
    if (changes.at(-1) !== frame) changes.push(frame);
  }
  expect(changes).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  expect(renovationBuilderPose(RENOVATION_BUILDER_CYCLE_MS)).toEqual({ frame: 1 });
  expect(renovationBuilderPose(-100)).toEqual({ frame: 1 });
});
it("uses the stationary rest pose for reduced motion", () => {
  expect(renovationBuilderPose(1500, true)).toEqual({ frame: 0 });
});
