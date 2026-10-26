import { expect, it, vi } from "vitest";
import { createBuildingAudioSequence } from "../../src/client/game/phaser/buildingAudioSequence";
import type { BuildingAudioKey } from "../../src/client/game/phaser/buildingAudio";

const fixture = () => {
  const entries = (["grinding", "baking", "stirring", "bubbling", "construction"] as const).map(key => {
    const sound = { isPlaying: false, loop: false, volume: 0,
      play: vi.fn(() => { sound.isPlaying = true; return true; }),
      stop: vi.fn(() => { sound.isPlaying = false; }),
      setVolume: (value: number) => { sound.volume = value; },
      setLoop: (value: boolean) => { sound.loop = value; } };
    return { key, sound };
  });
  const sync = createBuildingAudioSequence(entries, () => 0);
  const update = (keys: BuildingAudioKey[], now: number, allowed = true, volume = 0.4) => {
    sync(keys, allowed, volume, now);
    expect(entries.filter(entry => entry.sound.isPlaying).length).toBeLessThanOrEqual(1);
  };
  return { entries, update, playing: () => entries.find(entry => entry.sound.isPlaying)?.key };
};

it("rotates construction with production, stops when hidden, and loops alone", () => {
  const f = fixture();
  f.update(["baking", "construction"], 0);
  expect(f.playing()).toBe("baking");
  f.update(["baking", "construction"], 5000);
  f.update(["baking", "construction"], 6000);
  expect(f.playing()).toBe("construction");
  f.update(["construction"], 6500, false);
  expect(f.playing()).toBeUndefined();
  f.update(["construction"], 7000);
  expect(f.playing()).toBe("construction");
  expect(f.entries[4]!.sound.loop).toBe(true);
  f.update([], 8000);
  expect(f.playing()).toBeUndefined();
});

it("rotates without overlap with fades, short gaps and a longer pause after the round", () => {
  const f = fixture(); const active: BuildingAudioKey[] = ["baking", "bubbling"];
  f.update(active, 0); expect(f.playing()).toBe("baking");
  expect(f.entries[1]!.sound.volume).toBe(0);
  f.update(active, 700); expect(f.entries[1]!.sound.volume).toBe(0.4);
  f.update(active, 4650); expect(f.entries[1]!.sound.volume).toBeCloseTo(0.2);
  f.update(active, 5000); expect(f.playing()).toBeUndefined();
  f.update(active, 5999); expect(f.playing()).toBeUndefined();
  f.update(active, 6000); expect(f.playing()).toBe("bubbling");
  f.update(active, 11000); expect(f.playing()).toBeUndefined();
  f.update(active, 13999); expect(f.playing()).toBeUndefined();
  f.update(active, 14000); expect(f.playing()).toBe("baking");
});

it("removes completed phases, includes new work and restores single-building playback", () => {
  const f = fixture();
  f.update(["stirring", "baking"], 0);
  f.update(["stirring", "baking"], 5000);
  f.update(["stirring", "baking"], 6000); expect(f.playing()).toBe("stirring");
  f.update(["bubbling", "baking"], 6500); expect(f.playing()).toBeUndefined();
  f.update(["bubbling", "baking"], 7500); expect(f.playing()).toBe("bubbling");
  f.update(["bubbling"], 8000); expect(f.playing()).toBe("bubbling");
  expect(f.entries[3]!.sound.loop).toBe(false);
  f.entries[3]!.sound.isPlaying = false;
  f.update(["bubbling"], 8500); expect(f.playing()).toBeUndefined();
  f.update(["bubbling"], 13500); expect(f.playing()).toBe("bubbling");
});

it("stops when hidden, muted or outside the farm and restarts without catch-up", () => {
  const f = fixture(); const active: BuildingAudioKey[] = ["grinding", "baking"];
  f.update(active, 0); f.update(active, 700);
  f.update(active, 800, false); expect(f.playing()).toBeUndefined();
  f.update(active, 90000); expect(f.playing()).toBe("grinding");
  expect(f.entries[0]!.sound.volume).toBe(0);
  f.update(active, 90700, true, 0.2); expect(f.entries[0]!.sound.volume).toBe(0.2);
  f.update(active, 90800, true, 0); expect(f.playing()).toBeUndefined();
  f.update(active, 91000); f.update([], 92000); expect(f.playing()).toBeUndefined();
});

it("does not restart a lone loop each frame", () => {
  const f = fixture();
  for (const now of [0, 100, 1000, 10000]) f.update(["baking"], now);
  expect(f.entries[1]!.sound.play).toHaveBeenCalledOnce();
  expect(f.entries[1]!.sound.loop).toBe(true);
});
