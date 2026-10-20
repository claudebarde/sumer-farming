import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { advanceDonkeyFollow, appendDonkeyTrail, donkeyFollowPose, newlyPurchasedDonkey, startDonkeyFollow } from "../../src/client/game/phaser/donkeyFollow";
import { arrivingDonkey } from "../../src/client/game/phaser/isometricDonkey";
import { isMarketRoad } from "../../src/client/game/phaser/isometricMarketLayout";

it("spawns beside the farmer on a road, including mid-step and corners", () => {
  for (const leader of [{ column: 3, row: 11 }, { column: 0, row: 7.2 }, { column: 9, row: 11 }, { column: -4, row: 5 }]) {
    const state = startDonkeyFollow(leader)!;
    expect(state).not.toBeNull();
    expect(isMarketRoad(state.position)).toBe(true);
    expect(Math.abs(state.position.column - leader.column) + Math.abs(state.position.row - leader.row)).toBe(1);
    expect(advanceDonkeyFollow(state, 80)).toMatchObject({ position: state.position, walking: false });
  }
  expect(startDonkeyFollow({ column: 4, row: 8 })).toBeNull();
});

it("follows the recorded route without cutting corners and catches up at the exit", () => {
  let state = startDonkeyFollow({ column: 0, row: 5 })!;
  for (const point of [{ column: 0, row: 6 }, { column: 0, row: 7 }, { column: 0, row: 8 }]) state = appendDonkeyTrail(state, point);
  for (let i = 0; i < 30; i++) {
    state = advanceDonkeyFollow(state, 80);
    expect(isMarketRoad(state.position)).toBe(true);
  }
  expect(state.position).toEqual({ column: 0, row: 7 });
  expect(state.walking).toBe(false);
  for (let i = 0; i < 10; i++) state = advanceDonkeyFollow(state, 80, true);
  expect(state.position).toEqual({ column: 0, row: 8 });
  expect(state.trail).toEqual([]);
});

it("does not accumulate idle samples and caps hidden-tab catch-up", () => {
  const start = startDonkeyFollow({ column: 3, row: 11 })!;
  expect(appendDonkeyTrail(start, { column: 3, row: 11 })).toBe(start);
  const trail = appendDonkeyTrail(start, { column: 4, row: 11 });
  expect(advanceDonkeyFollow(trail, 60000)).toEqual(advanceDonkeyFollow(trail, 80));
  expect(advanceDonkeyFollow(trail, 0).position).toEqual(start.position);
});

it("uses directional walking frames, holding a static pose for reduced motion", () => {
  const state = { ...startDonkeyFollow({ column: 0, row: 5 })!, distance: 0.6, walking: true, facingBack: true, facingLeft: false };
  expect(donkeyFollowPose(state)).toEqual({ texture: "isometric-donkey-back-2", flipX: true });
  expect(donkeyFollowPose(state, true).texture).toBe("isometric-donkey-back-0");
  expect(donkeyFollowPose({ ...state, walking: false }).texture).toBe("isometric-donkey-back-0");
});

it("triggers only a new ownership transition, never a repeat snapshot", () => {
  const owned = [{ itemKey: "donkey", quantity: 1 }];
  expect(newlyPurchasedDonkey([], owned)).toBe(true);
  expect(newlyPurchasedDonkey(owned, owned)).toBe(false);
  expect(newlyPurchasedDonkey([], [])).toBe(false);
  expect(newlyPurchasedDonkey(owned, [])).toBe(false);
});

it("enters the farm near the market and walks only through allowed cells", () => {
  const cells = [{ column: 9, row: 5 }, { column: 8, row: 5 }, { column: 8, row: 4 }];
  const state = arrivingDonkey(cells, [])!;
  expect(state.position).toEqual({ column: 9, row: 5 });
  expect(state.motion).toMatchObject({ from: cells[0], to: cells[1], remaining: [cells[2]] });
  expect(arrivingDonkey(cells, [cells[0]!])?.position).toEqual(cells[1]);
  expect(arrivingDonkey([], [])).toBeNull();
});

it("connects real purchase snapshots without temporary preview controls", () => {
  const source = readFileSync(new URL("../../src/client/components/IsometricFarm.tsx", import.meta.url), "utf8");
  expect(source).toContain("newlyPurchasedDonkey(current.current.inventory, next.inventory)");
  expect(source).toContain("if (donkey) scene.current?.receiveMarketDonkey()");
  expect(source).not.toContain("donkeyPurchaseTest");
  expect(source).not.toContain("Preview donkey purchase");
});
