import { expect, it, vi } from "vitest";
import { neighbourhoodAudio } from "../../src/client/game/phaser/neighbourhoodAudio";
import { deliveryPlan, interestPlan } from "../../src/game-data/zigguratDelivery";
import { createDonkeyBrayAudio } from "../../src/client/game/phaser/donkeyBrayAudio";
const start = 10000, offset = 2000, plan = deliveryPlan(1);
const data = { deliveries: [{ id: "delivery", slot: 1, startsAt: new Date(start).toISOString(), completesAt: new Date(start + plan.duration).toISOString() }] };
it("follows travel, loading, unloading and completion with server clock correction", () => {
  expect(neighbourhoodAudio(data, start - offset + 100, offset).walking).toBe(true);
  let elapsed = 0;
  for (const leg of plan.legs) {
    expect(neighbourhoodAudio(data, start - offset + elapsed + leg.duration / 2, offset).walking)
      .toBe(leg.phase !== "load" && leg.phase !== "unload");
    elapsed += leg.duration;
  }
  expect(neighbourhoodAudio(data, start - offset + plan.duration, offset)).toEqual({ walking: false, pickup: null });
});
it("brays once at the fetch boundary and never replays an already elapsed pickup", () => {
  const sound = { isPlaying: false, play: vi.fn(() => true), stop: vi.fn(), setVolume: vi.fn() };
  const sync = createDonkeyBrayAudio(sound);
  const at = start + plan.legs[0]!.duration - offset;
  for (const now of [at - 100, at, at + 100]) sync(neighbourhoodAudio(data, now, offset).pickup, now, true, .4);
  expect(sound.play).toHaveBeenCalledOnce();
  createDonkeyBrayAudio(sound)(neighbourhoodAudio(data, at + 200, offset).pickup, at + 200, true, .4);
  expect(sound.play).toHaveBeenCalledOnce();
});
it("plays footsteps for interest visits but stops during the tablet pause", () => {
  const visit = interestPlan(2);
  const interest = { deliveries: [], interestVisits: [{ slot: 2, startsAt: new Date(start).toISOString(), completesAt: new Date(start + visit.duration).toISOString() }] };
  expect(neighbourhoodAudio(interest, start + 100, 0).walking).toBe(true);
  expect(neighbourhoodAudio(interest, start + visit.travelMs + 100, 0)).toEqual({ walking: false, pickup: null });
  expect(neighbourhoodAudio(interest, start + visit.travelMs + 3100, 0).walking).toBe(true);
});
