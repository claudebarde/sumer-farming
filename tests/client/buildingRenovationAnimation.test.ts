import { expect, it, vi } from "vitest";
import type Phaser from "phaser";
const builder = vi.hoisted(() => ({ render: vi.fn(), destroy: vi.fn() }));
vi.mock("../../src/client/game/phaser/renovationBuilder", () => ({ createRenovationBuilder: () => builder }));
vi.mock("../../src/client/game/phaser/buildingProgressBar", () => ({ drawBuildingProgress: vi.fn() }));
import { drawBuildingProgress } from "../../src/client/game/phaser/buildingProgressBar";
import { createBuildingRenovationAnimation } from "../../src/client/game/phaser/buildingRenovationAnimation";
const visual = (visible = true) => ({ visible,
  setVisible(value: boolean) { this.visible = value; return this; },
  ...Object.fromEntries(["setOrigin", "setDisplaySize", "setDepth", "clear", "destroy"].map(key => [key, vi.fn().mockReturnThis()]))
});
it.each(["mill", "breadOven", "brewery", "future building"])("replaces %s visuals and restores their visibility on completion", () => {
  const base = visual(), prop = visual(), worker = visual(false), output = visual();
  const site = visual(), progress = visual();
  const scene = { add: { image: () => site, graphics: () => progress } } as unknown as Phaser.Scene;
  const animation = createBuildingRenovationAnimation(scene, { x: 100, y: 200 },
    [base, prop, worker] as unknown as Phaser.GameObjects.Image[]);
  animation.render({ fraction: 0.4 }, 1000, false);
  expect([base.visible, prop.visible, worker.visible, site.visible, output.visible]).toEqual([false, false, false, true, true]);
  expect(drawBuildingProgress).toHaveBeenLastCalledWith(progress, site, 0.4);
  expect(builder.render).toHaveBeenLastCalledWith(true, 1000, false);
  animation.restore();
  animation.render({ fraction: 0.8 }, 2000, true);
  expect(builder.render).toHaveBeenLastCalledWith(true, 2000, true);
  animation.restore();
  animation.render(null, 3000, false);
  expect([base.visible, prop.visible, worker.visible, site.visible]).toEqual([true, true, false, false]);
  animation.destroy();
  expect(site.destroy).toHaveBeenCalledOnce();
  expect(progress.destroy).toHaveBeenCalledOnce();
});
