import { expect, it, vi } from "vitest";
import { createRequire } from "node:module";
import { backgroundMusicAction, backgroundMusicFade, tryMusicAutoplay } from "../../src/client/game/phaser/backgroundMusic";

// Use the installed Phaser tween builder without booting its DOM renderer.
const getValueOp = createRequire(import.meta.url)("../../node_modules/phaser/src/tweens/builders/GetValueOp.js");
it.each([0, 0.1, 0.3, 1])("starts the fade at silence even if the audio gain still reports full volume (target %s)", volume => {
  const target = { volume: 1 };
  // Reproduce the old numeric tween picking up a stale/full-volume reading.
  expect(getValueOp("volume", volume).getStart(target, "volume", target.volume)).toBe(1);
  const fade = backgroundMusicFade(volume);
  const ops = getValueOp("volume", fade.volume);
  const start = ops.getStart(target, "volume", target.volume);
  const end = ops.getEnd(target, "volume", target.volume);
  expect(start).toBe(0);
  expect(end).toBe(volume);
  for (const fraction of [0, 0.01, 0.5, 1]) {
    const gain = start + (end - start) * fraction;
    expect(gain).toBeGreaterThanOrEqual(0);
    expect(gain).toBeLessThanOrEqual(volume);
  }
});

it("attempts autoplay even before a gesture and reconciles after permission succeeds", async () => {
  const ready = vi.fn();
  const resume = vi.fn().mockResolvedValue(undefined);
  tryMusicAutoplay({ state: "suspended", resume }, false, ready);
  expect(resume).toHaveBeenCalledOnce();
  await Promise.resolve();
  expect(ready).toHaveBeenCalledOnce();
});
it("silently retains the fallback after denied autoplay and skips hidden tabs", async () => {
  const ready = vi.fn();
  const resume = vi.fn().mockRejectedValue(new Error("NotAllowedError"));
  tryMusicAutoplay({ state: "suspended", resume }, true, ready);
  expect(resume).not.toHaveBeenCalled();
  tryMusicAutoplay({ state: "suspended", resume }, false, ready);
  await Promise.resolve();
  expect(ready).not.toHaveBeenCalled();
  resume.mockResolvedValue(undefined);
  tryMusicAutoplay({ state: "suspended", resume }, false, ready);
  await Promise.resolve();
  expect(ready).toHaveBeenCalledOnce();
});

it("waits for audio unlock and never starts a late-loaded track in a hidden tab", () => {
  expect(backgroundMusicAction(false, true, false, false)).toBe("wait");
  expect(backgroundMusicAction(true, false, false, false)).toBe("wait");
  expect(backgroundMusicAction(false, false, false, false)).toBe("play");
});
it("pauses on hide and resumes rather than restarting on return", () => {
  expect(backgroundMusicAction(true, false, true, false)).toBe("pause");
  expect(backgroundMusicAction(true, false, false, true)).toBe("wait");
  expect(backgroundMusicAction(false, false, false, true)).toBe("resume");
});
it("does not restart music for subsequent clicks or scene changes", () => {
  expect(backgroundMusicAction(false, false, true, false)).toBe("wait");
});
