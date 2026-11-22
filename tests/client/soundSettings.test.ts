import { expect, it, vi } from "vitest";
import { syncSoundVolume, syncSoundLoop } from "../../src/client/game/phaser/soundSettings";
import { syncActionLoopAudio } from "../../src/client/game/phaser/actionLoopAudio";

it("skips identical frame updates while responding immediately to settings and playback changes", () => {
  const sound = { volume: 0, isPlaying: false,
    setVolume: vi.fn((value: number) => { sound.volume = value; }),
    play: vi.fn(() => { sound.isPlaying = true; return true; }),
    stop: vi.fn(() => { sound.isPlaying = false; }) };
  for (let i = 0; i < 600; i++) syncActionLoopAudio(sound, true, true, 0.4);
  expect(sound.setVolume).toHaveBeenCalledOnce();
  expect(sound.play).toHaveBeenCalledOnce();
  syncActionLoopAudio(sound, true, true, 0.2);
  expect(sound.volume).toBe(0.2);
  for (let i = 0; i < 60; i++) syncActionLoopAudio(sound, true, false, 0.2);
  expect(sound.stop).toHaveBeenCalledOnce();
  syncActionLoopAudio(sound, true, true, 0.2);
  expect(sound.play).toHaveBeenCalledTimes(2);
  // A stopped backend can recover even if requested activity hasn't changed.
  sound.isPlaying = false;
  syncActionLoopAudio(sound, true, true, 0.2);
  expect(sound.play).toHaveBeenCalledTimes(3);
});

it("preserves fades and observes external changes rather than trusting stale cached settings", () => {
  const sound = { volume: 0, loop: false,
    setVolume: vi.fn((v: number) => { sound.volume = v; }),
    setLoop: vi.fn((v: boolean) => { sound.loop = v; }) };
  for (const v of [0, 0.1, 0.2, 0.3, 0.3, 0.3]) syncSoundVolume(sound, v);
  expect(sound.setVolume).toHaveBeenCalledTimes(3);
  sound.volume = 0;
  syncSoundVolume(sound, 0.3);
  expect(sound.volume).toBe(0.3);
  for (let i = 0; i < 60; i++) syncSoundLoop(sound, true);
  expect(sound.setLoop).toHaveBeenCalledOnce();
  syncSoundLoop(sound, false);
  expect(sound.loop).toBe(false);
});

it("keeps adapter caches independent for recreated sound instances", () => {
  const first = { setVolume: vi.fn() }, replacement = { setVolume: vi.fn() };
  for (let i = 0; i < 60; i++) syncSoundVolume(first, 0.4);
  syncSoundVolume(replacement, 0.4);
  expect(first.setVolume).toHaveBeenCalledOnce();
  expect(replacement.setVolume).toHaveBeenCalledOnce();
});
