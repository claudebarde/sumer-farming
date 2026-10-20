import { expect, it, vi } from "vitest";
vi.mock("phaser", () => ({ default: {} }));
import type Phaser from "phaser";
import { millShadowCasters, millWorkerForegroundDepths, millDonkeyPose, MILL_DONKEY_SIZE } from "../../src/client/game/phaser/millAnimation";
import { renderMillAnimation, millAnimationPose, millFlourParticles, MILL_ACTIVE_SIZE, MILL_WORKER_SIZE, MILL_CYCLE_MS, MILL_ANIMATION_SOURCES } from "../../src/client/game/phaser/millAnimation";

it("keeps the base and bowl fixed while swapping bags for the worker and resetting the idle lever", () => {
  const sprite = () => Object.fromEntries(["setTexture", "setOrigin", "setPosition", "setDisplaySize", "setDepth", "setVisible", "setRotation", "clear", "fillStyle", "fillCircle"].map(key => [key, vi.fn().mockReturnThis()]));
  const scene = { add: { image: vi.fn(sprite), graphics: vi.fn(sprite) } } as unknown as Phaser.Scene;
  const cell = { column: 5, row: 2 };
  const images = renderMillAnimation(scene, null, cell, null);
  expect(millShadowCasters(images)).toEqual([images.base, images.bags]);
  expect(millShadowCasters(images)).not.toContain(images.bowl);
  expect(millShadowCasters(images)).not.toContain(images.lever);
  expect(millShadowCasters(images)).not.toContain(images.farmer);
  for (const elapsed of [1400, 4200, null]) renderMillAnimation(scene, images, cell, elapsed);
  for (const part of [images.base, images.bowl]) {
    for (const method of [part.setPosition, part.setOrigin, part.setDisplaySize]) {
      const calls = vi.mocked(method).mock.calls;
      expect(calls).toHaveLength(4);
      for (const call of calls) expect(call).toEqual(calls[0]);
    }
  }
  expect(vi.mocked(images.bags.setVisible).mock.calls).toEqual([[true], [false], [false], [true]]);
  expect(vi.mocked(images.farmer.setVisible).mock.calls).toEqual([[false], [true], [true], [false]]);
  expect(images.lever.setRotation).toHaveBeenLastCalledWith(0);
  expect(images.lever.setDisplaySize).toHaveBeenLastCalledWith(MILL_ACTIVE_SIZE * 1.15, MILL_ACTIVE_SIZE);
  expect(scene.add.image).toHaveBeenCalledTimes(6);
  renderMillAnimation(scene, images, cell, null, true);
  expect(images.bags.setVisible).toHaveBeenLastCalledWith(false);
  expect(images.bowl.setVisible).toHaveBeenLastCalledWith(false);
  renderMillAnimation(scene, images, cell, 1400, true);
  expect(images.bags.setVisible).toHaveBeenLastCalledWith(false);
  expect(images.bowl.setVisible).toHaveBeenLastCalledWith(true);
  renderMillAnimation(scene, images, cell, null, false);
  expect(images.bags.setVisible).toHaveBeenLastCalledWith(true);
  expect(images.bowl.setVisible).toHaveBeenLastCalledWith(true);
  renderMillAnimation(scene, images, cell, 1400, false, false);
  expect(images.farmer.setVisible).toHaveBeenLastCalledWith(false);
  expect(images.flour.setVisible).toHaveBeenLastCalledWith(true);
  expect(images.lever.setRotation).toHaveBeenLastCalledWith(millAnimationPose(1400).leverRotation);
  expect(images.donkey.setVisible).toHaveBeenLastCalledWith(true);
  expect(images.donkey.setTexture).toHaveBeenLastCalledWith("mill-donkey-forward");
  expect(images.donkey.setDisplaySize).toHaveBeenLastCalledWith(MILL_DONKEY_SIZE, MILL_DONKEY_SIZE);
  renderMillAnimation(scene, images, cell, 4200, false, false);
  expect(images.donkey.setTexture).toHaveBeenLastCalledWith("mill-donkey-backward");
  renderMillAnimation(scene, images, cell, null);
  expect(images.donkey.setVisible).toHaveBeenLastCalledWith(false);
});

it("loads the base, lever and front/rear worker poses", () => {
  expect(MILL_ANIMATION_SOURCES).toHaveLength(10);
  expect(MILL_ACTIVE_SIZE).toBeLessThan(256);
  expect(MILL_WORKER_SIZE).toBe(88);
});

it("keeps the donkey on its original arc while the lever extends beyond it", () => {
  for (const time of [0, 1400, 2799, 2800, 4200, 5600]) {
    const donkey = millDonkeyPose(time), farmer = millAnimationPose(time);
    const originalReach = 365 / 1024 * MILL_ACTIVE_SIZE;
    expect(donkey.hand.x).toBeCloseTo(-30 + Math.cos(farmer.leverRotation) * originalReach);
    expect(donkey.hand.y).toBeCloseTo(-35 + Math.sin(farmer.leverRotation) * originalReach);
    expect(Math.hypot(farmer.hand.x - donkey.hand.x, farmer.hand.y - donkey.hand.y)).toBeCloseTo(originalReach * 0.15);
    expect(donkey.leverRotation).toBe(farmer.leverRotation);
    expect(donkey.leverDepth).toBe(donkey.southward ? 1.5 : 2.5);
    expect(donkey.contact.y).toBeLessThan(0.4);
    expect(donkey.rotation).toBe(0);
  }
});
it("keeps the donkey upright throughout both milling strokes", () => {
  for (let time = 0; time <= MILL_CYCLE_MS; time += 25) expect(millDonkeyPose(time).rotation).toBe(0);
});
it("alternates strides in both directions by distance, holding near each turn", () => {
  for (const [offset, direction] of [[0, "forward"], [2800, "backward"]] as const) {
    expect(millDonkeyPose(offset).texture).toBe(`mill-donkey-${direction}`);
    expect(millDonkeyPose(offset + 200).texture).toBe(`mill-donkey-${direction}`);
    expect(millDonkeyPose(offset + 300).texture).toBe(`mill-donkey-${direction}-02`);
    expect(millDonkeyPose(offset + 1000).texture).toBe(`mill-donkey-${direction}-02`);
    expect(millDonkeyPose(offset + 1800).texture).toBe(`mill-donkey-${direction}`);
    expect(millDonkeyPose(offset + 2400).texture).toBe(`mill-donkey-${direction}-02`);
    expect(millDonkeyPose(offset + 2799).texture).toBe(millDonkeyPose(offset + 2400).texture);
    expect(millDonkeyPose(offset + 100).texture).toBe(millDonkeyPose(offset).texture);
    expect(millDonkeyPose(offset + 1000).contact).toEqual(millDonkeyPose(offset).contact);
  }
  expect(millDonkeyPose(5600)).toEqual(millDonkeyPose(0));
});
it("loops over a 40 degree arc, keeping contact and limiting the longer-lever footprint overhang", () => {
  expect(millAnimationPose(MILL_CYCLE_MS)).toEqual(millAnimationPose(0));
  for (let t = 0; t < MILL_CYCLE_MS; t += 25) {
    const pose = millAnimationPose(t);
    expect(pose.leverRotation).toBeGreaterThanOrEqual(0);
    expect(pose.leverRotation).toBeLessThanOrEqual(40 * Math.PI / 180);
    // The 15% reach trial allows at most eight world pixels past the diamond edge.
    expect(Math.abs(pose.feet.x) / 96 + Math.abs(pose.feet.y) / 48).toBeLessThan(1 + 8 / 48);
    const reach = 365 / 1024 * MILL_ACTIVE_SIZE * pose.leverScale;
    expect(-30 + Math.cos(pose.leverRotation) * reach).toBeCloseTo(pose.hand.x);
    expect(-35 + Math.sin(pose.leverRotation) * reach).toBeCloseTo(pose.hand.y);
  }
});
it("faces the player pushing south and shows his back returning north", () => {
  expect(millAnimationPose(0).leverRotation).toBe(0);
  expect(millAnimationPose(1400).farmerTexture).toBe("mill-v1-farmer-front");
  expect(millAnimationPose(2800).leverRotation).toBeCloseTo(40 * Math.PI / 180);
  expect(millAnimationPose(4200).farmerTexture).toBe("mill-v1-farmer-back");
  expect(millAnimationPose(1400).hand.x).toBeCloseTo(millAnimationPose(4200).hand.x);
  expect(millAnimationPose(1400).hand.y).toBeCloseTo(millAnimationPose(4200).hand.y);
});
it("keeps flour lightweight, fading and falling from the outlet", () => {
  const first = millFlourParticles(0);
  const next = millFlourParticles(100);
  expect(first).toHaveLength(10);
  expect(next[0]!.y).toBeGreaterThan(first[0]!.y);
  expect(next[0]!.alpha).toBeLessThan(first[0]!.alpha);
  expect(millFlourParticles(1100)).toEqual(first);
});
it("layers the lever in front of the farmer only on the southward push", () => {
  expect(millAnimationPose(0).leverDepth).toBeGreaterThan(2);
  expect(millAnimationPose(2799).leverDepth).toBeGreaterThan(2);
  expect(millAnimationPose(2800).leverDepth).toBeLessThan(2);
  expect(millAnimationPose(5599).leverDepth).toBeLessThan(2);
});

it("preserves lever layering when finished bags raise the working farmer", () => {
  for (const elapsed of [0, 1400, 2800, 4200]) {
    const lever = 100 + millAnimationPose(elapsed).leverDepth;
    const raised = millWorkerForegroundDepths(102, lever, 155);
    expect(raised.farmer).toBe(155);
    expect(raised.lever - raised.farmer).toBeCloseTo(lever - 102);
    expect(millWorkerForegroundDepths(raised.farmer, raised.lever, 155)).toEqual(raised);
  }
  expect(millWorkerForegroundDepths(102, 102.5, 99)).toEqual({ farmer: 102, lever: 102.5 });
});
