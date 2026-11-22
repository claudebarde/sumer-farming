import { expect, it } from "vitest";
import { advanceLivestock, feedLivestock } from "../../src/game-core/farm/livestock";
import { FEED_PERIOD_MS as PERIOD, FEED_GRACE_MS as GRACE, flockFeedDue, sheepGrowth, sheepStage, type Livestock } from "../../src/game-data/livestock";
const initial: Livestock = { delivery: null, animals: [{ id: "a", purchaseId: "p", penId: "pen", age: "lamb", purchasedAt: 0, arrivesAt: 0 }] };
it("gives old lambs a fresh grace period, then loses them exactly at the deadline", () => {
  const state = advanceLivestock(initial, 1000);
  expect(state.animals[0]!.care!.needsFeedAt).toBe(1000);
  expect(advanceLivestock(state, 1000 + GRACE - 1).animals).toHaveLength(1);
  const lost = advanceLivestock(state, 1000 + GRACE);
  expect(lost.animals).toHaveLength(0);
  expect(lost.losses).toHaveLength(1);
  expect(advanceLivestock(lost, 1000 + GRACE + 1)).toBe(lost);
});
it("pauses growth after twelve fed hours and reaches adulthood after two feeds, offline", () => {
  const first = feedLivestock(advanceLivestock(initial, 0), 3000, 0);
  expect(sheepGrowth(first.animals[0]!, 2000)).toBe(0);
  expect(sheepStage(first.animals[0]!, PERIOD + 3000)).toBe("Growing");
  expect(sheepGrowth(first.animals[0]!, PERIOD * 2 + 3000)).toBe(PERIOD);
  const second = feedLivestock(first, PERIOD * 2 + 6000, PERIOD * 2 + 3000);
  const adult = advanceLivestock(second, PERIOD * 3 + 6000);
  expect(adult.animals[0]!.age).toBe("adult");
  expect(sheepStage(adult.animals[0]!, PERIOD * 3 + 6000)).toBe("Adult");
});
it("allows mixed ages on the same feeding clock without growing an unfed arrival", () => {
  const older = feedLivestock(advanceLivestock(initial, 0), 0, 0);
  const mixed = { ...older, animals: [...older.animals, { ...initial.animals[0]!, id: "b", arrivesAt: PERIOD / 2, care: { growthMs: 0, fedAt: null, needsFeedAt: PERIOD } }] };
  expect(flockFeedDue(mixed, PERIOD - 1)).toBe(false);
  expect(flockFeedDue(mixed, PERIOD)).toBe(true);
  expect(sheepGrowth(mixed.animals[1]!, PERIOD)).toBe(0);
  const next = feedLivestock(mixed, PERIOD + 3000, PERIOD);
  expect(sheepStage(next.animals[0]!, PERIOD * 2 + 3000)).toBe("Adult");
  expect(sheepStage(next.animals[1]!, PERIOD * 2 + 3000)).toBe("Growing");
});
it("does not offer feeding during arrival or a saved feeding journey", () => {
  const ready = advanceLivestock(initial, 0);
  expect(flockFeedDue({ ...ready, animals: ready.animals.map(a => ({ ...a, arrivesAt: 100 })) }, 0)).toBe(false);
});
