import type Phaser from "phaser";
import { describe, expect, it, vi } from "vitest";
vi.mock("phaser", () => ({ default: {} }));
import { adjacentGrazingTiles, createDonkey } from "../../src/client/game/phaser/donkey";
import { millRecipe, MillingJobSchema } from "../../src/game-data/milling";
import { farmerProductionJob } from "../../src/game-core/farm/farmerProduction";
import { marketIncludesItem } from "../../src/client/stores/marketUiStore";
import { marketUnlockLevel } from "../../src/game-data/progression";

describe("donkey presentation and rules", () => {
  it("offers the donkey only in the NPC bread buy tab from level seven", () => {
    expect(marketUnlockLevel("donkey")).toBe(7);
    for (const scope of ["bread", "beer", "barley"] as const) {
      for (const market of ["npc", "player"] as const) {
        for (const action of ["buy", "sell"] as const) {
          expect(marketIncludesItem(scope, "donkey", { market, action })).toBe(scope === "bread" && market === "npc" && action === "buy");
        }
      }
    }
  });
  it.each(["flour", "brewersGroats"] as const)("triples the %s batch without changing yield or throughput", recipe => {
    expect(millRecipe(recipe)).toMatchObject({ barley: 2, output: 1, durationMs: 300000 });
    expect(millRecipe(recipe, "donkey")).toMatchObject({ barley: 6, output: 3, durationMs: 900000 });
  });
  it("keeps legacy jobs farmer-operated but permits independent donkey work", () => {
    const job = MillingJobSchema.parse({ buildingId: "00000000-0000-4000-8000-000000000001", recipe: "flour", barley: 2, output: 1,
      startedAt: "2026-10-01T00:00:00Z", completesAt: "2026-10-01T00:05:00Z" });
    expect(farmerProductionJob({ milling: job })?.type).toBe("milling");
    expect(farmerProductionJob({ milling: { ...job, worker: "donkey" } })).toBeNull();
  });
  it("grazes one orthogonal free tile at a time, never diagonally or across gaps", () => {
    const position = { column: 1, row: 1 };
    const available = [{ column: 2, row: 1 }, { column: 2, row: 2 }, { column: 1, row: 3 }, position];
    expect(adjacentGrazingTiles(position, available)).toEqual([{ column: 2, row: 1 }]);
    expect(adjacentGrazingTiles(position, [])).toEqual([]);
  });
  it("faces travel direction, finishes at the target and cancels animation on cleanup", () => {
    const image = { x: 100, y: 100, setOrigin: vi.fn().mockReturnThis(), setDisplaySize: vi.fn().mockReturnThis(),
      setVisible: vi.fn().mockReturnThis(), setFlipX: vi.fn().mockReturnThis(), setAngle: vi.fn().mockReturnThis(), destroy: vi.fn() };
    const stop = vi.fn();
    const add = vi.fn().mockReturnValue({ stop });
    const scene = { add: { image: vi.fn().mockReturnValue(image) }, tweens: { add }, time: { now: 100 } } as unknown as Phaser.Scene;
    const donkey = createDonkey(scene);
    expect(image.setVisible).toHaveBeenCalledWith(false);
    const arrived = vi.fn();
    donkey.move({ x: 36, y: 100 }, 900, arrived);
    expect(image.setFlipX).toHaveBeenLastCalledWith(true);
    expect(add.mock.calls[0]![0]).toMatchObject({ targets: image, x: 36, y: 100, duration: 900, ease: "Linear" });
    expect(donkey.isMoving()).toBe(true);
    add.mock.calls[0]![0].onComplete();
    expect(arrived).toHaveBeenCalledOnce();
    expect(donkey.isMoving()).toBe(false);
    donkey.move({ x: 164, y: 100 }, 180);
    expect(image.setFlipX).toHaveBeenLastCalledWith(false);
    donkey.destroy();
    expect(stop).toHaveBeenCalledOnce();
    expect(image.destroy).toHaveBeenCalledOnce();
  });
});
