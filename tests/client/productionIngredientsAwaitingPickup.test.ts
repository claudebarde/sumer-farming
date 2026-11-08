import { expect, it } from 'vitest';
import { productionIngredientsAwaitingPickup as awaiting } from '../../src/client/game/productionIngredientsAwaitingPickup';
import type { ProductionJourney } from '../../src/game-data/productionJourney';
import type { ProductionState } from '../../src/game-data/production';
import { millingBarleyAwaitingPickup } from '../../src/client/game/phaser/millingReservedBarley';

const preparation: ProductionJourney = {
  departedAt: 1000, stepDurationMs: 100, supplyIndex: 10,
  path: [{ column: 0, row: 0 }], supplyStops: [
    { index: 10, quantity: 1, buildingId: null, column: 0, row: 0 },
    { index: 20, quantity: 1, buildingId: 'warehouse', column: 1, row: 1 },
  ],
};
const startedAt = new Date(5000).toISOString(), completesAt = new Date(100000).toISOString();
it('keeps six planting seeds on the granary chip until arrival, including after reload', () => {
  const production: Partial<ProductionState> = { planting: {
    id: 'planting', total: 6, remaining: [], source: { type: 'granary', column: 3, row: 2 },
    phase: { type: 'collecting' }, stopRequested: false,
    seedPickups: [{ storageId: 'granary', quantity: 6, pickupAt: 5000 }],
  } };
  const farm = { production };
  expect(millingBarleyAwaitingPickup(farm, 'granary', 4999)).toBe(6);
  expect(awaiting(JSON.parse(JSON.stringify(farm)), 'granary', 4999)).toEqual({ barley: 6 });
  expect(awaiting(farm, 'granary', 5000)).toEqual({});
  expect(awaiting(farm, 'granary', 999999)).toEqual({});
  expect(awaiting({ production: { planting: { ...production.planting!, cropKey: 'sesame' } } }, 'granary', 4999)).toEqual({ sesame: 6 });
  expect(awaiting({ production: { planting: { ...production.planting!, phase: { type: 'ready' } } } }, 'granary', 4999)).toEqual({});
});
it('shows flour and groats at their respective sources only until pickup, without changing spendable stock', () => {
  const production: Partial<ProductionState> = {
    baking: { oven: { preparation, startedAt, completesAt, output: 2 } },
    brewing: { brewery: { preparation, arrivedAt: startedAt, startedAt: completesAt, completesAt } },
  };
  const before = JSON.stringify(production);
  expect(awaiting({ production }, 'farm', 1999)).toEqual({ flour: 1, brewersGroats: 1 });
  expect(awaiting({ production }, 'farm', 2000)).toEqual({});
  expect(awaiting({ production }, 'warehouse', 2000)).toEqual({ flour: 1, brewersGroats: 1 });
  expect(awaiting({ production }, 'warehouse', 3000)).toEqual({});
  expect(awaiting({ production: JSON.parse(before) }, 'warehouse', 999999)).toEqual({});
  expect(JSON.stringify(production)).toBe(before);
});
it('handles oil and mixed cooking ingredients and does not invent pickup stock for legacy jobs', () => {
  const production: Partial<ProductionState> = {
    donkeyMilling: { buildingId: 'oil', recipe: 'oil', worker: 'donkey', barley: 9, output: 3, preparation, startedAt, completesAt },
    cooking: { id: 'meal', buildingId: 'kitchen', meal: 'barleyCakes', startedAt, completesAt,
      preparation: { ...preparation, supplyStops: preparation.supplyStops!.map((s, i) => ({ ...s, itemKey: i === 0 ? 'flour' : 'oil' })) } },
    baking: { legacy: { startedAt, completesAt, output: 2 } },
  };
  expect(awaiting({ production }, 'farm', 1500)).toEqual({ sesame: 1, flour: 1 });
  expect(awaiting({ production }, 'warehouse', 2500)).toEqual({ sesame: 1, oil: 1 });
  expect(awaiting({ production }, 'warehouse', 5000)).toEqual({});
});
