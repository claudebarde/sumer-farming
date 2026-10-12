import { afterEach, expect, it, vi } from "vitest";
vi.mock("phaser", () => ({ default: { Scene: class {} } }));
import { IsometricFarmScene } from "../../src/client/game/phaser/scenes/IsometricFarmScene";
import { PROCESSION_DURATION_MS } from "../../src/client/game/phaser/lyreProcession";

const image = () => ({
  depth: 0,
  setTexture() { return this; }, setDisplaySize() { return this; },
  setPosition() { return this; }, setVisible() { return this; },
  setDepth(depth: number) { this.depth = depth; return this; },
});
afterEach(() => vi.restoreAllMocks());
it("keeps all musicians in front of buildings throughout travel and after rebuilding the display", () => {
  const scene = Object.create(IsometricFarmScene.prototype) as {
    processionStartedAt: number; musicians: ReturnType<typeof image>[];
    buildingImages: { depth: number }[]; renderProcession(): void;
  };
  scene.processionStartedAt = 1000;
  scene.musicians = Array.from({ length: 5 }, image);
  scene.buildingImages = [{ depth: 144 }, { depth: 240 }, { depth: 360 }];
  const clock = vi.spyOn(Date, "now");
  for (let elapsed = 0; elapsed < PROCESSION_DURATION_MS; elapsed += 180) {
    clock.mockReturnValue(1000 + elapsed);
    scene.renderProcession();
    expect(scene.musicians.every(sprite => sprite.depth > 360)).toBe(true);
  }
  scene.buildingImages = [{ depth: 600 }];
  scene.musicians = Array.from({ length: 5 }, image);
  scene.renderProcession();
  expect(scene.musicians.every(sprite => sprite.depth > 600)).toBe(true);
});
