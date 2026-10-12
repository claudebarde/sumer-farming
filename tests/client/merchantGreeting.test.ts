import { expect, it } from "vitest";
import { advanceGreeting, greetingAppearance, initialGreetingState, merchantGreetings } from "../../src/client/game/phaser/merchantGreeting";

const merchants = [
  { scope: "barley", merchant: { column: 3, row: 4.5 } },
  { scope: "beer", merchant: { column: 6, row: 4.5 } },
  { scope: "baking", merchant: { column: 3, row: 10.5 } },
] as const;
it.each(merchants)("greets at the $scope stand with its approved text", merchant => {
  const state = advanceGreeting(initialGreetingState(), merchants, merchant.merchant, 1000, false);
  expect(state.active).toEqual({ merchant: merchant.scope, startedAt: 1000 });
  expect(merchantGreetings[merchant.scope]).toBeTruthy();
});
it("only selects the nearest merchant in overlapping notice radii", () => {
  const state = advanceGreeting(initialGreetingState(), merchants, { column: 5, row: 5 }, 1000, false);
  expect(state.active?.merchant).toBe("beer");
});
it("stays silent outside the radius and while trading or returning", () => {
  expect(advanceGreeting(initialGreetingState(), merchants, { column: -2, row: 5 }, 1000, false).active).toBeNull();
  expect(advanceGreeting(initialGreetingState(), merchants, merchants[0].merchant, 1000, true).active).toBeNull();
});
it("expires after four seconds, including hidden-tab catch-up, without repeating nearby", () => {
  const state = advanceGreeting(initialGreetingState(), merchants, merchants[0].merchant, 1000, false);
  expect(advanceGreeting(state, merchants, merchants[0].merchant, 4999, false).active).not.toBeNull();
  expect(advanceGreeting(state, merchants, merchants[0].merchant, 5000, false).active).toBeNull();
  expect(advanceGreeting(state, merchants, merchants[0].merchant, 100000, false).active).toBeNull();
});
it("dismisses for a dialog and does not replay on closing it", () => {
  const state = advanceGreeting(initialGreetingState(), merchants, merchants[0].merchant, 1000, false);
  const dismissed = advanceGreeting(state, merchants, merchants[0].merchant, 1200, true);
  expect(dismissed.active).toBeNull();
  expect(advanceGreeting(dismissed, merchants, merchants[0].merchant, 20000, false).active).toBeNull();
});
it("requires leaving the wider radius and observing the cooldown to repeat", () => {
  const state = advanceGreeting(initialGreetingState(), merchants, merchants[0].merchant, 1000, false);
  const edge = advanceGreeting(state, merchants, { column: 0, row: 5 }, 6000, false);
  expect(edge.greeted).toContain("barley");
  const left = advanceGreeting(edge, merchants, { column: -2, row: 5 }, 6100, false);
  expect(left.greeted).toEqual([]);
  expect(advanceGreeting(left, merchants, merchants[0].merchant, 7000, false).active).toBeNull();
  expect(advanceGreeting(left, merchants, merchants[0].merchant, 9000, false).active?.merchant).toBe("barley");
});
it("replaces the barley greeting with beer immediately, without sharing its cooldown", () => {
  const state = advanceGreeting(initialGreetingState(), merchants, merchants[0].merchant, 1000, false);
  const beer = advanceGreeting(state, merchants, merchants[1].merchant, 1500, false);
  expect(beer.active).toEqual({ merchant: "beer", startedAt: 1500 });
  expect(beer.nextAt).toEqual({ barley: 9000, beer: 9500 });
});
it("greets all three merchants during a quick walk without waiting at each stand", () => {
  let state = initialGreetingState();
  for (const [index, merchant] of merchants.entries()) {
    state = advanceGreeting(state, merchants, { column: merchant.merchant.column, row: merchant.merchant.row + 0.5 }, 1000 + index * 1000, false);
    expect(state.active?.merchant).toBe(merchant.scope);
  }
});
it("keeps beer's own cooldown after leaving, even if another merchant greets meanwhile", () => {
  const beer = advanceGreeting(initialGreetingState(), merchants, merchants[1].merchant, 1000, false);
  const baker = advanceGreeting(beer, merchants, merchants[2].merchant, 2000, false);
  expect(baker.active?.merchant).toBe("baking");
  expect(advanceGreeting(baker, merchants, merchants[1].merchant, 3000, false).active).toBeNull();
  expect(advanceGreeting(baker, merchants, merchants[1].merchant, 9000, false).active?.merchant).toBe("beer");
});
it("bounces subtly, settles, fades out and respects reduced motion", () => {
  expect(greetingAppearance(200, false).scale).toBeGreaterThan(1);
  expect(greetingAppearance(300, false)).toEqual({ scale: 1, alpha: 1 });
  expect(greetingAppearance(4000, false).alpha).toBe(0);
  expect(greetingAppearance(200, true).scale).toBe(1);
});
