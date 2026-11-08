import { describe, expect, it } from "vitest";
import { INTERIOR_ENTRY, interiorPath, interiorSegmentClear, interiorWalkable } from "../../src/client/game/home/interiorNavigation";

describe("home interior movement", () => {
  const courtyard = { x: 750, y: 680 };
  const leftRoom = { x: 450, y: 380 };
  const rightRoom = { x: 1100, y: 460 };
  for (const target of [courtyard, leftRoom, rightRoom]) {
    it(`routes from the entrance to ${target.x},${target.y} without crossing walls`, () => {
      const path = interiorPath(INTERIOR_ENTRY, target);
      expect(path.length).toBeGreaterThan(0);
      expect(path.at(-1)).toEqual(target);
      const points = [INTERIOR_ENTRY, ...path];
      expect(points.slice(1).every((p, i) => interiorSegmentClear(points[i]!, p))).toBe(true);
    });
  }
  it("connects rooms through the courtyard rather than the dividing wall", () => {
    expect(interiorSegmentClear(leftRoom, rightRoom)).toBe(false);
    const path = interiorPath(leftRoom, rightRoom);
    expect(path.length).toBeGreaterThan(2);
    expect(path.some(p => p.y > 520)).toBe(true);
  });
  it("rejects walls and exterior clicks", () => {
    for (const p of [{x:50,y:50},{x:755,y:250},{x:400,y:570}]) {
      expect(interiorWalkable(p)).toBe(false);
      expect(interiorPath(courtyard, p)).toEqual([]);
    }
  });
  it("can redirect from a fractional position mid-walk", () => {
    expect(interiorPath({x:710.3,y:820.7}, leftRoom).length).toBeGreaterThan(0);
  });
});

// Doorway lanes keep the feet away from the jambs, even when smoothing a path.
describe("doorway clearance", () => {
  it("rejects the edges of each doorway", () => {
    for (const p of [{x:545,y:520},{x:595,y:520},{x:910,y:530},{x:951,y:550}]) {
      expect(interiorWalkable(p)).toBe(false);
    }
  });
  it("uses the narrow opening in both directions", () => {
    for (const room of [{x:450,y:380},{x:1100,y:460}]) {
      for (const [from, to] of [[INTERIOR_ENTRY, room], [room, INTERIOR_ENTRY]]) {
        const route = interiorPath(from!, to!);
        expect(route.length).toBeGreaterThan(0);
        const points = [from!, ...route];
        expect(points.slice(1).every((p, i) => interiorSegmentClear(points[i]!, p))).toBe(true);
      }
    }
  });
});

it("returns to the exit from either room, mid-walk, or the entrance itself", () => {
  for (const start of [{ x: 450, y: 380 }, { x: 1100, y: 460 }, { x: 710.3, y: 820.7 }, INTERIOR_ENTRY]) {
    const route = interiorPath(start, INTERIOR_ENTRY);
    expect(route.length).toBeGreaterThan(0);
    expect(route.at(-1)).toEqual(INTERIOR_ENTRY);
    const points = [start, ...route];
    expect(points.slice(1).every((p, i) => interiorSegmentClear(points[i]!, p))).toBe(true);
  }
});
