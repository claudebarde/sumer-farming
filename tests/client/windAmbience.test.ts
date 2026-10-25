import { afterEach, expect, it, vi } from "vitest";
import { createWindAmbience, windGustDelay } from "../../src/client/game/phaser/windAmbience";

afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });
const fixture = () => {
  vi.useFakeTimers();
  const state = { allowed: true, volume: 0.3 };
  const sound = { isPlaying: false, play: vi.fn(() => { sound.isPlaying = true; return true; }),
    stop: vi.fn(() => { sound.isPlaying = false; }), setVolume: vi.fn() };
  const ambience = createWindAmbience(sound, () => state, () => 0.5);
  return { state, sound, ambience };
};

it("randomizes pauses between 20 and 60 seconds", () => {
  expect([0, 0.5, 1].map(windGustDelay)).toEqual([20000, 40000, 60000]);
});
it("plays over existing audio at a lower volume, without overlapping or duplicate timers", () => {
  const { sound, ambience } = fixture();
  ambience.sync(); ambience.sync();
  vi.advanceTimersByTime(39999);
  expect(sound.play).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1);
  expect(sound.play).toHaveBeenCalledOnce();
  expect(sound.setVolume).toHaveBeenLastCalledWith(0.18);
  ambience.sync(); vi.advanceTimersByTime(120000);
  expect(sound.play).toHaveBeenCalledOnce();
  sound.isPlaying = false; ambience.sync(); // Sound COMPLETE event.
  vi.advanceTimersByTime(40000);
  expect(sound.play).toHaveBeenCalledTimes(2);
  ambience.dispose();
});
it("stops on hide, lock or Stop and starts a fresh wait on return, without catch-up", () => {
  const { state, sound, ambience } = fixture();
  ambience.sync(); vi.advanceTimersByTime(40000);
  state.allowed = false; ambience.sync();
  expect(sound.isPlaying).toBe(false);
  vi.advanceTimersByTime(600000);
  expect(sound.play).toHaveBeenCalledOnce();
  state.allowed = true; ambience.sync(); vi.advanceTimersByTime(39999);
  expect(sound.play).toHaveBeenCalledOnce();
  vi.advanceTimersByTime(1);
  expect(sound.play).toHaveBeenCalledTimes(2);
  ambience.dispose();
});
it("rechecks permission at playback, respects mute and cleans up pending callbacks", () => {
  const { state, sound, ambience } = fixture();
  ambience.sync(); state.allowed = false;
  vi.advanceTimersByTime(40000);
  expect(sound.play).not.toHaveBeenCalled();
  state.allowed = true; state.volume = 0; ambience.sync();
  expect(vi.getTimerCount()).toBe(0);
  state.volume = 0.5; ambience.sync();
  expect(sound.setVolume).toHaveBeenLastCalledWith(0.3);
  ambience.dispose(); ambience.sync(); vi.advanceTimersByTime(120000);
  expect(sound.play).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});
