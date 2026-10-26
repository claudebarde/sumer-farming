import { describe, expect, it, vi } from "vitest";
import { createDonkeyBrayAudio, donkeyPickupCue } from "../../src/client/game/phaser/donkeyBrayAudio";
import type { MillingJob } from "../../src/game-data/milling";

const job: MillingJob = {
  worker: "donkey", buildingId: "mill", recipe: "flour", barley: 6, output: 3,
  startedAt: new Date(6000).toISOString(), completesAt: new Date(906000).toISOString(),
  preparation: { departedAt: 100, stepDurationMs: 1000, supplyIndex: 2, donkeyPickupIndex: 1,
    donkeyDropIndex: 2, path: [{ column: 0, row: 0 }, { column: 1, row: 0 }, { column: 2, row: 0 }] },
};
const setup = () => {
  const sound = { isPlaying: false, play: vi.fn(() => true), stop: vi.fn(), setVolume: vi.fn() };
  return { sound, sync: createDonkeyBrayAudio(sound) };
};

describe("donkey pickup bray", () => {
  it("uses the saved pickup time only for donkey milling", () => {
    expect(donkeyPickupCue(job)?.at).toBe(1100);
    expect(donkeyPickupCue({ ...job, worker: "farmer" })).toBeNull();
    expect(donkeyPickupCue({ ...job, preparation: undefined })).toBeNull();
    expect(donkeyPickupCue(null)).toBeNull();
  });
  it("plays once at pickup, sets volume first, and allows a later job", () => {
    const { sound, sync } = setup();
    sync(donkeyPickupCue(job), 1000, true, 0.4);
    expect(sound.play).not.toHaveBeenCalled();
    sync(donkeyPickupCue(job), 1100, true, 0.4);
    sync(donkeyPickupCue({ ...job }), 1200, true, 0.4);
    expect(sound.play).toHaveBeenCalledTimes(1);
    expect(sound.setVolume.mock.invocationCallOrder[0]).toBeLessThan(sound.play.mock.invocationCallOrder[0]);
    sync({ id: "next-job", at: 2000 }, 2000, true, 0.4);
    expect(sound.play).toHaveBeenCalledTimes(2);
  });
  it("does not replay after a reload or a suspended frame", () => {
    const { sound, sync } = setup();
    sync(donkeyPickupCue(job), 1150, true, 0.4);
    sync(donkeyPickupCue(job), 1200, true, 0.4);
    sync({ id: "next", at: 2000 }, 9000, true, 0.4);
    expect(sound.play).not.toHaveBeenCalled();
  });
  it.each([[false, 0.4], [true, 0]] as const)("does not defer a suppressed bray (%s, %s)", (allowed, volume) => {
    const { sound, sync } = setup();
    sync(donkeyPickupCue(job), 1000, true, 0.4);
    sync(donkeyPickupCue(job), 1100, allowed, volume);
    sync(donkeyPickupCue(job), 1150, true, 0.4);
    expect(sound.play).not.toHaveBeenCalled();
  });
  it("stops when hidden or muted and does not replay on return", () => {
    const { sound, sync } = setup();
    sync(donkeyPickupCue(job), 1000, true, 0.4);
    sync(donkeyPickupCue(job), 1100, true, 0.4);
    sound.isPlaying = true;
    sync(null, 1150, false, 0.4);
    expect(sound.stop).toHaveBeenCalledOnce();
    sync(donkeyPickupCue(job), 1200, true, 0.4);
    expect(sound.play).toHaveBeenCalledOnce();
  });
});
