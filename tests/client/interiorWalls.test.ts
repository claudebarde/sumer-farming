import { describe, expect, it } from "vitest";
import { INTERIOR_WALLS, DOORWAY_HEADERS, insideDoorway } from "../../src/client/game/home/interiorWalls";
import { containsPoint } from "../../src/client/game/home/interiorNavigation";
const covered = (group: keyof typeof INTERIOR_WALLS, x: number, y: number) =>
  INTERIOR_WALLS[group].some(shape => containsPoint({x,y}, shape.map(([px,py]) => ({x:px,y:py}))));

describe("interior wall silhouettes", () => {
  it("does not repaint courtyard floor at the concave front-right corner", () => {
    for (const [x,y] of [[900,750],[1000,700],[1100,650],[1200,620]]) expect(covered("front",x!,y!)).toBe(false);
  });
  it("does not repaint room floor behind the right room wall", () => {
    for (const [x,y] of [[1100,490],[1200,535],[1300,525]]) expect(covered("right",x!,y!)).toBe(false);
  });
  it("leaves both door openings clear while retaining the jambs", () => {
    expect(covered("left",565,500)).toBe(false);
    expect(covered("right",937,510)).toBe(false);
    expect(covered("left",525,510)).toBe(true);
    expect(covered("left",615,500)).toBe(true);
    expect(covered("right",890,500)).toBe(true);
    expect(covered("right",985,540)).toBe(true);
  });
  it("still covers the solid foreground wall", () => {
    expect(covered("front",1000,820)).toBe(true);
    expect(covered("front",450,800)).toBe(true);
  });
});

describe("covered doorway headers", () => {
  it("hides the disconnected head above either lintel during passage", () => {
    for (const [i, feet, head] of [
      [0, {x:568,y:500}, {x:568,y:395}],
      [1, {x:936,y:520}, {x:936,y:415}],
    ] as const) {
      const door = DOORWAY_HEADERS[i];
      expect(insideDoorway(feet, door)).toBe(true);
      expect(containsPoint(head, door.silhouette.map(([x,y]) => ({x,y})))).toBe(true);
      expect(containsPoint(feet, door.silhouette.map(([x,y]) => ({x,y})))).toBe(false);
    }
  });
  it("does not cover farmers standing in either room or the courtyard", () => {
    for (const point of [{x:450,y:380},{x:1100,y:460},{x:568,y:610},{x:936,y:630}]) {
      expect(DOORWAY_HEADERS.some(door => insideDoorway(point, door))).toBe(false);
    }
  });
});
