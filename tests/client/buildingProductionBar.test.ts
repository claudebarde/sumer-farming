import type Phaser from "phaser";
import { describe, expect, it, vi } from "vitest";
import { createBuildingProductionBar } from "../../src/client/game/phaser/buildingProductionBar";

describe("canvas building production bars", () => {
  it("renders below the actor layer and updates without a full-bar flash", () => {
    const graphic = {
      setDepth: vi.fn().mockReturnThis(), clear: vi.fn().mockReturnThis(),
      setVisible: vi.fn().mockReturnThis(), fillStyle: vi.fn().mockReturnThis(),
      fillRoundedRect: vi.fn().mockReturnThis()
    };
    const scene = { add: { graphics: vi.fn().mockReturnValue(graphic) } } as unknown as Phaser.Scene;
    const bar = createBuildingProductionBar(scene, 100, 200, 120, 4);
    expect(graphic.setDepth).toHaveBeenCalledWith(3.75);
    expect(bar.graphic).toBe(graphic);
    bar.update(0);
    expect(graphic.fillRoundedRect).toHaveBeenCalledTimes(3);
    bar.update(0.5);
    expect(graphic.fillRoundedRect).toHaveBeenLastCalledWith(-57, -2, 57, 4, 2);
    bar.update(null);
    expect(graphic.setVisible).toHaveBeenLastCalledWith(false);
  });
});
