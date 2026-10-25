import { expect, it, vi } from "vitest";
import { bubblingPause, createBubblingAudio } from "../../src/client/game/phaser/bubblingAudio";

const setup = () => {
  const sound = { isPlaying: false, setVolume: vi.fn(),
    play: vi.fn(() => { sound.isPlaying = true; return true; }),
    stop: vi.fn(() => { sound.isPlaying = false; }) };
  return { sound, sync: createBubblingAudio(sound, () => 0) };
};
it("waits after each full clip rather than looping or overlapping", () => {
  const { sound, sync } = setup();
  sync(true, true, 0.3, 0);
  sync(true, true, 0.3, 10000);
  expect(sound.play).toHaveBeenCalledOnce();
  sound.isPlaying = false;
  sync(true, true, 0.3, 11000);
  sync(true, true, 0.3, 15999);
  expect(sound.play).toHaveBeenCalledOnce();
  sync(true, true, 0.3, 16000);
  expect(sound.play).toHaveBeenCalledTimes(2);
  expect(bubblingPause(0)).toBe(5000);
  expect(bubblingPause(1)).toBe(12000);
});
it("stops on hide, mute or completion and never catches up missed clips", () => {
  const { sound, sync } = setup();
  sync(false, true, 0.3, 0);
  expect(sound.play).not.toHaveBeenCalled();
  sync(true, true, 0.3, 1);
  sync(true, false, 0.3, 2);
  expect(sound.isPlaying).toBe(false);
  sync(false, true, 0.3, 100000);
  expect(sound.play).toHaveBeenCalledOnce();
  sync(true, true, 0.3, 100001);
  expect(sound.play).toHaveBeenCalledTimes(2);
  sync(true, true, 0, 100002);
  expect(sound.isPlaying).toBe(false);
});
