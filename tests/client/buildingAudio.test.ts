import { expect, it, vi } from "vitest";
import { buildingAudioActive, type BuildingAudioKey } from "../../src/client/game/phaser/buildingAudio";
import { emptyProductionState } from "../../src/game-data/production";
import { MillingJobSchema } from "../../src/game-data/milling";
import { syncActionLoopAudio } from "../../src/client/game/phaser/actionLoopAudio";

const iso = (time: number) => new Date(time).toISOString();
it.each(["construction", "upgrade"])("construction audio follows saved %s boundaries, including reload and offline completion", kind => {
  const job = { startedAt: iso(1000), completesAt: iso(10000) };
  const production = { ...emptyProductionState(), buildingUpgrades: kind === "upgrade"
    ? { oven: [{ ...job, level: 2, idempotencyKey: "upgrade" }] } : {} };
  const state = { milling: null, production };
  const buildings = kind === "construction" ? [job] : [];
  for (const [now, active] of [[999, false], [1000, true], [5000, true], [9999, true], [10000, false], [86400000, false]] as const) {
    expect(buildingAudioActive(state, "construction", now, buildings)).toBe(active);
  }
  expect(buildingAudioActive({ milling: null, production: emptyProductionState() }, "construction", 5000)).toBe(false);
});
const farm = {
  milling: MillingJobSchema.parse({ buildingId: "00000000-0000-4000-8000-000000000001", recipe: "flour", worker: "donkey",
    startedAt: iso(1000), completesAt: iso(10000), barley: 6, output: 3 }),
  production: { ...emptyProductionState(),
    baking: { oven: { startedAt: iso(2000), completesAt: iso(12000), output: 2 } },
    brewing: { brewery: { preparation: { departedAt: 0, stepDurationMs: 200, path: [{ column: 1, row: 5 }], supplyIndex: 0 },
      arrivedAt: iso(3000), startedAt: iso(11000), completesAt: iso(20000) } }
  }
};
it.each<[BuildingAudioKey, number, number]>([["grinding", 1000, 10000], ["baking", 2000, 12000], ["stirring", 3000, 11000], ["bubbling", 11000, 20000]])(
  "%s follows saved work boundaries and stays off after offline completion", (key, start, end) => {
    expect(buildingAudioActive(farm, key, start - 1)).toBe(false);
    expect(buildingAudioActive(farm, key, start)).toBe(true);
    expect(buildingAudioActive(farm, key, end - 1)).toBe(true);
    expect(buildingAudioActive(farm, key, end)).toBe(false);
    expect(buildingAudioActive(farm, key, 86400000)).toBe(false);
    expect(buildingAudioActive({ milling: null, production: emptyProductionState() }, key, start)).toBe(false);
  });
it("plays grinding for the farmer too, and stirring stops during fermentation", () => {
  expect(buildingAudioActive({ ...farm, milling: { ...farm.milling, worker: "farmer" } }, "grinding", 5000)).toBe(true);
  expect(buildingAudioActive(farm, "stirring", 15000)).toBe(false);
});
it("keeps one loop alive across refreshes, stops while hidden and does not replay finished work on return", () => {
  const sound = { isPlaying: false, setVolume: vi.fn(),
    play: vi.fn(() => { sound.isPlaying = true; return true; }),
    stop: vi.fn(() => { sound.isPlaying = false; }) };
  for (const now of [1000, 1100, 2000]) syncActionLoopAudio(sound, buildingAudioActive(farm, "grinding", now), true, 0.3);
  expect(sound.play).toHaveBeenCalledOnce();
  expect(sound.setVolume).toHaveBeenLastCalledWith(0.3);
  syncActionLoopAudio(sound, true, false, 0.3);
  expect(sound.isPlaying).toBe(false);
  syncActionLoopAudio(sound, buildingAudioActive(farm, "grinding", 15000), true, 0.3);
  expect(sound.play).toHaveBeenCalledOnce();
});
