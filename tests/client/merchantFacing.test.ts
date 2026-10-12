import { expect, it } from "vitest";
import { advanceMerchantFacing, initialMerchantFacing, type MerchantFacing } from "../../src/client/game/phaser/merchantFacing";

const merchant = { column: 3, row: 4.5 };
const left = { column: 2, row: 5 }, right = { column: 5, row: 5 };
const wait = (state: MerchantFacing, farmer = right, frames = 4) => {
  for (let i = 0; i < frames; i++) state = advanceMerchantFacing(state, merchant, farmer, 80);
  return state;
};
it("turns towards a nearby farmer only after a short sustained delay", () => {
  const start = initialMerchantFacing();
  expect(wait(start, right, 3).flipX).toBe(true);
  const turned = wait(start);
  expect(turned.flipX).toBe(false);
  expect(wait(turned, left).flipX).toBe(true);
});
it("uses projected screen direction rather than column alone", () => {
  expect(wait(initialMerchantFacing(), { column: 2, row: 2 }).flipX).toBe(false);
});
it("holds direction in the neutral zone and cancels a pending turn", () => {
  const pending = wait(initialMerchantFacing(), right, 2);
  expect(wait(pending, { column: 3.5, row: 5 })).toEqual(initialMerchantFacing());
  expect(wait(pending, left)).toEqual(initialMerchantFacing());
});
it("does not track distant farmers or accumulate delay outside the notice radius", () => {
  const pending = wait(initialMerchantFacing(), right, 2);
  expect(wait(pending, { column: 10, row: 5 })).toEqual(initialMerchantFacing());
  expect(wait({ flipX: false, waitingMs: 0 }, { column: -4, row: 5 }).flipX).toBe(false);
});
it("does not complete a turn from a single suspended-tab frame", () => {
  expect(advanceMerchantFacing(initialMerchantFacing(), merchant, right, 60000).flipX).toBe(true);
});
