import { afterEach, expect, it, vi } from "vitest";
import { savedMapZoom, saveMapZoom } from "../../src/client/game/phaser/zoomPreference";

afterEach(() => vi.unstubAllGlobals());
const storage = () => {
  const values = new Map<string, string>();
  vi.stubGlobal("window", { localStorage: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  } });
  return values;
};
it("restores each map independently and remembers Fit across viewport sizes", () => {
  storage();
  expect(savedMapZoom("farm", 0.5, 0.72)).toBe(0.72);
  saveMapZoom("farm", 1.2);
  saveMapZoom("market", 0.8);
  expect(savedMapZoom("farm", 0.5, 0.72)).toBe(1.2);
  expect(savedMapZoom("market", 0.5, 0.72)).toBe(0.8);
  expect(savedMapZoom("neighbourhood", 0.2, 0.72)).toBe(0.72);
  saveMapZoom("farm", "fit");
  expect(savedMapZoom("farm", 0.7, 1)).toBe(0.7);
});
it("ignores invalid data and clamps saved zoom to the viewport limits", () => {
  const values = storage();
  values.set("sumer:map-zoom:farm", "NaN");
  expect(savedMapZoom("farm", 0.5, 0.72)).toBe(0.72);
  saveMapZoom("farm", 0.3);
  expect(savedMapZoom("farm", 0.5, 0.72)).toBe(0.5);
  saveMapZoom("farm", 99);
  expect(savedMapZoom("farm", 0.5, 0.72)).toBe(2);
});
it("keeps the game usable when browser storage is blocked", () => {
  vi.stubGlobal("window", { get localStorage() { throw new Error("blocked"); } });
  expect(() => saveMapZoom("farm", 1)).not.toThrow();
  expect(savedMapZoom("farm", 0.5, 0.72)).toBe(0.72);
});
