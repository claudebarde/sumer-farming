import { expect, it, vi } from "vitest";
import { syncHarvestingAudio } from "../../src/client/game/phaser/harvestingAudio";

it("starts on harvesting, loops without restarting each frame, and stops between fields", () => {
  const sound = { isPlaying: false, setVolume: vi.fn(),
    play: vi.fn(() => { sound.isPlaying = true; return true; }),
    stop: vi.fn(() => { sound.isPlaying = false; }) };
  syncHarvestingAudio(sound, false, true, 0.3);
  expect(sound.play).not.toHaveBeenCalled();
  syncHarvestingAudio(sound, true, true, 0.3);
  syncHarvestingAudio(sound, true, true, 0.5);
  expect(sound.play).toHaveBeenCalledOnce();
  expect(sound.setVolume).toHaveBeenLastCalledWith(0.5);
  syncHarvestingAudio(sound, false, true, 0.5);
  expect(sound.stop).toHaveBeenCalledOnce();
  syncHarvestingAudio(sound, true, true, 0.5);
  expect(sound.play).toHaveBeenCalledTimes(2);
  syncHarvestingAudio(sound, true, false, 0.5);
  expect(sound.isPlaying).toBe(false);
  syncHarvestingAudio(sound, false, true, 0.5);
  syncHarvestingAudio(sound, true, true, 0);
  expect(sound.play).toHaveBeenCalledTimes(2);
});
