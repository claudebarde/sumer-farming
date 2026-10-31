import { expect, it } from "vitest";
import { recentHarvestGains, harvestGainPresentation, sesameHarvestGains } from "../../src/client/game/phaser/harvestGainEffect";
import type { CropWork } from "../../src/game-data/cropWork";

const gain = { cell: { column: 3, row: 6 }, at: 10000, quantity: 2 };
it("shows new gains once and ignores startup, offline catch-up and zero yields", () => {
  expect(recentHarvestGains([gain], 9990, 10010)).toEqual([gain]);
  expect(recentHarvestGains([gain], 10010, 10020)).toEqual([]);
  expect(recentHarvestGains([gain], null, 10010)).toEqual([]);
  expect(recentHarvestGains([gain], 9000, 10010)).toEqual([]);
  expect(recentHarvestGains([{ ...gain, quantity: 0 }], 9990, 10010)).toEqual([]);
});
it("rises vertically for 1.5 seconds, fading at the end; reduced motion only fades", () => {
  expect(harvestGainPresentation(0, false)).toEqual({ offsetY: -12, alpha: 1 });
  expect(harvestGainPresentation(750, false)).toEqual({ offsetY: -70, alpha: 1 });
  expect(harvestGainPresentation(1500, false)).toEqual({ offsetY: -128, alpha: 0 });
  expect(harvestGainPresentation(0, true).offsetY).toBe(harvestGainPresentation(1000, true).offsetY);
});

it("preserves a full visible rise across a slow redraw and a delivery snapshot", async () => {
  const { vi } = await import("vitest");
  const harvest = await import("../../src/client/game/phaser/isometricHarvesting");
  const { HarvestGainEffect } = await import("../../src/client/game/phaser/harvestGainEffect");
  const { isoPoint } = await import("../../src/client/game/phaser/isometricProjection");
  const pose = vi.spyOn(harvest, "isometricHarvestPose").mockReturnValue({ type: "done", position: gain.cell,
    seeds: 2, elapsed: 0, distance: 0, facingLeft: false, harvested: [gain.cell], gains: [gain] });
  const sprites: { scene: object | undefined; y: number; alpha: number; destroy(): void }[] = [];
  const displayed = new Set<object>();
  const labels: string[] = [];
  const scene = { children: { exists: (sprite: object) => displayed.has(sprite),
    add: (sprite: object) => { displayed.add(sprite); } }, add: {
    text: (_x: number, _y: number, label: string) => { labels.push(label); return { setOrigin() { return this; } }; },
    container: () => {
      const sprite = { scene: {} as object | undefined, y: 0, alpha: 1,
        setDepth() { return this; }, setPosition(_x: number, y: number) { this.y = y; return this; },
        setAlpha(alpha: number) { this.alpha = alpha; return this; }, destroy() { this.scene = undefined; } };
      sprites.push(sprite); return sprite;
    }
  } };
  const effect = new HarvestGainEffect(scene as unknown as import("phaser").Scene);
  const snapshot = { farm: { production: {} } } as import("../../src/schemas/farm").FarmSnapshot;
  try {
    effect.sample(snapshot, 9990, true);
    effect.sample(snapshot, 10010, true);
    effect.render(1200, false); // First display follows expensive harvest redraw.
    expect(sprites[0]!.y).toBe(isoPoint(gain.cell).y - 12);
    expect(labels).toEqual(["+10"]);
    // Phaser's DisplayList.removeAll(true) leaves scene references intact.
    displayed.clear();
    pose.mockReturnValue(null);
    effect.sample(snapshot, 10020, true);
    effect.render(1200, false);
    expect(sprites).toHaveLength(1);
    expect(displayed.has(sprites[0]!)).toBe(true);
    expect(sprites[0]!.y).toBeCloseTo(isoPoint(gain.cell).y - 12 - 116 / 30);
    sprites[0]!.destroy(); // Also recover if a renderer actually destroys it.
    effect.render(0, false);
    expect(sprites).toHaveLength(2);
    expect(sprites[1]!.alpha).toBe(1);
    expect(sprites[1]!.y).toBeCloseTo(isoPoint(gain.cell).y - 12 - 116 / 30);
    for (let i = 0; i < 28; i++) effect.render(50, false);
    expect(sprites[1]!.scene).toBeDefined();
    expect(sprites[1]!.y).toBeLessThan(isoPoint(gain.cell).y - 120);
    effect.render(50, false);
    expect(sprites[1]!.scene).toBeUndefined();
  } finally { pose.mockRestore(); }
});

it("shows sesame's points at cutting completion, once, without replaying offline work", () => {
  const target = { column: 4, row: 8 };
  const job: CropWork = { id: "harvest", cropId: "sesame", cropKey: "sesame", action: "harvest",
    startedAt: 0, workStartsAt: 2000, workEndsAt: 12000, completesAt: 15000,
    outbound: [{ column: 4, row: 7 }, target], inbound: [target, { column: 5, row: 5 }],
    quantity: 3, settled: false };
  const gains = sesameHarvestGains(job);
  expect(gains).toEqual([{ cell: target, at: 12000, quantity: 20 }]);
  expect(recentHarvestGains(gains, 11900, 11999)).toEqual([]);
  expect(recentHarvestGains(gains, 11999, 12000)).toEqual(gains);
  expect(recentHarvestGains(gains, 12000, 12100)).toEqual([]);
  expect(recentHarvestGains(gains, null, 13000)).toEqual([]);
  expect(recentHarvestGains(gains, 11900, 15000)).toEqual([]);
  expect(sesameHarvestGains({ ...job, quantity: 1 })[0]?.quantity).toBe(20);
  expect(sesameHarvestGains({ ...job, action: "plant" })).toEqual([]);
  expect(sesameHarvestGains({ ...job, cropKey: "datePalm" })).toEqual([]);
  expect(sesameHarvestGains({ ...job, quantity: 0 })).toEqual([]);
  expect(sesameHarvestGains(null)).toEqual([]);
});
