import { expect, it, vi } from "vitest";
import { backgroundMusicAction, tryMusicAutoplay } from "../../src/client/game/phaser/backgroundMusic";

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
