import { expect, it } from "vitest";
import { FarmSnapshotSchema } from "../../src/schemas/farm";
import type { Ziggurat } from "../../src/schemas/ziggurat";
import { INITIAL_PROGRESSION_STATS } from "../../src/game-data/progression";
import { ProgressionSchema } from "../../src/schemas/progression";
import { canVisitNeighbourhood, neighbourhoodTripActive } from "../../src/client/game/phaser/neighbourhoodAvailability";
const id = "00000000-0000-4000-8000-000000000001";
const snapshot = () => {
  const saved = FarmSnapshotSchema.parse({ created: false, player: { shekelBalance: 0 },
    farm: { id, playerId: id, version: 1, household: { happiness: 70, lastBeerAt: null, lastFishAt: null, hungrySince: null, cultivationStartedAt: null, nextBarleyConsumptionAt: null }, carriedItem: null, gathering: null },
    inventory: [], objects: [], groundItems: [], crops: [], improvements: [], buildings: [] });
  saved.farm.progression = ProgressionSchema.parse({ level: 7, stats: INITIAL_PROGRESSION_STATS, barleySold: 0, beerSold: 0, requestsDelivered: 0 });
  return saved;
};
it("requires level seven and empty hands", () => {
  const saved = snapshot();
  expect(canVisitNeighbourhood(saved, 0)).toBe(true);
  saved.farm.progression!.level = 6;
  expect(canVisitNeighbourhood(saved, 0)).toBe(false);
  saved.farm.progression!.level = 7;
  saved.farm.carriedItem = { itemKey: "barley", quantity: 1, expiresAt: null };
  expect(canVisitNeighbourhood(saved, 0)).toBe(false);
});
it("blocks baking but allows unattended fermentation", () => {
  const saved = snapshot();
  saved.farm.production.baking[id] = { startedAt: new Date(0).toISOString() } as typeof saved.farm.production.baking[string];
  expect(canVisitNeighbourhood(saved, 1000)).toBe(false);
  saved.farm.production.baking = {};
  saved.farm.production.brewing = {};
  saved.farm.production.brewing[id] = { startedAt: new Date(2000).toISOString() } as typeof saved.farm.production.brewing[string];
  expect(canVisitNeighbourhood(saved, 1000)).toBe(false);
  expect(canVisitNeighbourhood(saved, 2000)).toBe(true);
});
it("allows donkey milling only after the farmer's preparation", () => {
  const saved = snapshot();
  saved.farm.production.donkeyMilling = { buildingId: id, startedAt: new Date(2000).toISOString() } as NonNullable<typeof saved.farm.production.donkeyMilling>;
  expect(canVisitNeighbourhood(saved, 1000)).toBe(false);
  expect(canVisitNeighbourhood(saved, 2000)).toBe(true);
});
it("blocks only the owner's queued or active trips until their saved completion", () => {
  const trip = { slot: 2, startsAt: new Date(1000).toISOString(), completesAt: new Date(2000).toISOString() };
  for (const data of [{ deliveries: [trip] }, { interestVisits: [trip] }]) {
    const state = data as Ziggurat;
    expect(neighbourhoodTripActive(state, 1, 0)).toBe(false);
    expect(neighbourhoodTripActive(state, 2, 0)).toBe(true);
    expect(neighbourhoodTripActive(state, 2, 1500)).toBe(true);
    expect(neighbourhoodTripActive(state, 2, 2000)).toBe(false);
  }
});
