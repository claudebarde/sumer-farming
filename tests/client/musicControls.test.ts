import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import MusicControls from "../../src/client/components/MusicControls";
import { adjustedMusicVolume } from "../../src/client/stores/musicSettingsStore";
import { backgroundMusicAction } from "../../src/client/game/phaser/backgroundMusic";

it("shows the Music Control heading and quieter, stop, louder buttons in order", () => {
  const html = renderToStaticMarkup(createElement(MusicControls));
  expect(html).toContain("Music Control");
  expect(html.indexOf('aria-label="Lower music volume"')).toBeLessThan(html.indexOf('aria-label="Stop music"'));
  expect(html.indexOf('aria-label="Stop music"')).toBeLessThan(html.indexOf('aria-label="Increase music volume"'));
  expect(html).toContain("30");
});
it("changes volume in precise ten-percent steps, clamped to safe limits", () => {
  expect(adjustedMusicVolume(0.3, -1)).toBe(0.2);
  expect(adjustedMusicVolume(0.3, 1)).toBe(0.4);
  expect(adjustedMusicVolume(0, -1)).toBe(0);
  expect(adjustedMusicVolume(1, 1)).toBe(1);
});
it("honours deliberate stopping across tab changes, delayed unlock and reload", () => {
  expect(backgroundMusicAction(false, false, true, false, false)).toBe("stop");
  expect(backgroundMusicAction(true, false, false, true, false)).toBe("stop");
  expect(backgroundMusicAction(false, false, false, false, false)).toBe("wait");
  expect(backgroundMusicAction(false, false, false, false, true)).toBe("play");
});
