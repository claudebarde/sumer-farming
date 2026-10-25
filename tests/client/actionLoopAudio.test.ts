import { expect, it, vi } from "vitest";
import { syncActionLoopAudio } from "../../src/client/game/phaser/actionLoopAudio";

it("starts footsteps once per walk and stops for rest, work, hidden tabs or muted audio", () => {
  const sound = { isPlaying: false, setVolume: vi.fn(),
    play: vi.fn(() => { sound.isPlaying = true; return true; }),
    stop: vi.fn(() => { sound.isPlaying = false; }) };
  syncActionLoopAudio(sound, false, true, 0.3);
  expect(sound.play).not.toHaveBeenCalled();
  for (let frame = 0; frame < 60; frame++) syncActionLoopAudio(sound, true, true, 0.3);
  expect(sound.play).toHaveBeenCalledOnce();
  syncActionLoopAudio(sound, false, true, 0.3);
  expect(sound.stop).toHaveBeenCalledOnce();
  syncActionLoopAudio(sound, true, true, 0.3);
  expect(sound.play).toHaveBeenCalledTimes(2);
  syncActionLoopAudio(sound, true, false, 0.3);
  expect(sound.isPlaying).toBe(false);
  syncActionLoopAudio(sound, true, true, 0);
  expect(sound.isPlaying).toBe(false);
  syncActionLoopAudio(sound, false, true, 0.3);
  expect(sound.play).toHaveBeenCalledTimes(2);
});
