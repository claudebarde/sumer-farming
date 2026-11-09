import { describe, expect, it } from "vitest";
import { INTERIOR_WALLS, DOORWAY_HEADERS, insideDoorway, actorOccludingWalls } from "../../src/client/game/home/interiorWalls";
import { containsPoint } from "../../src/client/game/home/interiorNavigation";
const covered = (group: keyof typeof INTERIOR_WALLS, x: number, y: number) =>
  INTERIOR_WALLS[group].some(shape => containsPoint({x,y}, shape.map(([px,py]) => ({x:px,y:py}))));

describe("interior wall silhouettes", () => {
  it("covers the left room return wall without cutting into the floor behind it", () => {
    for (const [x,y] of [[190,438],[230,458],[280,485],[300,503],[190,520]]) {
      expect(covered("left",x!,y!)).toBe(true);
    }
    for (const [x,y] of [[190,425],[230,445],[280,473],[300,484]]) {
      expect(covered("left",x!,y!)).toBe(false);
    }
  });
  it("keeps the left doorway cap continuous on both sides and behind the beam", () => {
    for (const [x,y] of [[495,442],[510,427],[550,408],[600,385],[650,362],[690,343],[725,335]]) {
      expect(covered("left",x!,y!)).toBe(true);
    }
    // Room floor immediately behind the cap must still show the basket.
    for (const [x,y] of [[495,430],[550,400],[600,377],[650,354],[690,335],[725,320]]) {
      expect(covered("left",x!,y!)).toBe(false);
    }
    expect(covered("left",565,500)).toBe(false);
  });
  it("keeps the right doorway wall cap continuous behind furniture", () => {
    for (const [x,y] of [[884,390],[890,395],[895,398]]) expect(covered("right",x!,y!)).toBe(true);
    expect(covered("right",890,380)).toBe(false);
    expect(covered("right",937,510)).toBe(false);
  });
  it("covers the left wall cap without clipping the floor behind it", () => {
    // Stool legs at this edge must disappear at the inner cap, not its outer lip.
    for (const [x, y] of [[280,638],[340,670],[400,704]]) expect(covered("front",x!,y!)).toBe(true);
    for (const [x, y] of [[280,628],[340,660],[400,693]]) expect(covered("front",x!,y!)).toBe(false);
  });
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


describe("independent actor occlusion", () => {
  it("changes the actor clipping by room without changing the furniture wall polygons", () => {
    const original = JSON.stringify(INTERIOR_WALLS);
    const courtyard = actorOccludingWalls({x:760,y:700});
    expect(courtyard).toEqual([...INTERIOR_WALLS.front]);
    const leftRoom = actorOccludingWalls({x:450,y:380});
    expect(leftRoom).toContain(INTERIOR_WALLS.left[0]);
    expect(leftRoom).not.toContain(INTERIOR_WALLS.right[0]);
    const rightRoom = actorOccludingWalls({x:1100,y:460});
    expect(rightRoom).toContain(INTERIOR_WALLS.right[0]);
    expect(rightRoom).not.toContain(INTERIOR_WALLS.left[0]);
    expect(JSON.stringify(INTERIOR_WALLS)).toBe(original);
  });
  it("includes each lintel only during its own doorway crossing", () => {
    expect(actorOccludingWalls({x:568,y:500})).toContain(DOORWAY_HEADERS[0].silhouette);
    expect(actorOccludingWalls({x:936,y:520})).toContain(DOORWAY_HEADERS[1].silhouette);
    expect(actorOccludingWalls({x:760,y:700})).not.toContain(DOORWAY_HEADERS[0].silhouette);
  });
});
