import { describe, expect, it, vi } from "vitest";
import type Phaser from "phaser";
import { createShadowLayer } from "../../src/client/game/phaser/shadowLayer";
import { clipShadow, daylightShadow, shadowEllipse } from "../../src/client/game/phaser/daylightShadows";

vi.mock("phaser", () => ({ default: { Math: { Vector2: class { x = 0; y = 0; } } } }));
vi.mock("../../src/client/game/phaser/buildingShadows", () => ({
  createBuildingShadows: () => ({ add: vi.fn(), render: vi.fn(), destroy: vi.fn() }),
}));
const bounds = { minimumColumn: 0, maximumColumn: 5, minimumRow: 0, maximumRow: 5 };
const setup = () => {
  const graphics = Array.from({ length: 2 }, () => ({
    setDepth: vi.fn().mockReturnThis(), setVisible: vi.fn().mockReturnThis(),
    clear: vi.fn(), fillStyle: vi.fn().mockReturnThis(), fillPoints: vi.fn((points: { x: number; y: number }[], close: boolean) => [points.map(p => ({ ...p })), close]), destroy: vi.fn(),
  }));
  let index = 0;
  const layer = createShadowLayer({ add: { graphics: () => graphics[index++] } } as unknown as Phaser.Scene, bounds);
  return { layer, graphics };
};
describe("cached ground shadows", () => {
  it("retains stationary geometry and redraws only the moving anchor", () => {
    const { layer, graphics } = setup();
    const moving = { x: 0, y: 50, visible: true };
    layer.add(() => moving, 20, 40);
    layer.add(() => ({ x: 30, y: 60 }), 30, 50);
    layer.render("morning");
    for (let i = 0; i < 120; i++) layer.render("morning");
    expect(graphics[0]!.clear).toHaveBeenCalledTimes(1);
    expect(graphics[1]!.clear).toHaveBeenCalledTimes(1);
    moving.x += 1;
    layer.render("morning");
    expect(graphics[0]!.clear).toHaveBeenCalledTimes(2);
    expect(graphics[1]!.clear).toHaveBeenCalledTimes(1);
    moving.visible = false;
    layer.render("morning");
    expect(graphics[0]!.setVisible).toHaveBeenLastCalledWith(false);
    moving.x += 1;
    moving.visible = true;
    layer.render("evening");
    expect(graphics[0]!.clear).toHaveBeenCalledTimes(3);
    expect(graphics[1]!.clear).toHaveBeenCalledTimes(2);
    layer.destroy();
    for (const graphic of graphics) expect(graphic.destroy).toHaveBeenCalledOnce();
  });
  it("preserves the original feather, opacity and map-edge clipping", () => {
    const { layer, graphics } = setup();
    const anchor = { x: 0, y: 0 };
    layer.add(() => anchor, 30, 80);
    layer.render("morning");
    const oval = shadowEllipse(daylightShadow(9), 30, 80);
    for (const [index, scale] of [1, 0.96, 0.92].entries()) {
      const expected = clipShadow(Array.from({ length: 32 }, (_, i) => {
        const x = Math.cos(i * Math.PI / 16) * oval.width * scale / 2;
        const y = Math.sin(i * Math.PI / 16) * oval.height * scale / 2;
        return { x: oval.x + x * Math.cos(oval.rotation) - y * Math.sin(oval.rotation),
          y: oval.y + x * Math.sin(oval.rotation) + y * Math.cos(oval.rotation) };
      }), bounds);
      expect(graphics[0]!.fillPoints.mock.results[index]!.value).toEqual([expected, true]);
    }
    expect(graphics[0]!.fillStyle).toHaveBeenLastCalledWith(0x504739, oval.alpha / 3);
  });
  it("updates lighting after a minute or a clock jump without throttling movement", () => {
    const { layer, graphics } = setup();
    layer.add(() => ({ x: 0, y: 50 }), 20, 40);
    layer.render("local", new Date(2026, 0, 1, 9, 0, 0));
    layer.render("local", new Date(2026, 0, 1, 9, 0, 59));
    expect(graphics[0]!.clear).toHaveBeenCalledTimes(1);
    layer.render("local", new Date(2026, 0, 1, 9, 1, 0));
    layer.render("local", new Date(2026, 0, 1, 19, 0, 0));
    expect(graphics[0]!.clear).toHaveBeenCalledTimes(3);
  });
});
