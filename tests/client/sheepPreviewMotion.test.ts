import { describe, expect, it } from "vitest";
import { advancePreviewSheep, initialPreviewSheep, sheepPreviewInside, sheepPreviewSeparated } from "../../src/client/game/phaser/sheepPreviewMotion";

describe("sheep preview movement", () => {
  it("lets every sheep travel and graze while keeping feet separated inside the pen", () => {
    let seed = 42;
    const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    let herd = initialPreviewSheep();
    const distance = [0, 0, 0];
    const grazed = [false, false, false];
    for (let tick = 0; tick < 2400; tick++) {
      const previous = herd;
      herd = advancePreviewSheep(herd, 50, random);
      herd.forEach((sheep, i) => {
        distance[i]! += Math.hypot(sheep.position.x - previous[i]!.position.x, sheep.position.y - previous[i]!.position.y);
        grazed[i] ||= sheep.action.type === "graze";
        expect(sheepPreviewInside(sheep.position)).toBe(true);
        herd.slice(i + 1).forEach(other => expect(sheepPreviewSeparated(sheep.position, other.position)).toBe(true));
      });
    }
    distance.forEach(travel => expect(travel).toBeGreaterThan(40));
    expect(grazed).toEqual([true, true, true]);
  });

  it("stops walking frames when another sheep blocks the next step", () => {
    const herd = initialPreviewSheep();
    herd[0] = { position: { x: -21, y: 0 }, flip: true, action: { type: "walk", target: { x: 20, y: 0 }, elapsed: 200 } };
    herd[1] = { position: { x: 0, y: 0 }, flip: false, action: { type: "idle", remaining: 1000 } };
    const next = advancePreviewSheep(herd, 50, () => .5);
    expect(next[0]!.position).toEqual(herd[0]!.position);
    expect(next[0]!.action.type).toBe("idle");
  });
});
