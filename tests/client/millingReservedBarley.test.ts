import { expect, it } from 'vitest';
import { millingBarleyAwaitingPickup } from '../../src/client/game/phaser/millingReservedBarley';
import type { MillingJob } from '../../src/game-data/milling';

const job: MillingJob = {
  buildingId: 'mill', recipe: 'flour', worker: 'donkey', barley: 6, output: 3,
  startedAt: new Date(5000).toISOString(), completesAt: new Date(905000).toISOString(),
  preparation: { departedAt: 1000, stepDurationMs: 100, supplyIndex: 10,
    path: [{ column: 0, row: 0 }],
    supplyStops: [
      { index: 10, quantity: 4, buildingId: 'granary', column: 1, row: 1 },
      { index: 20, quantity: 2, buildingId: null, column: 0, row: 0 },
    ],
  },
};
it('keeps reserved barley visible until each source pickup, including on reload', () => {
  const farm = { milling: job };
  expect(millingBarleyAwaitingPickup(farm, 'granary', 1500)).toBe(4);
  expect(millingBarleyAwaitingPickup(farm, 'granary', 2000)).toBe(0);
  expect(millingBarleyAwaitingPickup(farm, 'farm', 2000)).toBe(2);
  expect(millingBarleyAwaitingPickup(farm, 'farm', 3000)).toBe(0);
  expect(millingBarleyAwaitingPickup(farm, 'granary', 999999)).toBe(0);
});
it('supports the concurrent slot and farmer jobs without restoring sesame or legacy deductions', () => {
  expect(millingBarleyAwaitingPickup({ production: { donkeyMilling: job } }, 'granary', 1500)).toBe(4);
  expect(millingBarleyAwaitingPickup({ milling: { ...job, worker: 'farmer' } }, 'granary', 1500)).toBe(4);
  expect(millingBarleyAwaitingPickup({ milling: { ...job, recipe: 'oil' } }, 'granary', 1500)).toBe(0);
  expect(millingBarleyAwaitingPickup({ milling: { ...job, preparation: undefined } }, 'granary', 1500)).toBe(0);
});
