import { expect, it } from "vitest";
import { BuyLambsSchema, livestockPathPose, lambPurchaseLimit } from "../../src/game-data/livestock";
it("interpolates the saved path and clamps offline completion", () => {
  const path = [{ column: 11, row: 5 }, { column: 10, row: 5 }, { column: 9, row: 5 }];
  expect(livestockPathPose(path, 90, 180)).toMatchObject({ position: { column: 10.5, row: 5 }, walking: true, flipX: true });
  expect(livestockPathPose(path, 100000, 180)).toMatchObject({ position: { column: 9, row: 5 }, walking: false });
  expect(livestockPathPose(path, -90, 180).position).toEqual(path[0]);
});
it("enforces indivisible quantities and shared pen capacity", () => {
  expect(lambPurchaseLimit(2, 1000)).toBe(1);
  expect(lambPurchaseLimit(0, 71)).toBe(2);
  expect(BuyLambsSchema.safeParse({ quantity: 1.5, expectedFarmVersion: 1, idempotencyKey: crypto.randomUUID() }).success).toBe(false);
});

import { fleeceRemaining, readySheep, FEED_PERIOD_MS, WOOL_REGROW_MS, type Livestock } from "../../src/game-data/livestock";
import { feedLivestock } from "../../src/game-core/farm/livestock";
it("regrows one shared fleece only during fed time and pauses during hunger", () => {
  const state: Livestock = { delivery: null, animals: [{ id: crypto.randomUUID(), penId: crypto.randomUUID(), purchaseId: crypto.randomUUID(), age: "adult", purchasedAt: 0, arrivesAt: 0, care: { growthMs: WOOL_REGROW_MS, fedAt: 0, needsFeedAt: FEED_PERIOD_MS } }], fleece: { remainingMs: WOOL_REGROW_MS, updatedAt: 0 } };
  expect(fleeceRemaining(state, 3 * FEED_PERIOD_MS)).toBe(FEED_PERIOD_MS);
  expect(readySheep(state, 3 * FEED_PERIOD_MS)).toHaveLength(0);
  const fed = feedLivestock(state, 3 * FEED_PERIOD_MS, 3 * FEED_PERIOD_MS);
  expect(fleeceRemaining(fed, 4 * FEED_PERIOD_MS)).toBe(0);
  expect(readySheep(fed, 4 * FEED_PERIOD_MS)).toHaveLength(1);
  expect(fleeceRemaining(fed, 100 * FEED_PERIOD_MS)).toBe(0);
});
