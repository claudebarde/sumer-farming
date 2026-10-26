import { expect, it } from "vitest";
import { DONKEY_FRAME_BOUNDS, DONKEY_SOURCES, donkeyTexture, donkeyWanderPose, donkeyFrameBounds } from "../../src/client/game/phaser/donkeySprites";

it("uses all four walking poses in sequence over one 900ms step", () => {
  expect([0, 224, 225, 450, 675, 899, 900].map(t => donkeyTexture(t))).toEqual([
    "isometric-donkey-walk-0", "isometric-donkey-walk-0", "isometric-donkey-walk-1",
    "isometric-donkey-walk-2", "isometric-donkey-walk-3", "isometric-donkey-walk-3", "isometric-donkey-walk-0",
  ]);
  expect(donkeyTexture(null)).toBe("isometric-donkey");
  expect(donkeyTexture(450, true)).toBe("isometric-donkey");
});
it("loads relocated assets and keeps the legacy escort registration", () => {
  expect(Object.values(DONKEY_SOURCES)).toHaveLength(13);
  for (const url of Object.values(DONKEY_SOURCES)) expect(url).toContain("/donkey/");
  for (const i of [0, 1, 2, 3]) expect(DONKEY_SOURCES[`isometric-donkey-walk-${i}` as keyof typeof DONKEY_SOURCES]).toContain(`donkey-walk-0${i + 1}.webp`);
  expect(DONKEY_FRAME_BOUNDS).toEqual({ left: 70, top: 82, right: 1008, bottom: 931 });
});

it("uses four directional strides, mirroring left-facing art only for right travel", () => {
  for (const facingBack of [false, true]) for (const facingLeft of [false, true]) {
    for (const frame of [0, 1, 2, 3]) {
      const state = { position: { column: 0, row: 0 }, facingBack, facingLeft, rest: 0,
        motion: { from: { column: 0, row: 0 }, to: { column: 1, row: 0 }, elapsed: frame * 225 } };
      expect(donkeyWanderPose(state)).toEqual({ texture: `isometric-donkey-${facingBack ? "back" : "front"}-${frame}`, flipX: !facingLeft });
      expect(donkeyWanderPose(state, true).texture).toMatch(/-0$/);
      expect(donkeyWanderPose({ ...state, motion: null }).texture).toMatch(/-0$/);
    }
  }
});

it("keeps the full directional canvas to avoid cropping ears and hooves", () => {
  for (const direction of ["front", "back"]) for (const frame of [0, 1, 2, 3]) {
    const key = `isometric-donkey-${direction}-${frame}` as keyof typeof DONKEY_SOURCES;
    expect(DONKEY_SOURCES[key]).toContain(`donkey-walk-${direction}-0${frame + 1}.webp`);
    expect(donkeyFrameBounds(key)).toEqual({ left: 0, top: 0, right: 1024, bottom: 1024 });
  }
  expect(donkeyFrameBounds("isometric-donkey")).toEqual(DONKEY_FRAME_BOUNDS);
});
